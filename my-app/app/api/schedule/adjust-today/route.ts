import { getCurrentUserId } from "@/lib/auth";
import { getTodayScheduleAdjustments } from "@/lib/services/checkins";

export const runtime = "nodejs";

export async function POST() {
  try {
    const adjustments = await getTodayScheduleAdjustments(getCurrentUserId());
    return Response.json({ data: adjustments });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to adjust today's schedule." }, { status: 500 });
  }
}
