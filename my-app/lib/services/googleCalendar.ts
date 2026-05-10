import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API_URL = "https://www.googleapis.com/calendar/v3";
const DEFAULT_SCOPES = "https://www.googleapis.com/auth/calendar.readonly";

type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
};

type GoogleCalendarEventDate = {
  date?: string;
  dateTime?: string;
  timeZone?: string;
};

type GoogleCalendarEvent = {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: GoogleCalendarEventDate;
  end?: GoogleCalendarEventDate;
  updated?: string;
};

type GoogleEventsResponse = {
  items?: GoogleCalendarEvent[];
  nextPageToken?: string;
};

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for Google Calendar integration.`);
  }

  return value;
}

function getScopes() {
  return process.env.GOOGLE_CALENDAR_SCOPES ?? DEFAULT_SCOPES;
}

function getEncryptionSecret() {
  return process.env.GOOGLE_TOKEN_ENCRYPTION_KEY ?? process.env.GOOGLE_CLIENT_SECRET ?? "mvp-demo-token-secret";
}

function encryptionKey() {
  return crypto.createHash("sha256").update(getEncryptionSecret()).digest();
}

function encryptToken(token: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

function decryptToken(encryptedToken: string) {
  const [ivText, tagText, encryptedText] = encryptedToken.split(".");
  if (!ivText || !tagText || !encryptedText) {
    throw new Error("Stored Google token is not in the expected encrypted format.");
  }

  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function encodeState(userId: string) {
  const payload = Buffer.from(JSON.stringify({ userId, nonce: crypto.randomUUID() }), "utf8").toString("base64url");
  const signature = crypto.createHmac("sha256", getEncryptionSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function decodeState(state: string) {
  try {
    const [payload, signature] = state.split(".");
    if (!payload || !signature) {
      return null;
    }

    const expected = crypto.createHmac("sha256", getEncryptionSecret()).update(payload).digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return null;
    }

    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { userId?: string };
    return typeof parsed.userId === "string" ? parsed.userId : null;
  } catch {
    return null;
  }
}

export function buildGoogleCalendarAuthUrl(userId: string) {
  const params = new URLSearchParams({
    client_id: requiredEnv("GOOGLE_CLIENT_ID"),
    redirect_uri: requiredEnv("GOOGLE_REDIRECT_URI"),
    response_type: "code",
    scope: getScopes(),
    access_type: "offline",
    prompt: "consent",
    state: encodeState(userId),
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: requiredEnv("GOOGLE_CLIENT_ID"),
      client_secret: requiredEnv("GOOGLE_CLIENT_SECRET"),
      redirect_uri: requiredEnv("GOOGLE_REDIRECT_URI"),
      grant_type: "authorization_code",
    }),
  });

  const payload = (await response.json()) as GoogleTokenResponse & { error?: string; error_description?: string };
  if (!response.ok) {
    throw new Error(payload.error_description ?? payload.error ?? "Google OAuth token exchange failed.");
  }

  return payload;
}

async function refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requiredEnv("GOOGLE_CLIENT_ID"),
      client_secret: requiredEnv("GOOGLE_CLIENT_SECRET"),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const payload = (await response.json()) as GoogleTokenResponse & { error?: string; error_description?: string };
  if (!response.ok) {
    throw new Error(payload.error_description ?? payload.error ?? "Google OAuth token refresh failed.");
  }

  return payload;
}

function tokenExpiresAt(tokens: GoogleTokenResponse) {
  return tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null;
}

export async function handleGoogleCalendarCallback(params: { code: string; state: string }) {
  const userId = decodeState(params.state);
  if (!userId) {
    return { ok: false as const, error: "Invalid Google OAuth state.", status: 400 };
  }

  const tokens = await exchangeCodeForTokens(params.code);
  if (!tokens.access_token) {
    return { ok: false as const, error: "Google did not return an access token.", status: 400 };
  }

  const connection = await prisma.calendarConnection.upsert({
    where: {
      userId_provider_calendarId: {
        userId,
        provider: "google",
        calendarId: "primary",
      },
    },
    update: {
      accessTokenEncrypted: encryptToken(tokens.access_token),
      refreshTokenEncrypted: tokens.refresh_token ? encryptToken(tokens.refresh_token) : undefined,
      expiresAt: tokenExpiresAt(tokens),
      scope: tokens.scope,
      tokenType: tokens.token_type,
    },
    create: {
      userId,
      provider: "google",
      calendarId: "primary",
      accessTokenEncrypted: encryptToken(tokens.access_token),
      refreshTokenEncrypted: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
      expiresAt: tokenExpiresAt(tokens),
      scope: tokens.scope,
      tokenType: tokens.token_type,
    },
  });

  return { ok: true as const, value: { connectionId: connection.id, provider: connection.provider, calendarId: connection.calendarId } };
}

async function getUsableAccessToken(userId: string, calendarId: string) {
  const connection = await prisma.calendarConnection.findUnique({
    where: {
      userId_provider_calendarId: {
        userId,
        provider: "google",
        calendarId,
      },
    },
  });

  if (!connection) {
    return { ok: false as const, error: "Google Calendar is not connected for this user.", status: 404 };
  }

  const expiresSoon = connection.expiresAt ? connection.expiresAt.getTime() <= Date.now() + 60_000 : false;
  if (!expiresSoon) {
    return { ok: true as const, value: decryptToken(connection.accessTokenEncrypted) };
  }

  if (!connection.refreshTokenEncrypted) {
    return { ok: false as const, error: "Google access token expired and no refresh token is stored.", status: 401 };
  }

  const refreshed = await refreshAccessToken(decryptToken(connection.refreshTokenEncrypted));
  const updated = await prisma.calendarConnection.update({
    where: { id: connection.id },
    data: {
      accessTokenEncrypted: encryptToken(refreshed.access_token),
      expiresAt: tokenExpiresAt(refreshed),
      scope: refreshed.scope ?? connection.scope,
      tokenType: refreshed.token_type ?? connection.tokenType,
    },
  });

  return { ok: true as const, value: decryptToken(updated.accessTokenEncrypted) };
}

function parseGoogleEventDate(value: GoogleCalendarEventDate | undefined, fallbackDate?: Date) {
  if (value?.dateTime) {
    return { date: new Date(value.dateTime), isAllDay: false };
  }

  if (value?.date) {
    return { date: new Date(`${value.date}T00:00:00`), isAllDay: true };
  }

  return { date: fallbackDate ?? new Date(), isAllDay: false };
}

function mapGoogleStatus(status: string | undefined) {
  if (status === "cancelled") return "cancelled";
  if (status === "tentative") return "tentative";
  return "confirmed";
}

async function fetchGoogleEvents(input: { accessToken: string; calendarId: string; start: Date; end: Date }) {
  const events: GoogleCalendarEvent[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      timeMin: input.start.toISOString(),
      timeMax: input.end.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      showDeleted: "true",
      maxResults: "2500",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const response = await fetch(`${GOOGLE_CALENDAR_API_URL}/calendars/${encodeURIComponent(input.calendarId)}/events?${params.toString()}`, {
      headers: { Authorization: `Bearer ${input.accessToken}` },
    });
    const payload = (await response.json()) as GoogleEventsResponse & { error?: { message?: string } };
    if (!response.ok) {
      throw new Error(payload.error?.message ?? "Google Calendar event sync failed.");
    }

    events.push(...(payload.items ?? []));
    pageToken = payload.nextPageToken;
  } while (pageToken);

  return events;
}

function defaultSyncRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 30);
  return { start, end };
}

export async function syncGoogleCalendarEvents(userId: string, input: { calendarId?: string; start?: Date; end?: Date } = {}) {
  const calendarId = input.calendarId ?? "primary";
  const range = input.start && input.end ? { start: input.start, end: input.end } : defaultSyncRange();

  if (range.end <= range.start) {
    return { ok: false as const, error: "end must be after start.", status: 400 };
  }

  const token = await getUsableAccessToken(userId, calendarId);
  if (!token.ok) return token;

  const events = await fetchGoogleEvents({
    accessToken: token.value,
    calendarId,
    start: range.start,
    end: range.end,
  });

  const syncedEvents = await Promise.all(
    events.map((event) => {
      const start = parseGoogleEventDate(event.start);
      const end = parseGoogleEventDate(event.end, start.date);

      return prisma.calendarEvent.upsert({
        where: {
          userId_provider_externalEventId: {
            userId,
            provider: "google",
            externalEventId: event.id,
          },
        },
        update: {
          calendarId,
          title: event.summary ?? "Untitled Google Calendar event",
          description: event.description,
          location: event.location,
          startTime: start.date,
          endTime: end.date,
          isAllDay: start.isAllDay || end.isAllDay,
          source: "google_import",
          status: mapGoogleStatus(event.status),
          rawProviderData: event as unknown as Prisma.InputJsonObject,
        },
        create: {
          userId,
          provider: "google",
          externalEventId: event.id,
          calendarId,
          title: event.summary ?? "Untitled Google Calendar event",
          description: event.description,
          location: event.location,
          startTime: start.date,
          endTime: end.date,
          isAllDay: start.isAllDay || end.isAllDay,
          source: "google_import",
          status: mapGoogleStatus(event.status),
          rawProviderData: event as unknown as Prisma.InputJsonObject,
        },
      });
    }),
  );

  return {
    ok: true as const,
    value: {
      calendarId,
      range,
      importedCount: syncedEvents.length,
      events: syncedEvents,
    },
  };
}

const googleCalendar = {
  buildGoogleCalendarAuthUrl,
  handleGoogleCalendarCallback,
  syncGoogleCalendarEvents,
};

export default googleCalendar;
