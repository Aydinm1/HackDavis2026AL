import { prisma } from "@/lib/db";

const allowedDailyCheckinFields = [
  "planningCycleId",
  "checkinDate",
  "loggedAt",
  "energyScore",
  "stressScore",
  "availableCapacityMinutes",
  "userNote",
  "adjustToday",
  "source",
] as const;
const allowedCheckinLogFields = [
  "planningCycleId",
  "loggedAt",
  "energyScore",
  "stressScore",
  "availableCapacityMinutes",
  "userNote",
  "adjustToday",
  "source",
] as const;
const allowedCheckinLogSources = new Set(["manual", "chat", "voice", "image", "system"]);

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; status?: number };

type DailyCheckinInput = {
  planningCycleId?: string | null;
  checkinDate: Date;
  loggedAt?: Date;
  energyScore: number;
  stressScore: number;
  availableCapacityMinutes?: number | null;
  userNote?: string | null;
  adjustToday?: boolean;
  source?: string;
};

type CheckinLogInput = Omit<DailyCheckinInput, "checkinDate"> & {
  loggedAt: Date;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseString(value: unknown, field: string, required = false): ValidationResult<string | undefined> {
  if (value === undefined || value === null) {
    return required ? { ok: false, error: `${field} is required.` } : { ok: true, value: undefined };
  }

  if (typeof value !== "string") {
    return { ok: false, error: `${field} must be a string.` };
  }

  const trimmed = value.trim();
  if (required && !trimmed) {
    return { ok: false, error: `${field} is required.` };
  }

  return { ok: true, value: trimmed || undefined };
}

function parseNullableString(value: unknown, field: string): ValidationResult<string | null | undefined> {
  if (value === undefined) {
    return { ok: true, value: undefined };
  }

  if (value === null) {
    return { ok: true, value: null };
  }

  return parseString(value, field);
}

function parseInteger(
  value: unknown,
  field: string,
  options: { min?: number; max?: number; nullable?: boolean } = {},
): ValidationResult<number | null | undefined> {
  if (value === undefined) {
    return { ok: true, value: undefined };
  }

  if (value === null && options.nullable) {
    return { ok: true, value: null };
  }

  if (typeof value !== "number" || !Number.isInteger(value)) {
    return { ok: false, error: `${field} must be an integer.` };
  }

  if (options.min !== undefined && value < options.min) {
    return { ok: false, error: `${field} must be at least ${options.min}.` };
  }

  if (options.max !== undefined && value > options.max) {
    return { ok: false, error: `${field} must be at most ${options.max}.` };
  }

  return { ok: true, value };
}

function parseBoolean(value: unknown, field: string): ValidationResult<boolean | undefined> {
  if (value === undefined) {
    return { ok: true, value: undefined };
  }

  if (typeof value !== "boolean") {
    return { ok: false, error: `${field} must be a boolean.` };
  }

  return { ok: true, value };
}

function parseCheckinDate(value: unknown): ValidationResult<Date> {
  if (typeof value !== "string" || !value.trim()) {
    return { ok: false, error: "checkinDate is required and must be an ISO date string." };
  }

  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!dateOnly) {
    return { ok: false, error: "checkinDate must start with YYYY-MM-DD." };
  }

  const year = Number(dateOnly[1]);
  const month = Number(dateOnly[2]);
  const day = Number(dateOnly[3]);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return { ok: false, error: "checkinDate must be a valid date." };
  }

  return { ok: true, value: date };
}

