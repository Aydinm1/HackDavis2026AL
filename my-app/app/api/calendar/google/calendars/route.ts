import { getCurrentUserId } from "@/lib/auth";
import googleCalendar from "@/lib/services/googleCalendar";

export const runtime = "nodejs";

async function readJsonBody(request: Request) {
  const text = await request.text();
  if (!text.trim()) return {};
  return JSON.parse(text) as Record<string, unknown>;
}

function parseCalendarIds(value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error("calendarIds must be an array of strings.");
  }

  const calendarIds = value.map((item) => {
    if (typeof item !== "string") {
      throw new Error("calendarIds must be an array of strings.");
    }

    return item;
  });

  return calendarIds;
}

export async function GET() {
  try {
    const result = await googleCalendar.listGoogleCalendars(getCurrentUserId());
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json({ data: { calendars: result.value } });
  } catch (caught) {
    console.error(caught);
    return Response.json(
      { error: caught instanceof Error ? caught.message : "Failed to fetch Google calendars." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await readJsonBody(request);
    const calendarIds = parseCalendarIds(body.calendarIds);
    const result = await googleCalendar.updateSelectedGoogleCalendars(getCurrentUserId(), calendarIds);

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json({ data: { calendars: result.value } });
  } catch (caught) {
    console.error(caught);
    if (caught instanceof Error && /calendarIds|At least|Unknown/.test(caught.message)) {
      return Response.json({ error: caught.message }, { status: 400 });
    }

    return Response.json(
      { error: caught instanceof Error ? caught.message : "Failed to update selected Google calendars." },
      { status: 500 },
    );
  }
}
