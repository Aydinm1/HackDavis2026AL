import { getCurrentUserId } from "@/lib/auth";
import googleCalendar from "@/lib/services/googleCalendar";

export const runtime = "nodejs";

async function readJsonBody(request: Request) {
  const text = await request.text();
  if (!text.trim()) return {};
  return JSON.parse(text) as Record<string, unknown>;
}

function parseOptionalDate(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") {
    throw new Error(`${field} must be an ISO date string.`);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${field} must be a valid ISO date string.`);
  }

  return date;
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    const calendarId = typeof body.calendarId === "string" && body.calendarId.trim() ? body.calendarId.trim() : undefined;
    const start = parseOptionalDate(body.start, "start");
    const end = parseOptionalDate(body.end, "end");

    if ((start && !end) || (!start && end)) {
      return Response.json({ error: "start and end must be provided together." }, { status: 400 });
    }

    const result = await googleCalendar.syncGoogleCalendarEvents(getCurrentUserId(), { calendarId, start, end });
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json({ data: result.value });
  } catch (caught) {
    console.error(caught);
    if (caught instanceof Error && /must be/.test(caught.message)) {
      return Response.json({ error: caught.message }, { status: 400 });
    }

    return Response.json(
      { error: caught instanceof Error ? caught.message : "Failed to sync Google Calendar events." },
      { status: 500 },
    );
  }
}