function parseOptionalDateTime(value: unknown, field: string): ValidationResult<Date | undefined> {
  if (value === undefined || value === null || value === "") {
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

function rejectUnknownFields(body: Record<string, unknown>, allowedFields: readonly string[]) {
  const allowed = new Set(allowedFields);
  const unknown = Object.keys(body).filter((key) => !allowed.has(key));

  if (unknown.length > 0) {
    return `Unsupported field(s): ${unknown.join(", ")}.`;
  }

  return null;
}

function getDateKey(date: Date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "_");
}

function buildDailyInsight(input: DailyCheckinInput) {
  if (input.energyScore <= 2 || input.stressScore >= 6) {
    return {
      insightType: "low_energy_plan",
      title: "Use a lighter plan today",
      body: "Your check-in suggests today is a high-stress or low-energy day. Prioritize fixed events, one essential focus block, and move lower-priority work to another day.",
      severity: "caution",
      confidenceScore: 0.86,
    };
  }

  return {
    insightType: "daily_capacity_plan",
    title: "Keep today focused and realistic",
    body: "Your check-in looks workable. Keep the plan focused on the most important blocks and leave a small buffer between demanding tasks.",
    severity: "info",
    confidenceScore: 0.72,
  };
}

function startOfLocalDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function getTodayRange() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  const start = new Date(`${year}-${month}-${day}T00:00:00-07:00`);

  return {
    start,
    end: new Date(start.getTime() + 24 * 60 * 60_000),
  };
}

function minutesBetween(startTime: Date, endTime: Date) {
  return Math.max(0, Math.round((endTime.getTime() - startTime.getTime()) / 60_000));
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(date.getDate() + days);
  return result;
}

type AdjustmentAction = "keep" | "shorten" | "move" | "skip" | "replace_with_lower_load_task";

type AdjustmentCheckin = {
  id: string;
  energyScore: number;
  stressScore: number;
  availableCapacityMinutes: number | null;
  planningCycleId: string | null;
};

type AdjustmentBlock = {
  id: string;
  taskId: string | null;
  title: string;
  startTime: Date;
  endTime: Date;
  status: string;
  task: {
    id: string;
    title: string;
    priority: number;
    cognitiveLoad: number;
    dueAt: Date | null;
    estimatedMinutes: number | null;
    workType: string;
  } | null;
};

type ReplacementTask = {
  id: string;
  title: string;
  priority: number;
  cognitiveLoad: number;
  dueAt: Date | null;
  estimatedMinutes: number | null;
};

export type TodayScheduleAdjustment = {
  action: AdjustmentAction;
  scheduledBlockId: string;
  taskId: string | null;
  title: string;
  currentStartTime: Date;
  currentEndTime: Date;
  currentDurationMinutes: number;
  suggestedDurationMinutes: number | null;
  cognitiveLoad: number | null;
  priority: number | null;
  reason: string;
  replacementTask?: ReplacementTask;
};

function isOverloaded(checkin: AdjustmentCheckin | null) {
  return Boolean(checkin && (checkin.energyScore <= 2 || checkin.stressScore >= 6));
}

function isUrgentTask(task: AdjustmentBlock["task"], now: Date) {
  if (!task) return false;
  if (task.priority <= 2) return true;
  if (!task.dueAt) return false;

  return task.dueAt <= addDays(now, 1);
}

