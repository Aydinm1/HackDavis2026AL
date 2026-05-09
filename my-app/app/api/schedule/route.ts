import { getCurrentUserId } from "@/lib/auth";
import { validateCalendarRange } from "@/lib/services/calendarEvents";
import { getSchedule } from "@/lib/services/scheduledBlocks";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const validation = validateCalendarRange(searchParams);

    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: validation.status ?? 400 });
    }

    const schedule = await getSchedule(getCurrentUserId(), validation.value);
    return Response.json({ data: schedule });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to fetch schedule." }, { status: 500 });
  }
}
