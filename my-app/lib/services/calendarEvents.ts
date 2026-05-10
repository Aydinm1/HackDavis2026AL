import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const allowedEventFields = [
  "title",
  "description",
  "location",
  "startTime",
  "endTime",
  "isAllDay",
  "source",
] as const;

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; status?: number };

type CalendarEventInput = {
  title: string;
  description?: string | null;
  location?: string | null;
  startTime: Date;
  endTime: Date;
  isAllDay?: boolean;
  source?: string;
};

type CalendarEventPatchInput = Partial<CalendarEventInput>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseString(value: unknown, field: string, required = false): ValidationResult<string | undefined> {
  if (value === undefined || value === null) {
    return required ? { ok: false, error: `${field} is required.` } : { ok: true, value: undefined };
  }

  if (typeof value !== "string") {
    return { ok: false, error: `${field} must be a string.` };
  }

  const trimmed = value.trim();
  if (required && !trimmed) {
    return { ok: false, error: `${field} is required.` };
  }

  return { ok: true, value: trimmed || undefined };
}

function parseNullableString(value: unknown, field: string): ValidationResult<string | null | undefined> {
  if (value === undefined) {
    return { ok: true, value: undefined };
  }

  if (value === null) {
    return { ok: true, value: null };
  }

  return parseString(value, field);
}

function parseBoolean(value: unknown, field: string): ValidationResult<boolean | undefined> {
  if (value === undefined) {
    return { ok: true, value: undefined };
  }

  if (typeof value !== "boolean") {
    return { ok: false, error: `${field} must be a boolean.` };
  }

  return { ok: true, value };
}

function parseDate(value: unknown, field: string, required = false): ValidationResult<Date | undefined> {
  if (value === undefined || value === null) {
    return required ? { ok: false, error: `${field} is required.` } : { ok: true, value: undefined };
  }

  if (typeof value !== "string") {
    return { ok: false, error: `${field} must be an ISO date string.` };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false, error: `${field} must be a valid ISO date string.` };
  }

  return { ok: true, value: parsed };
}

function rejectUnknownFields(body: Record<string, unknown>, allowedFields: readonly string[]) {
  const allowed = new Set(allowedFields);
  const unknown = Object.keys(body).filter((key) => !allowed.has(key));

  if (unknown.length > 0) {
    return `Unsupported field(s): ${unknown.join(", ")}.`;
  }

  return null;
}

function validateTimeRange(startTime: Date | undefined, endTime: Date | undefined) {
  if (startTime && endTime && endTime <= startTime) {
    return "endTime must be after startTime.";
  }

  return null;
}

export function validateCalendarRange(searchParams: URLSearchParams): ValidationResult<{
  start: Date;
  end: Date;
}> {
  const start = parseDate(searchParams.get("start"), "start", true);
  if (!start.ok) return start;

  const end = parseDate(searchParams.get("end"), "end", true);
  if (!end.ok) return end;

  const parsedStart = start.value;
  const parsedEnd = end.value;

  if (!parsedStart || !parsedEnd) {
    return { ok: false, error: "start and end are required." };
  }

  const rangeError = validateTimeRange(parsedStart, parsedEnd);
  if (rangeError) {
    return { ok: false, error: rangeError };
  }

  return { ok: true, value: { start: parsedStart, end: parsedEnd } };
}

