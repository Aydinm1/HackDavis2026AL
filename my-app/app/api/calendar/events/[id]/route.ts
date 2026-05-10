import { getCurrentUserId } from "@/lib/auth";
import {
  cancelCalendarEvent,
  updateCalendarEvent,
  validatePatchCalendarEventBody,
} from "@/lib/services/calendarEvents";

export const runtime = "nodejs";

type CalendarEventRouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: CalendarEventRouteContext) {
  try {
    const { id } = await context.params;
    const validation = validatePatchCalendarEventBody(await request.json());

    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: validation.status ?? 400 });
    }

    const result = await updateCalendarEvent(getCurrentUserId(), id, validation.value);
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json({ data: result.value });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to update calendar event." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: CalendarEventRouteContext) {
  try {
    const { id } = await context.params;
    const result = await cancelCalendarEvent(getCurrentUserId(), id);

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json({ data: result.value });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to delete calendar event." }, { status: 500 });
  }
}
