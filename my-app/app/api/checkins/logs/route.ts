import { getCurrentUserId } from "@/lib/auth";
import { validateCalendarRange } from "@/lib/services/calendarEvents";
import { createCheckinLog, listCheckinLogs, validateCheckinLogBody } from "@/lib/services/checkins";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const validation = validateCalendarRange(searchParams);

    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: validation.status ?? 400 });
    }

    const checkinLogs = await listCheckinLogs(getCurrentUserId(), validation.value);
    return Response.json({ data: checkinLogs });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to fetch check-in logs." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const validation = validateCheckinLogBody(await request.json());

    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: validation.status ?? 400 });
    }

    const result = await createCheckinLog(getCurrentUserId(), validation.value);
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json({ data: result.value }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to save check-in log." }, { status: 500 });
  }
}
