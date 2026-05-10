import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const allowedScheduledBlockPatchFields = ["startTime", "endTime", "status", "title"] as const;
const allowedGenerateScheduleFields = ["planningCycleId", "start", "end", "dryRun"] as const;
const schedulableTaskStatuses = ["todo", "scheduled", "in_progress", "deferred"] as const;
const activeBlockStatuses = ["proposed", "accepted", "rescheduled"] as const;

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; status?: number };

type ScheduledBlockPatchInput = {
  startTime?: Date;
  endTime?: Date;
  status?: string;
  title?: string;
};

type BusyWindow = {
  startTime: Date;
  endTime: Date;
};

type GenerateScheduleInput = {
  planningCycleId?: string | null;
  start?: Date;
  end?: Date;
  dryRun?: boolean;
};

type SchedulableTask = {
  id: string;
  planningCycleId: string | null;
  title: string;
  dueAt: Date | null;
  priority: number;
  cognitiveLoad: number;
  estimatedMinutes: number | null;
  workType: string;
};

type SchedulingPreferences = {
  workStartTime: string;
  workEndTime: string;
  preferredBlockLengthMinutes: number;
  minimumBreakMinutes: number;
  maxTotalWorkMinutesPerDay: number;
  maxHardWorkMinutesPerDay: number;
};