export function buildTodayScheduleAdjustmentSuggestions(input: {
  checkin: AdjustmentCheckin | null;
  blocks: AdjustmentBlock[];
  replacementTasks: ReplacementTask[];
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const overloaded = isOverloaded(input.checkin);
  const replacementTasks = [...input.replacementTasks];
  let scheduledMinutes = 0;

  return input.blocks.map<TodayScheduleAdjustment>((block) => {
    const duration = minutesBetween(block.startTime, block.endTime);
    scheduledMinutes += duration;
    const task = block.task;
    const cognitiveLoad = task?.cognitiveLoad ?? null;
    const priority = task?.priority ?? null;
    const highLoad = (cognitiveLoad ?? 4) >= 6;
    const urgent = isUrgentTask(task, now);
    const overCapacity =
      input.checkin?.availableCapacityMinutes !== null &&
      input.checkin?.availableCapacityMinutes !== undefined &&
      scheduledMinutes > input.checkin.availableCapacityMinutes;

    if (!overloaded && !overCapacity) {
      return {
        action: "keep",
        scheduledBlockId: block.id,
        taskId: block.taskId,
        title: block.title,
        currentStartTime: block.startTime,
        currentEndTime: block.endTime,
        currentDurationMinutes: duration,
        suggestedDurationMinutes: duration,
        cognitiveLoad,
        priority,
        reason: "Today's check-in does not require changing this block.",
      };
    }

    if (highLoad && urgent && duration > 45) {
      return {
        action: "shorten",
        scheduledBlockId: block.id,
        taskId: block.taskId,
        title: block.title,
        currentStartTime: block.startTime,
        currentEndTime: block.endTime,
        currentDurationMinutes: duration,
        suggestedDurationMinutes: Math.max(25, Math.min(45, Math.ceil(duration / 2))),
        cognitiveLoad,
        priority,
        reason:
          "This is urgent but demanding. Keep it on the plan, but shorten it into a more realistic focus block today.",
      };
    }

    if (highLoad && urgent) {
      return {
        action: "keep",
        scheduledBlockId: block.id,
        taskId: block.taskId,
        title: block.title,
        currentStartTime: block.startTime,
        currentEndTime: block.endTime,
        currentDurationMinutes: duration,
        suggestedDurationMinutes: duration,
        cognitiveLoad,
        priority,
        reason: "This block is high-load, but it is urgent enough to keep as today's essential work.",
      };
    }

    if (highLoad) {
      const replacementTask = replacementTasks.shift();

      if (replacementTask) {
        return {
          action: "replace_with_lower_load_task",
          scheduledBlockId: block.id,
          taskId: block.taskId,
          title: block.title,
          currentStartTime: block.startTime,
          currentEndTime: block.endTime,
          currentDurationMinutes: duration,
          suggestedDurationMinutes: Math.min(duration, replacementTask.estimatedMinutes ?? duration),
          cognitiveLoad,
          priority,
          replacementTask,
          reason:
            "Today's check-in suggests avoiding non-urgent deep work. Swap this for a lower-load task if possible.",
        };
      }

      return {
        action: overCapacity ? "skip" : "move",
        scheduledBlockId: block.id,
        taskId: block.taskId,
        title: block.title,
        currentStartTime: block.startTime,
        currentEndTime: block.endTime,
        currentDurationMinutes: duration,
        suggestedDurationMinutes: null,
        cognitiveLoad,
        priority,
        reason: overCapacity
          ? "This demanding block pushes today beyond your available capacity. Skip it for today and reschedule later."
          : "This is non-urgent deep work. Move it to a day with better energy if possible.",
      };
    }

    if (overCapacity && priority !== null && priority >= 4) {
      return {
        action: "skip",
        scheduledBlockId: block.id,
        taskId: block.taskId,
        title: block.title,
        currentStartTime: block.startTime,
        currentEndTime: block.endTime,
        currentDurationMinutes: duration,
        suggestedDurationMinutes: null,
        cognitiveLoad,
        priority,
        reason: "This lower-priority block exceeds today's available capacity, so it is a good candidate to skip.",
      };
    }

    return {
      action: "keep",
      scheduledBlockId: block.id,
      taskId: block.taskId,
      title: block.title,
      currentStartTime: block.startTime,
      currentEndTime: block.endTime,
      currentDurationMinutes: duration,
      suggestedDurationMinutes: duration,
      cognitiveLoad,
      priority,
      reason: "This block is light enough to keep even with today's check-in.",
    };
  });
}

export function validateDailyCheckinBody(body: unknown): ValidationResult<DailyCheckinInput> {
  if (!isRecord(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const unknownFieldsError = rejectUnknownFields(body, allowedDailyCheckinFields);
  if (unknownFieldsError) {
    return { ok: false, error: unknownFieldsError };
  }

  const planningCycleId = parseNullableString(body.planningCycleId, "planningCycleId");
  if (!planningCycleId.ok) return planningCycleId;

  const checkinDate = parseCheckinDate(body.checkinDate);
  if (!checkinDate.ok) return checkinDate;

  const loggedAt = parseOptionalDateTime(body.loggedAt, "loggedAt");
  if (!loggedAt.ok) return loggedAt;

  const energyScore = parseInteger(body.energyScore, "energyScore", { min: 1, max: 7 });
  if (!energyScore.ok) return energyScore;

  const stressScore = parseInteger(body.stressScore, "stressScore", { min: 1, max: 7 });
  if (!stressScore.ok) return stressScore;

  if (energyScore.value === undefined || energyScore.value === null) {
    return { ok: false, error: "energyScore is required." };
  }

  if (stressScore.value === undefined || stressScore.value === null) {
    return { ok: false, error: "stressScore is required." };
  }

  const availableCapacityMinutes = parseInteger(body.availableCapacityMinutes, "availableCapacityMinutes", {
    min: 0,
    nullable: true,
  });
  if (!availableCapacityMinutes.ok) return availableCapacityMinutes;

  const userNote = parseNullableString(body.userNote, "userNote");
  if (!userNote.ok) return userNote;

  const adjustToday = parseBoolean(body.adjustToday, "adjustToday");
  if (!adjustToday.ok) return adjustToday;

  const source = parseString(body.source, "source");
  if (!source.ok) return source;
  if (source.value && !allowedCheckinLogSources.has(source.value)) {
    return { ok: false, error: "source must be manual, chat, voice, image, or system." };
  }

  return {
    ok: true,
    value: {
      planningCycleId: planningCycleId.value,
      checkinDate: checkinDate.value,
      loggedAt: loggedAt.value,
      energyScore: energyScore.value,
      stressScore: stressScore.value,
      availableCapacityMinutes: availableCapacityMinutes.value,
      userNote: userNote.value,
      adjustToday: adjustToday.value,
      source: source.value,
    },
  };
}

export function validateCheckinLogBody(body: unknown): ValidationResult<CheckinLogInput> {
  if (!isRecord(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const unknownFieldsError = rejectUnknownFields(body, allowedCheckinLogFields);
  if (unknownFieldsError) {
    return { ok: false, error: unknownFieldsError };
  }

  const planningCycleId = parseNullableString(body.planningCycleId, "planningCycleId");
  if (!planningCycleId.ok) return planningCycleId;

  const loggedAt = parseOptionalDateTime(body.loggedAt, "loggedAt");
  if (!loggedAt.ok) return loggedAt;

  const energyScore = parseInteger(body.energyScore, "energyScore", { min: 1, max: 7 });
  if (!energyScore.ok) return energyScore;

  const stressScore = parseInteger(body.stressScore, "stressScore", { min: 1, max: 7 });
  if (!stressScore.ok) return stressScore;

  if (energyScore.value === undefined || energyScore.value === null) {
    return { ok: false, error: "energyScore is required." };
  }

  if (stressScore.value === undefined || stressScore.value === null) {
    return { ok: false, error: "stressScore is required." };
  }

  const availableCapacityMinutes = parseInteger(body.availableCapacityMinutes, "availableCapacityMinutes", {
    min: 0,
    nullable: true,
  });
  if (!availableCapacityMinutes.ok) return availableCapacityMinutes;

  const userNote = parseNullableString(body.userNote, "userNote");
  if (!userNote.ok) return userNote;

  const adjustToday = parseBoolean(body.adjustToday, "adjustToday");
  if (!adjustToday.ok) return adjustToday;

  const source = parseString(body.source, "source");
  if (!source.ok) return source;
  if (source.value && !allowedCheckinLogSources.has(source.value)) {
    return { ok: false, error: "source must be manual, chat, voice, image, or system." };
  }

  return {
    ok: true,
    value: {
      planningCycleId: planningCycleId.value,
      loggedAt: loggedAt.value ?? new Date(),
      energyScore: energyScore.value,
      stressScore: stressScore.value,
      availableCapacityMinutes: availableCapacityMinutes.value,
      userNote: userNote.value,
      adjustToday: adjustToday.value,
      source: source.value,
    },
  };
}

async function validatePlanningCycle(userId: string, planningCycleId?: string | null) {
  if (!planningCycleId) return { ok: true as const };

  const cycle = await prisma.planningCycle.findFirst({
    where: { id: planningCycleId, userId },
    select: { id: true },
  });

  if (!cycle) {
    return { ok: false as const, error: "planningCycleId was not found for this user.", status: 400 };
  }

  return { ok: true as const };
}

async function recentCheckinLogs(userId: string, start: Date, end: Date) {
  return prisma.checkinLog.findMany({
    where: {
      userId,
      loggedAt: { gte: start, lt: end },
    },
    orderBy: { loggedAt: "asc" },
  });
}

async function createInsightForCheckinLog(params: {
  userId: string;
  input: DailyCheckinInput;
  checkinId: string;
  checkinLogId: string;
  dayStart: Date;
}) {
  const dailyInsight = buildDailyInsight(params.input);
  const dayEnd = new Date(params.dayStart.getTime() + 24 * 60 * 60_000);
  const timeline = await recentCheckinLogs(params.userId, params.dayStart, dayEnd);

  return prisma.aiInsight.upsert({
    where: { id: `demo_daily_adjustment_${getDateKey(params.dayStart)}` },
    update: {
      planningCycleId: params.input.planningCycleId ?? null,
      dailyCheckinId: params.checkinId,
      checkinLogId: params.checkinLogId,
      scope: "daily",
      ...dailyInsight,
      sourceData: {
        energyScore: params.input.energyScore,
        stressScore: params.input.stressScore,
        availableCapacityMinutes: params.input.availableCapacityMinutes ?? null,
        userNote: params.input.userNote ?? null,
        checkinLogId: params.checkinLogId,
        checkinTimeline: timeline.map((log) => ({
          id: log.id,
          loggedAt: log.loggedAt.toISOString(),
          energyScore: log.energyScore,
          stressScore: log.stressScore,
          availableCapacityMinutes: log.availableCapacityMinutes,
          userNote: log.userNote,
          source: log.source,
        })),
        demo: true,
      },
    },
    create: {
      id: `demo_daily_adjustment_${getDateKey(params.dayStart)}`,
      userId: params.userId,
      planningCycleId: params.input.planningCycleId ?? null,
      dailyCheckinId: params.checkinId,
      checkinLogId: params.checkinLogId,
      scope: "daily",
      ...dailyInsight,
      sourceData: {
        energyScore: params.input.energyScore,
        stressScore: params.input.stressScore,
        availableCapacityMinutes: params.input.availableCapacityMinutes ?? null,
        userNote: params.input.userNote ?? null,
        checkinLogId: params.checkinLogId,
        checkinTimeline: timeline.map((log) => ({
          id: log.id,
          loggedAt: log.loggedAt.toISOString(),
          energyScore: log.energyScore,
          stressScore: log.stressScore,
          availableCapacityMinutes: log.availableCapacityMinutes,
          userNote: log.userNote,
          source: log.source,
        })),
        demo: true,
      },
    },
  });
}

export async function createCheckinLog(userId: string, input: CheckinLogInput) {
  const cycleValidation = await validatePlanningCycle(userId, input.planningCycleId);
  if (!cycleValidation.ok) return cycleValidation;

  const dayStart = startOfLocalDay(input.loggedAt);
  const checkinLog = await prisma.checkinLog.create({
    data: {
      userId,
      planningCycleId: input.planningCycleId,
      loggedAt: input.loggedAt,
      energyScore: input.energyScore,
      stressScore: input.stressScore,
      availableCapacityMinutes: input.availableCapacityMinutes,
      userNote: input.userNote,
      source: input.source ?? "manual",
    },
  });

  const checkin = await prisma.dailyCheckin.upsert({
    where: {
      userId_checkinDate: {
        userId,
        checkinDate: dayStart,
      },
    },
    update: {
      planningCycleId: input.planningCycleId,
      energyScore: input.energyScore,
      stressScore: input.stressScore,
      availableCapacityMinutes: input.availableCapacityMinutes,
      userNote: input.userNote,
    },
    create: {
      userId,
      planningCycleId: input.planningCycleId,
      checkinDate: dayStart,
      energyScore: input.energyScore,
      stressScore: input.stressScore,
      availableCapacityMinutes: input.availableCapacityMinutes,
      userNote: input.userNote,
    },
    include: {
      aiInsights: true,
    },
  });

  let insight = null;

  if (input.adjustToday) {
    insight = await createInsightForCheckinLog({
      userId,
      input: { ...input, checkinDate: dayStart },
      checkinId: checkin.id,
      checkinLogId: checkinLog.id,
      dayStart,
    });
  }

  return { ok: true as const, value: { checkin, checkinLog, insight } };
}

export async function upsertDailyCheckin(userId: string, input: DailyCheckinInput) {
  if (input.planningCycleId) {
    const cycleValidation = await validatePlanningCycle(userId, input.planningCycleId);
    if (!cycleValidation.ok) return cycleValidation;
  }

  const loggedAt = input.loggedAt ?? input.checkinDate;
  const checkinLog = await prisma.checkinLog.create({
    data: {
      userId,
      planningCycleId: input.planningCycleId,
      loggedAt,
      energyScore: input.energyScore,
      stressScore: input.stressScore,
      availableCapacityMinutes: input.availableCapacityMinutes,
      userNote: input.userNote,
      source: input.source ?? "manual",
    },
  });

  const checkin = await prisma.dailyCheckin.upsert({
    where: {
      userId_checkinDate: {
        userId,
        checkinDate: input.checkinDate,
      },
    },
    update: {
      planningCycleId: input.planningCycleId,
      energyScore: input.energyScore,
      stressScore: input.stressScore,
      availableCapacityMinutes: input.availableCapacityMinutes,
      userNote: input.userNote,
    },
    create: {
      userId,
      planningCycleId: input.planningCycleId,
      checkinDate: input.checkinDate,
      energyScore: input.energyScore,
      stressScore: input.stressScore,
      availableCapacityMinutes: input.availableCapacityMinutes,
      userNote: input.userNote,
    },
    include: {
      aiInsights: true,
    },
  });

  let insight = null;

  if (input.adjustToday) {
    insight = await createInsightForCheckinLog({
      userId,
      input,
      checkinId: checkin.id,
      checkinLogId: checkinLog.id,
      dayStart: input.checkinDate,
    });
  }

  return { ok: true as const, value: { checkin, checkinLog, insight } };
}

export async function listCheckinLogs(userId: string, range: { start: Date; end: Date }) {
  return prisma.checkinLog.findMany({
    where: {
      userId,
      loggedAt: {
        gte: range.start,
        lt: range.end,
      },
    },
    orderBy: { loggedAt: "asc" },
  });
}

export async function listDailyCheckins(userId: string, range: { start: Date; end: Date }) {
  return prisma.dailyCheckin.findMany({
    where: {
      userId,
      checkinDate: {
        gte: range.start,
        lt: range.end,
      },
    },
    include: {
      aiInsights: true,
    },
    orderBy: { checkinDate: "asc" },
  });
}

export async function getTodayScheduleAdjustments(userId: string) {
  const today = getTodayRange();

  const [checkin, latestCheckinLog, checkinTimeline, blocks, replacementTasks] = await Promise.all([
    prisma.dailyCheckin.findFirst({
      where: {
        userId,
        checkinDate: {
          gte: today.start,
          lt: today.end,
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.checkinLog.findFirst({
      where: {
        userId,
        loggedAt: {
          gte: today.start,
          lt: today.end,
        },
      },
      orderBy: { loggedAt: "desc" },
    }),
    prisma.checkinLog.findMany({
      where: {
        userId,
        loggedAt: {
          gte: today.start,
          lt: today.end,
        },
      },
      orderBy: { loggedAt: "asc" },
    }),
    prisma.scheduledBlock.findMany({
      where: {
        userId,
        status: { in: ["proposed", "accepted"] },
        startTime: { lt: today.end },
        endTime: { gt: today.start },
      },
      include: {
        task: true,
        taskBreakdown: true,
      },
      orderBy: { startTime: "asc" },
    }),
    prisma.task.findMany({
      where: {
        userId,
        status: { notIn: ["completed", "cancelled"] },
        cognitiveLoad: { lte: 4 },
        scheduledBlocks: {
          none: {
            startTime: { lt: today.end },
            endTime: { gt: today.start },
            status: { in: ["proposed", "accepted"] },
          },
        },
      },
      select: {
        id: true,
        title: true,
        priority: true,
        cognitiveLoad: true,
        dueAt: true,
        estimatedMinutes: true,
      },
      orderBy: [{ priority: "asc" }, { dueAt: "asc" }, { createdAt: "asc" }],
      take: 5,
    }),
  ]);

  const suggestedAdjustments = buildTodayScheduleAdjustmentSuggestions({
    checkin,
    blocks,
    replacementTasks,
  });

  const actionCounts = suggestedAdjustments.reduce<Record<string, number>>((counts, adjustment) => {
    counts[adjustment.action] = (counts[adjustment.action] ?? 0) + 1;
    return counts;
  }, {});
  const overloaded = isOverloaded(checkin);
  const hasChanges = suggestedAdjustments.some((adjustment) => adjustment.action !== "keep");
  const summary = !checkin
    ? "No daily check-in found yet. These suggestions are based on today's blocks only."
    : hasChanges
      ? "Today's check-in suggests a lighter plan with concrete schedule adjustments."
      : "Today's check-in does not require changing the current plan.";

  const insight = await prisma.aiInsight.upsert({
    where: { id: `demo_daily_schedule_adjustment_${getDateKey(today.start)}` },
    update: {
      planningCycleId: checkin?.planningCycleId ?? null,
      dailyCheckinId: checkin?.id ?? null,
      checkinLogId: latestCheckinLog?.id ?? null,
      scope: "daily",
      insightType: "daily_schedule_adjustment",
      title: overloaded ? "Lighten today's plan" : "Today's plan looks manageable",
      body: summary,
      severity: overloaded && hasChanges ? "caution" : "info",
      confidenceScore: checkin ? 0.82 : 0.58,
      sourceData: {
        checkin: checkin
          ? {
              energyScore: checkin.energyScore,
              stressScore: checkin.stressScore,
              availableCapacityMinutes: checkin.availableCapacityMinutes,
            }
          : null,
        latestCheckinLog: latestCheckinLog
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
        actionCounts,
        suggestedAdjustments: suggestedAdjustments.map((adjustment) => ({
          ...adjustment,
          currentStartTime: adjustment.currentStartTime.toISOString(),
          currentEndTime: adjustment.currentEndTime.toISOString(),
          replacementTask: adjustment.replacementTask
            ? {
                ...adjustment.replacementTask,
                dueAt: adjustment.replacementTask.dueAt?.toISOString() ?? null,
              }
            : undefined,
        })),
      },
    },
    create: {
      id: `demo_daily_schedule_adjustment_${getDateKey(today.start)}`,
      userId,
      planningCycleId: checkin?.planningCycleId ?? null,
      dailyCheckinId: checkin?.id ?? null,
      checkinLogId: latestCheckinLog?.id ?? null,
      scope: "daily",
      insightType: "daily_schedule_adjustment",
      title: overloaded ? "Lighten today's plan" : "Today's plan looks manageable",
      body: summary,
      severity: overloaded && hasChanges ? "caution" : "info",
      confidenceScore: checkin ? 0.82 : 0.58,
      sourceData: {
        checkin: checkin
          ? {
              energyScore: checkin.energyScore,
              stressScore: checkin.stressScore,
              availableCapacityMinutes: checkin.availableCapacityMinutes,
            }
          : null,
        latestCheckinLog: latestCheckinLog
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
        actionCounts,
        suggestedAdjustments: suggestedAdjustments.map((adjustment) => ({
          ...adjustment,
          currentStartTime: adjustment.currentStartTime.toISOString(),
          currentEndTime: adjustment.currentEndTime.toISOString(),
          replacementTask: adjustment.replacementTask
            ? {
                ...adjustment.replacementTask,
                dueAt: adjustment.replacementTask.dueAt?.toISOString() ?? null,
              }
            : undefined,
        })),
      },
    },
  });

  return {
    date: today.start.toISOString().slice(0, 10),
    checkin,
    latestCheckinLog,
    checkinTimeline,
    actionCounts,
    suggestedAdjustments,
    insight,
    summary,
  };
}