export function validateCreateCalendarEventBody(body: unknown): ValidationResult<CalendarEventInput> {
  if (!isRecord(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const unknownFieldsError = rejectUnknownFields(body, allowedEventFields);
  if (unknownFieldsError) {
    return { ok: false, error: unknownFieldsError };
  }

  const title = parseString(body.title, "title", true);
  if (!title.ok) return title;

  const description = parseNullableString(body.description, "description");
  if (!description.ok) return description;

  const location = parseNullableString(body.location, "location");
  if (!location.ok) return location;

  const startTime = parseDate(body.startTime, "startTime", true);
  if (!startTime.ok) return startTime;

  const endTime = parseDate(body.endTime, "endTime", true);
  if (!endTime.ok) return endTime;

  const parsedStartTime = startTime.value;
  const parsedEndTime = endTime.value;

  if (!parsedStartTime || !parsedEndTime) {
    return { ok: false, error: "startTime and endTime are required." };
  }

  const rangeError = validateTimeRange(parsedStartTime, parsedEndTime);
  if (rangeError) {
    return { ok: false, error: rangeError };
  }

  const isAllDay = parseBoolean(body.isAllDay, "isAllDay");
  if (!isAllDay.ok) return isAllDay;

  const source = parseString(body.source, "source");
  if (!source.ok) return source;

  return {
    ok: true,
    value: {
      title: title.value ?? "",
      description: description.value,
      location: location.value,
      startTime: parsedStartTime,
      endTime: parsedEndTime,
      isAllDay: isAllDay.value,
      source: source.value,
    },
  };
}

export function validatePatchCalendarEventBody(body: unknown): ValidationResult<CalendarEventPatchInput> {
  if (!isRecord(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const unknownFieldsError = rejectUnknownFields(body, allowedEventFields);
  if (unknownFieldsError) {
    return { ok: false, error: unknownFieldsError };
  }

  if (Object.keys(body).length === 0) {
    return { ok: false, error: "At least one field is required." };
  }

  const title = parseString(body.title, "title");
  if (!title.ok) return title;

  const description = parseNullableString(body.description, "description");
  if (!description.ok) return description;

  const location = parseNullableString(body.location, "location");
  if (!location.ok) return location;

  const startTime = parseDate(body.startTime, "startTime");
  if (!startTime.ok) return startTime;

  const endTime = parseDate(body.endTime, "endTime");
  if (!endTime.ok) return endTime;

  const rangeError = validateTimeRange(startTime.value, endTime.value);
  if (rangeError) {
    return { ok: false, error: rangeError };
  }

  const isAllDay = parseBoolean(body.isAllDay, "isAllDay");
  if (!isAllDay.ok) return isAllDay;

  const source = parseString(body.source, "source");
  if (!source.ok) return source;

  return {
    ok: true,
    value: {
      title: title.value,
      description: description.value,
      location: location.value,
      startTime: startTime.value,
      endTime: endTime.value,
      isAllDay: isAllDay.value,
      source: source.value,
    },
  };
}

type CalendarEventWriteData = Partial<Omit<Prisma.CalendarEventUncheckedCreateInput, "id" | "userId">>;

function compactEventData(input: CalendarEventInput | CalendarEventPatchInput): CalendarEventWriteData {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as CalendarEventWriteData;
}

export async function listCalendarEvents(userId: string, range: { start: Date; end: Date }) {
  return prisma.calendarEvent.findMany({
    where: {
      userId,
      startTime: { lt: range.end },
      endTime: { gt: range.start },
    },
    orderBy: [{ startTime: "asc" }, { createdAt: "asc" }],
  });
}

export async function createCalendarEvent(userId: string, input: CalendarEventInput) {
  const { title, startTime, endTime, ...optionalInput } = input;

  const event = await prisma.calendarEvent.create({
    data: {
      userId,
      title,
      startTime,
      endTime,
      provider: "manual",
      calendarId: "mvp-demo-calendar",
      status: "confirmed",
      ...compactEventData(optionalInput),
    },
  });

  return { ok: true as const, value: event };
}

export async function updateCalendarEvent(userId: string, eventId: string, input: CalendarEventPatchInput) {
  const existingEvent = await prisma.calendarEvent.findFirst({
    where: { id: eventId, userId },
    select: {
      id: true,
      startTime: true,
      endTime: true,
      provider: true,
    },
  });

  if (!existingEvent) {
    return { ok: false as const, error: "Calendar event not found.", status: 404 };
  }

  if (existingEvent.provider && existingEvent.provider !== "manual" && existingEvent.provider !== "mock") {
    return { ok: false as const, error: "Only manual/mock calendar events are supported for MVP.", status: 400 };
  }

  const nextStartTime = input.startTime ?? existingEvent.startTime;
  const nextEndTime = input.endTime ?? existingEvent.endTime;
  const rangeError = validateTimeRange(nextStartTime, nextEndTime);
  if (rangeError) {
    return { ok: false as const, error: rangeError, status: 400 };
  }

  const event = await prisma.calendarEvent.update({
    where: { id: eventId },
    data: compactEventData(input) as Prisma.CalendarEventUncheckedUpdateInput,
  });

  return { ok: true as const, value: event };
}

export async function cancelCalendarEvent(userId: string, eventId: string) {
  const existingEvent = await prisma.calendarEvent.findFirst({
    where: { id: eventId, userId },
    select: { id: true, provider: true },
  });

  if (!existingEvent) {
    return { ok: false as const, error: "Calendar event not found.", status: 404 };
  }

  if (existingEvent.provider && existingEvent.provider !== "manual" && existingEvent.provider !== "mock") {
    return { ok: false as const, error: "Only manual/mock calendar events are supported for MVP.", status: 400 };
  }

  const event = await prisma.calendarEvent.update({
    where: { id: eventId },
    data: { status: "cancelled" },
  });

  return { ok: true as const, value: event };
}