type ScheduleProposal = {
  userId: string;
  planningCycleId: string | null;
  taskId: string;
  title: string;
  startTime: Date;
  endTime: Date;
  status: string;
  createdBy: string;
  source: string;
  schedulingReason: string;
  scheduleScore: number;
  energyMatchScore: number;
  deadlineUrgencyScore: number;
  cognitiveBalanceScore: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function parseBoolean(value: unknown, field: string): ValidationResult<boolean | undefined> {
  if (value === undefined || value === null) {
    return { ok: true, value: undefined };
  }

  if (typeof value !== "boolean") {
    return { ok: false, error: `${field} must be a boolean.` };
  }

  return { ok: true, value };
}

function rejectUnknownFields(body: Record<string, unknown>, allowedFields: readonly string[]) {
  const allowed = new Set(allowedFields);
  const unknown = Object.keys(body).filter((key) => !allowed.has(key));

  if (unknown.length > 0) {
    return `Unsupported field(s): ${unknown.join(", ")}.`;
  }

  return null;
}

function validateTimeRange(startTime: Date, endTime: Date) {
  if (endTime <= startTime) {
    return "endTime must be after startTime.";
  }

  return null;
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

function startOfLocalDay(date: Date) {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

function parseClockTime(value: string, fallback: { hours: number; minutes: number }) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) {
    return fallback;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return fallback;
  }

  return { hours, minutes };
}

function setClockTime(date: Date, time: { hours: number; minutes: number }) {
  const result = new Date(date);
  result.setHours(time.hours, time.minutes, 0, 0);
  return result;
}

function clampDate(date: Date, min: Date, max: Date) {
  if (date < min) return min;
  if (date > max) return max;
  return date;
}

function padBusyWindows(busyWindows: BusyWindow[], minimumBreakMinutes: number) {
  return busyWindows.map((window) => ({
    startTime: addMinutes(window.startTime, -minimumBreakMinutes),
    endTime: addMinutes(window.endTime, minimumBreakMinutes),
  }));
}

function getDayKey(date: Date) {
  return startOfLocalDay(date).toISOString();
}

function createDayUsageMap(
  scheduledBlocks: Array<BusyWindow & { task: { cognitiveLoad: number } | null }>,
) {
  const usage = new Map<string, { totalMinutes: number; hardMinutes: number }>();

  for (const block of scheduledBlocks) {
    const dayKey = getDayKey(block.startTime);
    const current = usage.get(dayKey) ?? { totalMinutes: 0, hardMinutes: 0 };
    const blockMinutes = minutesBetween(block.startTime, block.endTime);

    current.totalMinutes += blockMinutes;
    if ((block.task?.cognitiveLoad ?? 4) >= 6) {
      current.hardMinutes += blockMinutes;
    }

    usage.set(dayKey, current);
  }

  return usage;
}

export function findFirstAvailableSlot(input: {
  range: { start: Date; end: Date };
  durationMinutes: number;
  busyWindows: BusyWindow[];
  preferences: Pick<
    SchedulingPreferences,
    "workStartTime" | "workEndTime" | "minimumBreakMinutes" | "maxTotalWorkMinutesPerDay" | "maxHardWorkMinutesPerDay"
  >;
  dayUsage: Map<string, { totalMinutes: number; hardMinutes: number }>;
  cognitiveLoad: number;
}) {
  const workStart = parseClockTime(input.preferences.workStartTime, { hours: 9, minutes: 0 });
  const workEnd = parseClockTime(input.preferences.workEndTime, { hours: 23, minutes: 0 });
  const paddedBusyWindows = padBusyWindows(input.busyWindows, input.preferences.minimumBreakMinutes);

  for (
    let day = startOfLocalDay(input.range.start);
    day < input.range.end;
    day = addMinutes(day, 24 * 60)
  ) {
    const dayKey = getDayKey(day);
    const usage = input.dayUsage.get(dayKey) ?? { totalMinutes: 0, hardMinutes: 0 };

    if (usage.totalMinutes + input.durationMinutes > input.preferences.maxTotalWorkMinutesPerDay) {
      continue;
    }

    if (
      input.cognitiveLoad >= 6 &&
      usage.hardMinutes + input.durationMinutes > input.preferences.maxHardWorkMinutesPerDay
    ) {
      continue;
    }

    const windowStart = clampDate(setClockTime(day, workStart), input.range.start, input.range.end);
    const windowEnd = clampDate(setClockTime(day, workEnd), input.range.start, input.range.end);

    for (
      let startTime = windowStart;
      addMinutes(startTime, input.durationMinutes) <= windowEnd;
      startTime = addMinutes(startTime, 15)
    ) {
      const candidate = {
        startTime,
        endTime: addMinutes(startTime, input.durationMinutes),
      };

      if (!paddedBusyWindows.some((busyWindow) => overlaps(candidate, busyWindow))) {
        return candidate;
      }
    }
  }

  return null;
}

function compactBlockData(input: ScheduledBlockPatchInput): Prisma.ScheduledBlockUncheckedUpdateInput {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Prisma.ScheduledBlockUncheckedUpdateInput;
}

export function validateScheduledBlockPatchBody(body: unknown): ValidationResult<ScheduledBlockPatchInput> {
  if (!isRecord(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const unknownFieldsError = rejectUnknownFields(body, allowedScheduledBlockPatchFields);
  if (unknownFieldsError) {
    return { ok: false, error: unknownFieldsError };
  }

  if (Object.keys(body).length === 0) {
    return { ok: false, error: "At least one field is required." };
  }

  const startTime = parseDate(body.startTime, "startTime");
  if (!startTime.ok) return startTime;

  const endTime = parseDate(body.endTime, "endTime");
  if (!endTime.ok) return endTime;

  if (startTime.value && endTime.value) {
    const rangeError = validateTimeRange(startTime.value, endTime.value);
    if (rangeError) {
      return { ok: false, error: rangeError };
    }
  }

  const status = parseString(body.status, "status");
  if (!status.ok) return status;

  const title = parseString(body.title, "title");
  if (!title.ok) return title;

  return {
    ok: true,
    value: {
      startTime: startTime.value,
      endTime: endTime.value,
      status: status.value,
      title: title.value,
    },
  };
}

export function validateGenerateScheduleBody(body: unknown): ValidationResult<GenerateScheduleInput> {
  const payload = body === undefined || body === null ? {} : body;

  if (!isRecord(payload)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const unknownFieldsError = rejectUnknownFields(payload, allowedGenerateScheduleFields);
  if (unknownFieldsError) {
    return { ok: false, error: unknownFieldsError };
  }

  const planningCycleId = parseString(payload.planningCycleId, "planningCycleId");
  if (!planningCycleId.ok) return planningCycleId;

  const start = parseDate(payload.start, "start");
  if (!start.ok) return start;

  const end = parseDate(payload.end, "end");
  if (!end.ok) return end;

  if ((start.value && !end.value) || (!start.value && end.value)) {
    return { ok: false, error: "start and end must be provided together." };
  }

  if (start.value && end.value) {
    const rangeError = validateTimeRange(start.value, end.value);
    if (rangeError) {
      return { ok: false, error: rangeError };
    }
  }

  const dryRun = parseBoolean(payload.dryRun, "dryRun");
  if (!dryRun.ok) return dryRun;

  return {
    ok: true,
    value: {
      planningCycleId: planningCycleId.value,
      start: start.value,
      end: end.value,
      dryRun: dryRun.value,
    },
  };
}

export async function getSchedule(userId: string, range: { start: Date; end: Date }) {
  const [calendarEvents, scheduledBlocks] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: {
        userId,
        startTime: { lt: range.end },
        endTime: { gt: range.start },
      },
      orderBy: [{ startTime: "asc" }, { createdAt: "asc" }],
    }),
    prisma.scheduledBlock.findMany({
      where: {
        userId,
        startTime: { lt: range.end },
        endTime: { gt: range.start },
      },
      include: {
        task: true,
        taskBreakdown: true,
      },
      orderBy: [{ startTime: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  return { calendarEvents, scheduledBlocks };
}

async function resolveScheduleRange(userId: string, input: GenerateScheduleInput) {
  if (input.start && input.end) {
    if (input.planningCycleId) {
      const cycle = await prisma.planningCycle.findFirst({
        where: { id: input.planningCycleId, userId },
        select: { id: true },
      });

      if (!cycle) {
        return { ok: false as const, error: "planningCycleId was not found for this user.", status: 400 };
      }
    }

    return {
      ok: true as const,
      value: { start: input.start, end: input.end, planningCycleId: input.planningCycleId ?? null },
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
  const end = addMinutes(start, 7 * 24 * 60);

  return { ok: true as const, value: { start, end, planningCycleId: input.planningCycleId ?? null } };
}

function taskSortScore(task: SchedulableTask, rangeStart: Date) {
  const dueHours = task.dueAt ? Math.max(0, (task.dueAt.getTime() - rangeStart.getTime()) / 3_600_000) : 24 * 30;
  const urgencyScore = task.dueAt ? Math.max(0, 100 - dueHours) : 0;
  const priorityScore = (6 - task.priority) * 20;
  const loadPenalty = task.cognitiveLoad >= 6 ? -5 : 0;

  return urgencyScore + priorityScore + loadPenalty;
}

function buildSchedulingReason(task: SchedulableTask, rangeStart: Date, latestCheckin?: { energyScore: number; stressScore: number } | null) {
  const parts = [`Priority ${task.priority}`];

  if (task.dueAt) {
    const daysUntilDue = Math.ceil((task.dueAt.getTime() - rangeStart.getTime()) / 86_400_000);
    parts.push(daysUntilDue <= 1 ? "due soon" : `due in ${daysUntilDue} days`);
  } else {
    parts.push("no fixed deadline");
  }

  if (task.cognitiveLoad >= 6) {
    parts.push("deep-work task");
  } else if (task.cognitiveLoad <= 2) {
    parts.push("lighter task");
  }

  if (latestCheckin && (latestCheckin.energyScore <= 2 || latestCheckin.stressScore >= 6)) {
    parts.push("kept within a smaller MVP block because today's check-in shows limited capacity");
  }

  return `${parts.join(", ")}.`;
}

function scheduleScore(task: SchedulableTask, rangeStart: Date, latestCheckin?: { energyScore: number; stressScore: number } | null) {
  const deadlineUrgencyScore = task.dueAt
    ? Math.max(0, Math.min(1, 1 - (task.dueAt.getTime() - rangeStart.getTime()) / (14 * 86_400_000)))
    : 0.2;
  const cognitiveBalanceScore = latestCheckin?.energyScore !== undefined
    ? Math.max(0, Math.min(1, 1 - Math.max(0, task.cognitiveLoad - latestCheckin.energyScore) / 7))
    : Math.max(0, Math.min(1, 1 - task.cognitiveLoad / 10));
  const energyMatchScore = latestCheckin
    ? Math.max(0, Math.min(1, (8 - Math.abs(task.cognitiveLoad - latestCheckin.energyScore)) / 8))
    : 0.7;

  return {
    deadlineUrgencyScore,
    cognitiveBalanceScore,
    energyMatchScore,
    scheduleScore: deadlineUrgencyScore * 0.45 + (6 - task.priority) * 0.08 + cognitiveBalanceScore * 0.25,
  };
}

export async function generateSchedule(userId: string, input: GenerateScheduleInput) {
  const resolvedRange = await resolveScheduleRange(userId, input);
  if (!resolvedRange.ok) {
    return resolvedRange;
  }

  const { start, end, planningCycleId } = resolvedRange.value;

  const [preferences, tasks, calendarEvents, scheduledBlocks, latestCheckin] = await Promise.all([
    prisma.userPreferences.findUnique({ where: { userId } }),
    prisma.task.findMany({
      where: {
        userId,
        status: { in: [...schedulableTaskStatuses] },
        ...(planningCycleId ? { planningCycleId } : {}),
      },
      select: {
        id: true,
        planningCycleId: true,
        title: true,
        dueAt: true,
        priority: true,
        cognitiveLoad: true,
        estimatedMinutes: true,
        workType: true,
        scheduledBlocks: {
          where: { status: { in: [...activeBlockStatuses] } },
          select: { startTime: true, endTime: true },
        },
      },
    }),
    prisma.calendarEvent.findMany({
      where: {
        userId,
        status: { not: "cancelled" },
        startTime: { lt: end },
        endTime: { gt: start },
      },
      select: { startTime: true, endTime: true },
    }),
    prisma.scheduledBlock.findMany({
      where: {
        userId,
        status: { in: [...activeBlockStatuses] },
        startTime: { lt: end },
        endTime: { gt: start },
      },
      select: {
        startTime: true,
        endTime: true,
        task: { select: { cognitiveLoad: true } },
      },
    }),
    prisma.dailyCheckin.findFirst({
      where: { userId, checkinDate: { lte: end } },
      select: { energyScore: true, stressScore: true },
      orderBy: { checkinDate: "desc" },
    }),
  ]);

  const effectivePreferences: SchedulingPreferences = {
    workStartTime: preferences?.workStartTime ?? "09:00",
    workEndTime: preferences?.workEndTime ?? "23:00",
    preferredBlockLengthMinutes: preferences?.preferredBlockLengthMinutes ?? 45,
    minimumBreakMinutes: preferences?.minimumBreakMinutes ?? 15,
    maxTotalWorkMinutesPerDay: preferences?.maxTotalWorkMinutesPerDay ?? 360,
    maxHardWorkMinutesPerDay: preferences?.maxHardWorkMinutesPerDay ?? 180,
  };

  const sortedTasks = tasks
    .map((task) => {
      const alreadyScheduledMinutes = task.scheduledBlocks.reduce(
        (total, block) => total + minutesBetween(block.startTime, block.endTime),
        0,
      );

      return {
        task,
        remainingMinutes: Math.max((task.estimatedMinutes ?? effectivePreferences.preferredBlockLengthMinutes) - alreadyScheduledMinutes, 0),
      };
    })
    .filter(({ remainingMinutes }) => remainingMinutes > 0)
    .sort((a, b) => taskSortScore(b.task, start) - taskSortScore(a.task, start));

  const busyWindows: BusyWindow[] = [
    ...calendarEvents,
    ...scheduledBlocks.map(({ startTime, endTime }) => ({ startTime, endTime })),
  ];
  const dayUsage = createDayUsageMap(scheduledBlocks);
  const proposals: ScheduleProposal[] = [];
  const unscheduledTasks: Array<{ taskId: string; title: string; reason: string; remainingMinutes: number }> = [];
  const lowCapacityDay = Boolean(latestCheckin && (latestCheckin.energyScore <= 2 || latestCheckin.stressScore >= 6));

  for (const { task, remainingMinutes } of sortedTasks) {
    let minutesLeft = remainingMinutes;
    let createdForTask = 0;

    while (minutesLeft > 0) {
      const maxBlockLength = lowCapacityDay && task.cognitiveLoad >= 5
        ? Math.min(30, effectivePreferences.preferredBlockLengthMinutes)
        : effectivePreferences.preferredBlockLengthMinutes;
      const durationMinutes = Math.max(15, Math.min(maxBlockLength, minutesLeft));
      const taskRangeEnd = task.dueAt && task.dueAt > start && task.dueAt < end ? task.dueAt : end;
      const slot = findFirstAvailableSlot({
        range: { start, end: taskRangeEnd },
        durationMinutes,
        busyWindows,
        preferences: effectivePreferences,
        dayUsage,
        cognitiveLoad: task.cognitiveLoad,
      });

      if (!slot) {
        break;
      }

      const scores = scheduleScore(task, start, latestCheckin);
      const proposal: ScheduleProposal = {
        userId,
        planningCycleId: task.planningCycleId ?? planningCycleId,
        taskId: task.id,
        title: task.title,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: "proposed",
        createdBy: "agent",
        source: "scheduler",
        schedulingReason: buildSchedulingReason(task, start, latestCheckin),
        ...scores,
      };

      proposals.push(proposal);
      busyWindows.push(slot);

      const dayKey = getDayKey(slot.startTime);
      const usage = dayUsage.get(dayKey) ?? { totalMinutes: 0, hardMinutes: 0 };
      usage.totalMinutes += durationMinutes;
      if (task.cognitiveLoad >= 6) {
        usage.hardMinutes += durationMinutes;
      }
      dayUsage.set(dayKey, usage);

      minutesLeft -= durationMinutes;
      createdForTask += durationMinutes;
    }

    if (createdForTask < remainingMinutes) {
      unscheduledTasks.push({
        taskId: task.id,
        title: task.title,
        reason: createdForTask > 0
          ? "Only part of this task fit before its deadline and within work-hour/capacity limits."
          : "No open work-hour slot fit before the deadline without calendar or scheduled-block conflicts.",
        remainingMinutes: remainingMinutes - createdForTask,
      });
    }
  }

  if (input.dryRun) {
    return {
      ok: true as const,
      value: {
        range: { start, end },
        dryRun: true,
        scheduledBlocks: proposals,
        unscheduledTasks,
      },
    };
  }

  const createdBlocks = proposals.length > 0
    ? await prisma.scheduledBlock.createManyAndReturn({
        data: proposals,
      })
    : [];

  const touchedTaskIds = Array.from(new Set(createdBlocks.map((block) => block.taskId).filter(Boolean))) as string[];
  if (touchedTaskIds.length > 0) {
    await prisma.task.updateMany({
      where: {
        userId,
        id: { in: touchedTaskIds },
        status: { in: ["todo", "deferred"] },
      },
      data: { status: "scheduled" },
    });
  }

  const scheduledBlocksWithTasks = createdBlocks.length > 0
    ? await prisma.scheduledBlock.findMany({
        where: { id: { in: createdBlocks.map((block) => block.id) }, userId },
        include: { task: true, taskBreakdown: true },
        orderBy: [{ startTime: "asc" }, { createdAt: "asc" }],
      })
    : [];

  return {
    ok: true as const,
    value: {
      range: { start, end },
      dryRun: false,
      scheduledBlocks: scheduledBlocksWithTasks,
      unscheduledTasks,
    },
  };
}

export async function updateScheduledBlock(
  userId: string,
  blockId: string,
  input: ScheduledBlockPatchInput,
) {
  const existingBlock = await prisma.scheduledBlock.findFirst({
    where: { id: blockId, userId },
    select: { id: true, startTime: true, endTime: true },
  });

  if (!existingBlock) {
    return { ok: false as const, error: "Scheduled block not found.", status: 404 };
  }

  const nextStartTime = input.startTime ?? existingBlock.startTime;
  const nextEndTime = input.endTime ?? existingBlock.endTime;
  const rangeError = validateTimeRange(nextStartTime, nextEndTime);

  if (rangeError) {
    return { ok: false as const, error: rangeError, status: 400 };
  }

  const scheduledBlock = await prisma.scheduledBlock.update({
    where: { id: blockId },
    data: compactBlockData(input),
    include: {
      task: true,
      taskBreakdown: true,
    },
  });

  return { ok: true as const, value: scheduledBlock };
}

export async function completeScheduledBlock(userId: string, blockId: string) {
  const existingBlock = await prisma.scheduledBlock.findFirst({
    where: { id: blockId, userId },
    select: { id: true, taskId: true },
  });

  if (!existingBlock) {
    return { ok: false as const, error: "Scheduled block not found.", status: 404 };
  }

  const scheduledBlock = await prisma.scheduledBlock.update({
    where: { id: blockId },
    data: { status: "completed" },
    include: {
      task: true,
      taskBreakdown: true,
    },
  });

  let task = null;

  if (existingBlock.taskId) {
    const remainingBlocks = await prisma.scheduledBlock.count({
      where: {
        userId,
        taskId: existingBlock.taskId,
        status: { notIn: ["completed", "cancelled", "skipped"] },
      },
    });

    task = await prisma.task.update({
      where: { id: existingBlock.taskId },
      data: { status: remainingBlocks === 0 ? "completed" : "in_progress" },
    });
  }

  return { ok: true as const, value: { scheduledBlock, task } };
}

async function findRescheduleSuggestion(userId: string, block: BusyWindow & { id: string }) {
  const durationMinutes = Math.max(15, Math.round((block.endTime.getTime() - block.startTime.getTime()) / 60_000));
  const dayEnd = new Date(block.startTime);
  dayEnd.setHours(22, 0, 0, 0);

  const windowStart = addMinutes(block.endTime, 15);
  const busyWindowEnd = addMinutes(dayEnd, durationMinutes);

  const [calendarEvents, scheduledBlocks] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: {
        userId,
        status: { not: "cancelled" },
        startTime: { lt: busyWindowEnd },
        endTime: { gt: windowStart },
      },
      select: { startTime: true, endTime: true },
    }),
    prisma.scheduledBlock.findMany({
      where: {
        userId,
        id: { not: block.id },
        status: { notIn: ["cancelled", "skipped"] },
        startTime: { lt: busyWindowEnd },
        endTime: { gt: windowStart },
      },
      select: { startTime: true, endTime: true },
    }),
  ]);

  const busyWindows = [...calendarEvents, ...scheduledBlocks];

  for (let startTime = windowStart; addMinutes(startTime, durationMinutes) <= dayEnd; startTime = addMinutes(startTime, 15)) {
    const suggestion = {
      startTime,
      endTime: addMinutes(startTime, durationMinutes),
    };

    if (!busyWindows.some((busyWindow) => overlaps(suggestion, busyWindow))) {
      return {
        ...suggestion,
        reason: "Next same-day opening with no calendar event or active scheduled block conflict.",
      };
    }
  }

  return null;
}

export async function skipScheduledBlock(userId: string, blockId: string) {
  const existingBlock = await prisma.scheduledBlock.findFirst({
    where: { id: blockId, userId },
    select: {
      id: true,
      startTime: true,
      endTime: true,
    },
  });

  if (!existingBlock) {
    return { ok: false as const, error: "Scheduled block not found.", status: 404 };
  }

  const suggestion = await findRescheduleSuggestion(userId, existingBlock);

  const scheduledBlock = await prisma.scheduledBlock.update({
    where: { id: blockId },
    data: { status: "skipped" },
    include: {
      task: true,
      taskBreakdown: true,
    },
  });

  return { ok: true as const, value: { scheduledBlock, suggestion } };
}
