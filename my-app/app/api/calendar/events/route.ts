import { getCurrentUserId } from "@/lib/auth";
import {
  createCalendarEvent,
  listCalendarEvents,
  validateCalendarRange,
  validateCreateCalendarEventBody,
} from "@/lib/services/calendarEvents";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const validation = validateCalendarRange(searchParams);

    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: validation.status ?? 400 });
    }

    const events = await listCalendarEvents(getCurrentUserId(), validation.value);
    return Response.json({ data: events });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to fetch calendar events." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const validation = validateCreateCalendarEventBody(await request.json());

    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: validation.status ?? 400 });
    }

    const result = await createCalendarEvent(getCurrentUserId(), validation.value);
    return Response.json({ data: result.value }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to create calendar event." }, { status: 500 });
  }
}
