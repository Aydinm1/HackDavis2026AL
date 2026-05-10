import { prisma } from "@/lib/db";

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; status?: number };

type DashboardDateRange = {
  date: string;
  start: Date;
  end: Date;
};

const incompleteTaskStatuses = ["todo", "scheduled", "in_progress", "deferred"];

type DashboardCheckinLog = {
  id: string;
  loggedAt: Date;
  energyScore: number;
  stressScore: number;
  availableCapacityMinutes: number | null;
  userNote: string | null;
  source: string;
};

type CheckinLogDelegate = {
  findFirst(args: unknown): Promise<DashboardCheckinLog | null>;
  findMany(args: unknown): Promise<DashboardCheckinLog[]>;
};

function getCheckinLogDelegate() {
  return (prisma as unknown as { checkinLog?: CheckinLogDelegate }).checkinLog;
}

export function parseDashboardDate(searchParams: URLSearchParams): ValidationResult<DashboardDateRange> {
  const date = searchParams.get("date");

  if (!date) {
    return { ok: false, error: "date is required in YYYY-MM-DD format." };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: "date must be in YYYY-MM-DD format." };
  }

  const [year, month, day] = date.split("-").map(Number);
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (
    Number.isNaN(start.getTime()) ||
    start.getFullYear() !== year ||
    start.getMonth() !== month - 1 ||
    start.getDate() !== day
  ) {
    return { ok: false, error: "date must be a valid calendar date." };
  }

  return {
    ok: true,
    value: {
      date,
      start,
      end: new Date(start.getTime() + 24 * 60 * 60_000),
    },
  };
}

export async function getTodayDashboard(userId: string, range: DashboardDateRange) {
  const now = new Date();
  const eventAnchor = now > range.start && now < range.end ? now : range.start;
  const checkinLogDelegate = getCheckinLogDelegate();

  const [checkin, latestCheckinLog, todayCheckinLogs, nextCalendarEvent, todayBlocks, topTasks, insights] = await Promise.all([
    prisma.dailyCheckin.findUnique({
      where: {
        userId_checkinDate: {
          userId,
          checkinDate: range.start,
        },
      },
      include: {
        aiInsights: true,
      },
    }),
    checkinLogDelegate
      ? checkinLogDelegate.findFirst({
          where: {
            userId,
            loggedAt: {
              gte: range.start,
              lt: range.end,
            },
          },
          orderBy: { loggedAt: "desc" },
        })
      : Promise.resolve(null),
    checkinLogDelegate
      ? checkinLogDelegate.findMany({
          where: {
            userId,
            loggedAt: {
              gte: range.start,
              lt: range.end,
            },
          },
          orderBy: { loggedAt: "asc" },
        })
      : Promise.resolve([]),
    prisma.calendarEvent.findFirst({
      where: {
        userId,
        status: { not: "cancelled" },
        startTime: {
          gte: eventAnchor,
          lt: range.end,
        },
      },
      orderBy: { startTime: "asc" },
    }),
    prisma.scheduledBlock.findMany({
      where: {
        userId,
        startTime: {
          gte: range.start,
          lt: range.end,
        },
      },
      include: {
        task: true,
        taskBreakdown: true,
      },
      orderBy: [{ startTime: "asc" }, { createdAt: "asc" }],
    }),
    prisma.task.findMany({
      where: {
        userId,
        status: { in: incompleteTaskStatuses },
      },
      orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { priority: "asc" }, { createdAt: "asc" }],
      take: 5,
    }),
    prisma.aiInsight.findMany({
      where: {
        userId,
        scope: { in: ["daily", "weekly"] },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return {
    date: range.date,
    checkin,
    latestCheckinLog,
    todayCheckinLogs,
    nextCalendarEvent,
    todayBlocks,
    topTasks,
    insights,
  };
}
