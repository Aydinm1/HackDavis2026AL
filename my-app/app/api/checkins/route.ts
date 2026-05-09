import { getCurrentUserId } from "@/lib/auth";
import { validateCalendarRange } from "@/lib/services/calendarEvents";
import { listDailyCheckins } from "@/lib/services/checkins";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const validation = validateCalendarRange(searchParams);

    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: validation.status ?? 400 });
    }

    const checkins = await listDailyCheckins(getCurrentUserId(), validation.value);
    return Response.json({ data: checkins });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to fetch daily check-ins." }, { status: 500 });
  }
}
