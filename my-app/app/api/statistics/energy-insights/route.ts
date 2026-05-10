import { getCurrentUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";

const defaultDemoDate = "2026-05-11";

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function subDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfNextMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function demoFallbackScore(day: number, offset: number) {
  return ((day * 3 + offset) % 7) + 1;
}

function parseDateParam(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? defaultDemoDate;
  return startOfDay(new Date(`${date}T12:00:00`));
}

export async function GET(request: Request) {
  try {
    const userId = getCurrentUserId();

    // Keep statistics aligned with the same demo day as the dashboard unless a date is provided.
    const today = parseDateParam(request);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const monthStart = startOfMonth(today);
    const nextMonthStart = startOfNextMonth(today);
    const todayCheckin = await prisma.dailyCheckin.findUnique({
      where: {
        userId_checkinDate: {
          userId,
          checkinDate: today,
        },
      },
    });
    const latestTodayCheckinLog = await prisma.checkinLog.findFirst({
      where: {
        userId,
        loggedAt: {
          gte: today,
          lt: tomorrow,
        },
      },
      orderBy: { loggedAt: "desc" },
    });

    // Get past 7 days of check-ins
    const sevenDaysAgo = subDays(today, 6);
    const pastCheckins = await prisma.dailyCheckin.findMany({
      where: {
        userId,
        checkinDate: {
          gte: sevenDaysAgo,
          lt: today,
        },
      },
      orderBy: { checkinDate: "asc" },
    });

    // Get check-in logs for past 7 days (for additional data points)
    const checkinLogs = await prisma.checkinLog.findMany({
      where: {
        userId,
        loggedAt: {
          gte: sevenDaysAgo,
        },
      },
      orderBy: { loggedAt: "desc" },
    });

    const monthCheckins = await prisma.dailyCheckin.findMany({
      where: {
        userId,
        checkinDate: {
          gte: monthStart,
          lt: nextMonthStart,
        },
      },
      orderBy: { checkinDate: "asc" },
    });

    const monthCheckinLogs = await prisma.checkinLog.findMany({
      where: {
        userId,
        loggedAt: {
          gte: monthStart,
          lt: nextMonthStart,
        },
      },
      orderBy: { loggedAt: "desc" },
    });

    // Get scheduled blocks for past 7 days to calculate task completion
    const scheduledBlocks = await prisma.scheduledBlock.findMany({
      where: {
        userId,
        startTime: {
          gte: sevenDaysAgo,
        },
      },
      include: { task: true },
    });

    const calendarEvents = await prisma.calendarEvent.findMany({
      where: {
        userId,
        status: "confirmed",
        endTime: {
          gte: sevenDaysAgo,
          lte: tomorrow,
        },
      },
    });

    // Get tasks completed in past 7 days (reserved for future use)
    // const completedTasks = await prisma.task.findMany({
    //   where: {
    //     userId,
    //     status: "completed",
    //     updatedAt: {
    //       gte: sevenDaysAgo,
    //     },
    //   },
    // });

    // Get current insights
    const insights = await prisma.aiInsight.findMany({
      where: {
        userId,
        createdAt: {
          gte: subDays(new Date(), 1),
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    // Build response data
    const pastWeekData = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(today, i);
      const dateStr = formatDate(date);
      
      const checkin = pastCheckins.find((c) => formatDate(c.checkinDate) === dateStr);
      const latestLog = checkinLogs.find((log) => formatDate(log.loggedAt) === dateStr);
      
      pastWeekData.push({
        date: dateStr,
        energy: latestLog?.energyScore ?? checkin?.energyScore ?? 4,
        stress: latestLog?.stressScore ?? checkin?.stressScore ?? 4,
      });
    }

    const monthData = [];
    for (let date = new Date(monthStart); date < nextMonthStart; date.setDate(date.getDate() + 1)) {
      const dateForCell = new Date(date);
      const dateStr = formatDate(dateForCell);
      const day = dateForCell.getDate();
      const checkin = monthCheckins.find((c) => formatDate(c.checkinDate) === dateStr);
      const latestLog = monthCheckinLogs.find((log) => formatDate(log.loggedAt) === dateStr);

      monthData.push({
        date: dateStr,
        energy: latestLog?.energyScore ?? checkin?.energyScore ?? demoFallbackScore(day, 1),
        stress: latestLog?.stressScore ?? checkin?.stressScore ?? demoFallbackScore(day, 4),
        hasCheckin: Boolean(latestLog || checkin),
      });
    }

    // Calculate weekly task completion
    const weeklyTasks = pastWeekData.map((day, index) => {
      const dayStart = new Date(day.date);
      const dayEnd = new Date(day.date);
      dayEnd.setHours(23, 59, 59, 999);

      const dayBlocks = scheduledBlocks.filter(
        (block) =>
          block.startTime >= dayStart &&
          block.startTime <= dayEnd &&
          block.status === "completed"
      );
      const dayEvents = calendarEvents.filter(
        (event) =>
          event.endTime >= dayStart &&
          event.endTime <= dayEnd
      );

      const demoTaskFallback = [6, 11, 4, 3, 4, 14, 13][index] ?? 4;
      const demoEventFallback = [10, 5, 10, 5, 7, 2, 3][index] ?? 4;
      const tasksCompleted = Math.max(dayBlocks.length, demoTaskFallback);
      const eventsCompleted = Math.max(dayEvents.length, demoEventFallback);

      return {
        date: day.date,
        completed: tasksCompleted,
        total: tasksCompleted + eventsCompleted,
        tasksCompleted,
        eventsCompleted,
      };
    });

    // Calculate averages
    const allScores = [
      ...pastCheckins,
      ...checkinLogs.map((log) => ({
        energyScore: log.energyScore,
        stressScore: log.stressScore,
      })),
    ];

    const averageEnergy =
      allScores.length > 0
        ? allScores.reduce((sum, s) => sum + s.energyScore, 0) / allScores.length
        : 4;

    const averageStress =
      allScores.length > 0
        ? allScores.reduce((sum, s) => sum + s.stressScore, 0) / allScores.length
        : 4;

    // Format insights
    const formattedInsights = insights.map((insight) => ({
      type: insight.insightType || "completion_pattern",
      title: insight.title || "Insight",
      reason: insight.body || "",
    }));

    return Response.json({
      data: {
        todayEnergy: latestTodayCheckinLog?.energyScore ?? todayCheckin?.energyScore ?? null,
        todayStress: latestTodayCheckinLog?.stressScore ?? todayCheckin?.stressScore ?? null,
        pastWeek: pastWeekData,
        month: monthData,
        averageEnergy: Math.round(averageEnergy * 10) / 10,
        averageStress: Math.round(averageStress * 10) / 10,
        weeklyTasks,
        insights: formattedInsights,
      },
    });
  } catch (error) {
    console.error("Failed to fetch energy insights:", error);
    return Response.json(
      { error: "Failed to fetch energy insights" },
      { status: 500 }
    );
  }
}
