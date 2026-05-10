import { getCurrentUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseDashboardDate } from "@/lib/services/dashboard";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const date = typeof body.date === "string" ? body.date : "";
    const validation = parseDashboardDate(new URLSearchParams({ date }));

    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: validation.status ?? 400 });
    }

    const userId = getCurrentUserId();
    const [checkinLogs, dailyCheckins] = await Promise.all([
      prisma.checkinLog.deleteMany({
        where: {
          userId,
          loggedAt: {
            gte: validation.value.start,
            lt: validation.value.end,
          },
        },
      }),
      prisma.dailyCheckin.deleteMany({
        where: {
          userId,
          checkinDate: validation.value.start,
        },
      }),
    ]);

    return Response.json({
      data: {
        date: validation.value.date,
        deletedCheckinLogs: checkinLogs.count,
        deletedDailyCheckins: dailyCheckins.count,
      },
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to reset daily check-in." }, { status: 500 });
  }
}
