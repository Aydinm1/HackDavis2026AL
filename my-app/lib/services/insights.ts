import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const allowedGenerateInsightFields = ["scope", "planningCycleId", "date", "start", "end", "trigger"] as const;
const allowedCurrentInsightScopes = new Set(["daily", "weekly"]);
const allowedGenerateInsightScopes = new Set(["daily", "weekly", "planning_session"]);
const incompleteTaskStatuses = ["todo", "scheduled", "in_progress", "deferred"];

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; status?: number };

type GenerateInsightInput = {
  scope: "daily" | "weekly" | "planning_session";
  planningCycleId?: string;
  date?: string;
  start?: Date;
  end?: Date;
  trigger?: "manual" | "checkin" | "task_added" | "weekly_planning";
};

type InsightRecommendation = {
  type:
    | "work_now"
    | "schedule_task"
    | "move_block"
    | "shorten_block"
    | "skip_or_defer"
    | "protect_break"
    | "recovery_window"
    | "regenerate_schedule";
  title: string;
  reason: string;
  taskId?: string | null;
  scheduledBlockId?: string | null;
  startTime?: string;
  endTime?: string;
  priority?: number;
  cognitiveLoad?: number;
  estimatedMinutes?: number | null;
};

type BusyWindow = {
  startTime: Date;
  endTime: Date;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejectUnknownFields(body: Record<string, unknown>, allowedFields: readonly string[]) {
  const allowed = new Set(allowedFields);
  const unknown = Object.keys(body).filter((key) => !allowed.has(key));

  if (unknown.length > 0) {
    return `Unsupported field(s): ${unknown.join(", ")}.`;
  }

  return null;
}

function parseString(value: unknown, field: string): ValidationResult<string | undefined> {
  if (value === undefined || value === null) {
    return { ok: true, value: undefined };
  }

  if (typeof value !== "string") {
    return { ok: false, error: `${field} must be a string.` };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, error: `${field} cannot be empty.` };
  }

  return { ok: true, value: trimmed };
}

function parseDate(value: unknown, field: string): ValidationResult<Date | undefined> {
  if (value === undefined || value === null) {
    return { ok: true, value: undefined };
  }

  if (typeof value !== "string") {
    return { ok: false, error: `${field} must be an ISO date string.` };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false, error: `${field} must be a valid ISO date string.` };
  }

  return { ok: true, value: parsed };
}

function parseDateOnly(value: unknown): ValidationResult<string | undefined> {
  if (value === undefined || value === null) {
    return { ok: true, value: undefined };
  }

  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { ok: false, error: "date must be in YYYY-MM-DD format." };
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return { ok: false, error: "date must be a valid calendar date." };
  }

  return { ok: true, value };
}

function startOfDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function minutesBetween(startTime: Date, endTime: Date) {
  return Math.max(0, Math.round((endTime.getTime() - startTime.getTime()) / 60_000));
}

function overlaps(a: BusyWindow, b: BusyWindow) {
  return a.startTime < b.endTime && a.endTime > b.startTime;
}

function clampWindow(window: BusyWindow, range: BusyWindow) {
  return {
    startTime: window.startTime < range.startTime ? range.startTime : window.startTime,
    endTime: window.endTime > range.endTime ? range.endTime : window.endTime,
  };
}

function taskUrgencyScore(task: { dueAt: Date | null; priority: number; cognitiveLoad: number }, rangeStart: Date) {
  const hoursUntilDue = task.dueAt ? Math.max(0, (task.dueAt.getTime() - rangeStart.getTime()) / 3_600_000) : 24 * 30;
  const deadlineScore = task.dueAt ? Math.max(0, 120 - hoursUntilDue) : 0;
  return deadlineScore + (6 - task.priority) * 22 + task.cognitiveLoad * 2;
}

function findFreeWindows(range: BusyWindow, busyWindows: BusyWindow[], minimumMinutes: number) {
  const sorted = busyWindows
    .filter((window) => overlaps(window, range))
    .map((window) => clampWindow(window, range))
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  const freeWindows: BusyWindow[] = [];
  let cursor = range.startTime;

  for (const window of sorted) {
    if (window.startTime > cursor && minutesBetween(cursor, window.startTime) >= minimumMinutes) {
      freeWindows.push({ startTime: cursor, endTime: window.startTime });
    }

    if (window.endTime > cursor) {
      cursor = window.endTime;
    }
  }

  if (range.endTime > cursor && minutesBetween(cursor, range.endTime) >= minimumMinutes) {
    freeWindows.push({ startTime: cursor, endTime: range.endTime });
  }

  return freeWindows;
}

