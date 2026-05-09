import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const allowedScheduledBlockPatchFields = ["startTime", "endTime", "status", "title"] as const;

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

function overlaps(a: BusyWindow, b: BusyWindow) {
  return a.startTime < b.endTime && a.endTime > b.startTime;
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