export function validateCurrentInsightsQuery(searchParams: URLSearchParams): ValidationResult<{
  scope?: "daily" | "weekly";
  limit: number;
}> {
  const rawScope = searchParams.get("scope");
  if (rawScope && !allowedCurrentInsightScopes.has(rawScope)) {
    return { ok: false, error: "scope must be daily or weekly." };
  }

  const rawLimit = searchParams.get("limit");
  const limit = rawLimit ? Number(rawLimit) : 5;
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    return { ok: false, error: "limit must be an integer from 1 to 20." };
  }

  return { ok: true, value: { scope: rawScope as "daily" | "weekly" | undefined, limit } };
}

export function validateGenerateInsightBody(body: unknown): ValidationResult<GenerateInsightInput> {
  if (!isRecord(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const unknownFieldsError = rejectUnknownFields(body, allowedGenerateInsightFields);
  if (unknownFieldsError) {
    return { ok: false, error: unknownFieldsError };
  }

  const scope = parseString(body.scope, "scope");
  if (!scope.ok) return scope;
  if (!scope.value || !allowedGenerateInsightScopes.has(scope.value)) {
    return { ok: false, error: "scope must be daily, weekly, or planning_session." };
  }

  const planningCycleId = parseString(body.planningCycleId, "planningCycleId");
  if (!planningCycleId.ok) return planningCycleId;

  const date = parseDateOnly(body.date);
  if (!date.ok) return date;

  const start = parseDate(body.start, "start");
  if (!start.ok) return start;

  const end = parseDate(body.end, "end");
  if (!end.ok) return end;

  if ((start.value && !end.value) || (!start.value && end.value)) {
    return { ok: false, error: "start and end must be provided together." };
  }

  if (start.value && end.value && end.value <= start.value) {
    return { ok: false, error: "end must be after start." };
  }

  const trigger = parseString(body.trigger, "trigger");
  if (!trigger.ok) return trigger;
  if (trigger.value && !["manual", "checkin", "task_added", "weekly_planning"].includes(trigger.value)) {
    return { ok: false, error: "trigger must be manual, checkin, task_added, or weekly_planning." };
  }

  return {
    ok: true,
    value: {
      scope: scope.value as GenerateInsightInput["scope"],
      planningCycleId: planningCycleId.value,
      date: date.value,
      start: start.value,
      end: end.value,
      trigger: trigger.value as GenerateInsightInput["trigger"],
    },
  };
}

export async function listCurrentInsights(
  userId: string,
  input: { scope?: "daily" | "weekly"; limit: number },
) {
  return prisma.aiInsight.findMany({
    where: {
      userId,
      ...(input.scope ? { scope: input.scope } : { scope: { in: ["daily", "weekly"] } }),
    },
    orderBy: { createdAt: "desc" },
    take: input.limit,
  });
}

async function resolveInsightRange(userId: string, input: GenerateInsightInput) {
  if (input.start && input.end) {
    return { ok: true as const, value: { start: input.start, end: input.end, planningCycleId: input.planningCycleId } };
  }

  if (input.date) {
    const start = startOfDate(input.date);
    return {
      ok: true as const,
      value: {
        start,
        end: addMinutes(start, input.scope === "daily" ? 24 * 60 : 7 * 24 * 60),
        planningCycleId: input.planningCycleId,
      },
    };
  }

  const cycle = input.planningCycleId
    ? await prisma.planningCycle.findFirst({
        where: { id: input.planningCycleId, userId },
        select: { id: true, cycleStartDate: true, cycleEndDate: true },
      })
    : await prisma.planningCycle.findFirst({
        where: { userId, status: "active" },
        select: { id: true, cycleStartDate: true, cycleEndDate: true },
        orderBy: { cycleStartDate: "desc" },
      });

  if (input.planningCycleId && !cycle) {
    return { ok: false as const, error: "planningCycleId was not found for this user.", status: 400 };
  }

  if (cycle) {
    return {
      ok: true as const,
      value: {
        start: cycle.cycleStartDate,
        end: cycle.cycleEndDate,
        planningCycleId: cycle.id,
      },
    };
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return {
    ok: true as const,
    value: {
      start,
      end: addMinutes(start, input.scope === "daily" ? 24 * 60 : 7 * 24 * 60),
      planningCycleId: input.planningCycleId,
    },
  };
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function generateInsight(userId: string, input: GenerateInsightInput) {
  const resolvedRange = await resolveInsightRange(userId, input);
  if (!resolvedRange.ok) {
    return resolvedRange;
  }

  const range = resolvedRange.value;
  const [tasks, calendarEvents, scheduledBlocks, latestCheckinLog, checkinTimeline] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId,
        status: { in: incompleteTaskStatuses },
        ...(range.planningCycleId ? { planningCycleId: range.planningCycleId } : {}),
      },
      include: {
        taskBreakdowns: { orderBy: { sequenceOrder: "asc" } },
        scheduledBlocks: {
          where: { status: { in: ["proposed", "accepted", "rescheduled"] } },
          orderBy: { startTime: "asc" },
        },
      },
    }),
    prisma.calendarEvent.findMany({
      where: {
        userId,
        status: { not: "cancelled" },
        startTime: { lt: range.end },
        endTime: { gt: range.start },
      },
      orderBy: { startTime: "asc" },
    }),
    prisma.scheduledBlock.findMany({
      where: {
        userId,
        status: { in: ["proposed", "accepted", "rescheduled"] },
        startTime: { lt: range.end },
        endTime: { gt: range.start },
      },
      include: { task: true, taskBreakdown: true },
      orderBy: { startTime: "asc" },
    }),
    prisma.checkinLog.findFirst({
      where: {
        userId,
        loggedAt: { lte: range.end },
      },
      orderBy: { loggedAt: "desc" },
    }),
    prisma.checkinLog.findMany({
      where: {
        userId,
        loggedAt: { gte: range.start, lt: range.end },
      },
      orderBy: { loggedAt: "asc" },
    }),
  ]);

  const busyWindows = [
    ...calendarEvents.map(({ startTime, endTime }) => ({ startTime, endTime })),
    ...scheduledBlocks.map(({ startTime, endTime }) => ({ startTime, endTime })),
  ];
  const scoredTasks = tasks
    .map((task) => ({
      task,
      score: taskUrgencyScore(task, range.start),
      scheduledMinutes: task.scheduledBlocks.reduce(
        (total, block) => total + minutesBetween(block.startTime, block.endTime),
        0,
      ),
    }))
    .sort((a, b) => b.score - a.score);
  const topTask = scoredTasks[0]?.task;
  const recommendations: InsightRecommendation[] = [];
  const lowCapacity = Boolean(latestCheckinLog && (latestCheckinLog.energyScore <= 2 || latestCheckinLog.stressScore >= 6));

  if (topTask) {
    recommendations.push({
      type: "work_now",
      title: topTask.title,
      taskId: topTask.id,
      priority: topTask.priority,
      cognitiveLoad: topTask.cognitiveLoad,
      estimatedMinutes: topTask.estimatedMinutes,
      reason: `Highest current score from priority ${topTask.priority}, cognitive load ${topTask.cognitiveLoad}/7, and ${topTask.dueAt ? `due date ${topTask.dueAt.toISOString()}` : "no fixed due date"}.`,
    });
  }

  for (const item of scoredTasks.slice(0, 4)) {
    const remainingMinutes = Math.max((item.task.estimatedMinutes ?? 45) - item.scheduledMinutes, 0);
    if (remainingMinutes > 0 && item.task.priority <= 2) {
      recommendations.push({
        type: "schedule_task",
        title: item.task.title,
        taskId: item.task.id,
        priority: item.task.priority,
        cognitiveLoad: item.task.cognitiveLoad,
        estimatedMinutes: remainingMinutes,
        reason: "High-priority work still has unscheduled estimated time.",
      });
    }
  }

  if (lowCapacity) {
    const highLoadBlock = scheduledBlocks.find((block) => (block.task?.cognitiveLoad ?? 0) >= 6);
    if (highLoadBlock) {
      recommendations.push({
        type: "shorten_block",
        title: highLoadBlock.title,
        scheduledBlockId: highLoadBlock.id,
        taskId: highLoadBlock.taskId,
        startTime: highLoadBlock.startTime.toISOString(),
        endTime: highLoadBlock.endTime.toISOString(),
        cognitiveLoad: highLoadBlock.task?.cognitiveLoad,
        reason: "Latest check-in shows low energy or high stress, so shorten or move one deep-work block.",
      });
    }
  }

  const freeWindows = findFreeWindows({ startTime: range.start, endTime: range.end }, busyWindows, lowCapacity ? 45 : 90);
  const recoveryWindow = freeWindows.find((window) => {
    const day = window.startTime.getUTCDay();
    return day === 0 || day === 6 || minutesBetween(window.startTime, window.endTime) >= 120;
  }) ?? freeWindows[0];

  if (recoveryWindow) {
    recommendations.push({
      type: input.scope === "daily" ? "protect_break" : "recovery_window",
      title: input.scope === "daily" ? "Protect a break window" : "Protect a recovery window",
      startTime: recoveryWindow.startTime.toISOString(),
      endTime: recoveryWindow.endTime.toISOString(),
      reason: "This is an open window with no fixed calendar event or active scheduled block.",
    });
  }

  if (recommendations.some((recommendation) => recommendation.type === "schedule_task" || recommendation.type === "shorten_block")) {
    recommendations.push({
      type: "regenerate_schedule",
      title: "Generate a revised schedule proposal",
      reason: "The current plan has high-priority unscheduled work or high-load blocks that may need adjustment.",
    });
  }

  const totalScheduledMinutes = scheduledBlocks.reduce(
    (total, block) => total + minutesBetween(block.startTime, block.endTime),
    0,
  );
  const hardScheduledMinutes = scheduledBlocks.reduce(
    (total, block) => total + ((block.task?.cognitiveLoad ?? 0) >= 6 ? minutesBetween(block.startTime, block.endTime) : 0),
    0,
  );
  const dailyTotals = scheduledBlocks.reduce<Record<string, number>>((totals, block) => {
    const key = dayKey(block.startTime);
    totals[key] = (totals[key] ?? 0) + minutesBetween(block.startTime, block.endTime);
    return totals;
  }, {});
  const overloadedDays = Object.entries(dailyTotals)
    .filter(([, minutes]) => minutes >= 300)
    .map(([date, minutes]) => ({ date, minutes }));
  const severity = lowCapacity || overloadedDays.length > 0 || hardScheduledMinutes >= 180 ? "caution" : "info";
  const storedScope = input.scope === "planning_session" ? "weekly" : input.scope;
  const title = input.scope === "daily"
    ? lowCapacity
      ? "Use a lighter plan today"
      : "Focus today on the highest-impact work"
    : overloadedDays.length > 0
      ? "This week needs a workload adjustment"
      : "Weekly plan has room for recovery";
  const body = recommendations.length > 0
    ? recommendations.slice(0, 3).map((recommendation) => recommendation.reason).join(" ")
    : "No major planning risks found from the current tasks, calendar, and check-in data.";

  const insight = await prisma.aiInsight.create({
    data: {
      userId,
      planningCycleId: range.planningCycleId,
      checkinLogId: input.scope === "daily" ? latestCheckinLog?.id : undefined,
      scope: storedScope,
      insightType: input.scope === "daily"
        ? lowCapacity
          ? "low_energy_plan"
          : "daily_planning"
        : "weekly_planning",
      title,
      body,
      severity,
      confidenceScore: 0.78,
      sourceData: {
        trigger: input.trigger ?? "manual",
        range: { start: range.start.toISOString(), end: range.end.toISOString() },
        latestCheckin: latestCheckinLog
          ? {
              id: latestCheckinLog.id,
              loggedAt: latestCheckinLog.loggedAt.toISOString(),
              energyScore: latestCheckinLog.energyScore,
              stressScore: latestCheckinLog.stressScore,
              availableCapacityMinutes: latestCheckinLog.availableCapacityMinutes,
            }
          : null,
        checkinTimeline: checkinTimeline.map((log) => ({
          id: log.id,
          loggedAt: log.loggedAt.toISOString(),
          energyScore: log.energyScore,
          stressScore: log.stressScore,
          availableCapacityMinutes: log.availableCapacityMinutes,
          userNote: log.userNote,
          source: log.source,
        })),
        totalScheduledMinutes,
        hardScheduledMinutes,
        overloadedDays,
        recommendations,
      } satisfies Prisma.InputJsonObject,
    },
  });

  return {
    ok: true as const,
    value: {
      insight,
      recommendations,
      summary: {
        range: { start: range.start, end: range.end },
        totalScheduledMinutes,
        hardScheduledMinutes,
        overloadedDays,
        topTaskId: topTask?.id ?? null,
      },
    },
  };
}
