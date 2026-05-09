import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const taskInclude = {
  taskBreakdowns: {
    orderBy: { sequenceOrder: "asc" as const },
  },
  scheduledBlocks: {
    orderBy: { startTime: "asc" as const },
  },
};

const allowedTaskFields = [
  "planningCycleId",
  "title",
  "description",
  "type",
  "workType",
  "timeframe",
  "dueAt",
  "priority",
  "cognitiveLoad",
  "estimatedMinutes",
  "canSplit",
  "createdBy",
] as const;

const allowedPatchFields = [
  ...allowedTaskFields,
  "status",
  "actualMinutes",
] as const;

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; status?: number };

type TaskCreateInput = {
  planningCycleId?: string | null;
  title: string;
  description?: string | null;
  type?: string;
  workType?: string;
  timeframe?: string;
  dueAt?: Date | null;
  priority?: number;
  cognitiveLoad?: number;
  estimatedMinutes?: number | null;
  canSplit?: boolean;
  createdBy?: string;
};

type TaskPatchInput = Partial<TaskCreateInput> & {
  status?: string;
  actualMinutes?: number | null;
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

function parseDate(value: unknown, field: string): ValidationResult<Date | null | undefined> {
  if (value === undefined) {
    return { ok: true, value: undefined };
  }

  if (value === null) {
    return { ok: true, value: null };
  }

  if (typeof value !== "string") {
    return { ok: false, error: `${field} must be an ISO date string or null.` };
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

export function validateCreateTaskBody(body: unknown): ValidationResult<TaskCreateInput> {
  if (!isRecord(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const unknownFieldsError = rejectUnknownFields(body, allowedTaskFields);
  if (unknownFieldsError) {
    return { ok: false, error: unknownFieldsError };
  }

  const title = parseString(body.title, "title", true);
  if (!title.ok) return title;

  const planningCycleId = parseNullableString(body.planningCycleId, "planningCycleId");
  if (!planningCycleId.ok) return planningCycleId;

  const description = parseNullableString(body.description, "description");
  if (!description.ok) return description;

  const type = parseString(body.type, "type");
  if (!type.ok) return type;

  const workType = parseString(body.workType, "workType");
  if (!workType.ok) return workType;

  const timeframe = parseString(body.timeframe, "timeframe");
  if (!timeframe.ok) return timeframe;

  const dueAt = parseDate(body.dueAt, "dueAt");
  if (!dueAt.ok) return dueAt;

  const priority = parseInteger(body.priority, "priority", { min: 1, max: 5 });
  if (!priority.ok) return priority;

  const cognitiveLoad = parseInteger(body.cognitiveLoad, "cognitiveLoad", { min: 1, max: 7 });
  if (!cognitiveLoad.ok) return cognitiveLoad;

  const estimatedMinutes = parseInteger(body.estimatedMinutes, "estimatedMinutes", {
    min: 1,
    nullable: true,
  });
  if (!estimatedMinutes.ok) return estimatedMinutes;

  const canSplit = parseBoolean(body.canSplit, "canSplit");
  if (!canSplit.ok) return canSplit;

  const createdBy = parseString(body.createdBy, "createdBy");
  if (!createdBy.ok) return createdBy;

  return {
    ok: true,
    value: {
      planningCycleId: planningCycleId.value,
      title: title.value ?? "",
      description: description.value,
      type: type.value,
      workType: workType.value,
      timeframe: timeframe.value,
      dueAt: dueAt.value,
      priority: priority.value ?? undefined,
      cognitiveLoad: cognitiveLoad.value ?? undefined,
      estimatedMinutes: estimatedMinutes.value,
      canSplit: canSplit.value,
      createdBy: createdBy.value,
    },
  };
}

export function validatePatchTaskBody(body: unknown): ValidationResult<TaskPatchInput> {
  if (!isRecord(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const unknownFieldsError = rejectUnknownFields(body, allowedPatchFields);
  if (unknownFieldsError) {
    return { ok: false, error: unknownFieldsError };
  }

  if (Object.keys(body).length === 0) {
    return { ok: false, error: "At least one field is required." };
  }

  const planningCycleId = parseNullableString(body.planningCycleId, "planningCycleId");
  if (!planningCycleId.ok) return planningCycleId;

  const title = parseString(body.title, "title");
  if (!title.ok) return title;

  const description = parseNullableString(body.description, "description");
  if (!description.ok) return description;

  const type = parseString(body.type, "type");
  if (!type.ok) return type;

  const workType = parseString(body.workType, "workType");
  if (!workType.ok) return workType;

  const timeframe = parseString(body.timeframe, "timeframe");
  if (!timeframe.ok) return timeframe;

  const dueAt = parseDate(body.dueAt, "dueAt");
  if (!dueAt.ok) return dueAt;

  const priority = parseInteger(body.priority, "priority", { min: 1, max: 5 });
  if (!priority.ok) return priority;

  const cognitiveLoad = parseInteger(body.cognitiveLoad, "cognitiveLoad", { min: 1, max: 7 });
  if (!cognitiveLoad.ok) return cognitiveLoad;

  const estimatedMinutes = parseInteger(body.estimatedMinutes, "estimatedMinutes", {
    min: 1,
    nullable: true,
  });
  if (!estimatedMinutes.ok) return estimatedMinutes;

  const canSplit = parseBoolean(body.canSplit, "canSplit");
  if (!canSplit.ok) return canSplit;

  const createdBy = parseString(body.createdBy, "createdBy");
  if (!createdBy.ok) return createdBy;

  const status = parseString(body.status, "status");
  if (!status.ok) return status;

  const actualMinutes = parseInteger(body.actualMinutes, "actualMinutes", { min: 0, nullable: true });
  if (!actualMinutes.ok) return actualMinutes;

  return {
    ok: true,
    value: {
      planningCycleId: planningCycleId.value,
      title: title.value,
      description: description.value,
      type: type.value,
      workType: workType.value,
      timeframe: timeframe.value,
      dueAt: dueAt.value,
      priority: priority.value ?? undefined,
      cognitiveLoad: cognitiveLoad.value ?? undefined,
      estimatedMinutes: estimatedMinutes.value,
      canSplit: canSplit.value,
      createdBy: createdBy.value,
      status: status.value,
      actualMinutes: actualMinutes.value,
    },
  };
}

export function validateCompleteTaskBody(body: unknown): ValidationResult<{ actualMinutes?: number | null }> {
  if (body === undefined || body === null) {
    return { ok: true, value: {} };
  }

  if (!isRecord(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const unknownFieldsError = rejectUnknownFields(body, ["actualMinutes"]);
  if (unknownFieldsError) {
    return { ok: false, error: unknownFieldsError };
  }

  const actualMinutes = parseInteger(body.actualMinutes, "actualMinutes", { min: 0, nullable: true });
  if (!actualMinutes.ok) return actualMinutes;

  return { ok: true, value: { actualMinutes: actualMinutes.value } };
}

type TaskWriteData = Partial<Omit<Prisma.TaskUncheckedCreateInput, "id" | "userId">>;

function compactTaskData(input: TaskCreateInput | TaskPatchInput): TaskWriteData {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as TaskWriteData;
}

export async function listTasks(userId: string) {
  return prisma.task.findMany({
    where: { userId },
    include: taskInclude,
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
  });
}

export async function createTask(userId: string, input: TaskCreateInput) {
  if (input.planningCycleId) {
    const cycle = await prisma.planningCycle.findFirst({
      where: { id: input.planningCycleId, userId },
      select: { id: true },
    });

    if (!cycle) {
      return { ok: false as const, error: "planningCycleId was not found for this user.", status: 400 };
    }
  }

  const { title, ...optionalInput } = input;
  const task = await prisma.task.create({
    data: {
      userId,
      title,
      ...compactTaskData(optionalInput),
    },
    include: taskInclude,
  });

  return { ok: true as const, value: task };
}

export async function updateTask(userId: string, taskId: string, input: TaskPatchInput) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, userId },
    select: { id: true },
  });

  if (!task) {
    return { ok: false as const, error: "Task not found.", status: 404 };
  }

  if (input.planningCycleId) {
    const cycle = await prisma.planningCycle.findFirst({
      where: { id: input.planningCycleId, userId },
      select: { id: true },
    });

    if (!cycle) {
      return { ok: false as const, error: "planningCycleId was not found for this user.", status: 400 };
    }
  }

  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data: compactTaskData(input) as Prisma.TaskUncheckedUpdateInput,
    include: taskInclude,
  });

  return { ok: true as const, value: updatedTask };
}

export async function cancelTask(userId: string, taskId: string) {
  return updateTask(userId, taskId, { status: "cancelled" });
}

export async function completeTask(
  userId: string,
  taskId: string,
  input: { actualMinutes?: number | null },
) {
  return updateTask(userId, taskId, {
    status: "completed",
    actualMinutes: input.actualMinutes,
  });
}

function buildBreakdownSteps(task: {
  id: string;
  title: string;
  workType: string;
  estimatedMinutes: number | null;
  cognitiveLoad: number;
}) {
  const totalMinutes = task.estimatedMinutes ?? 90;
  const stepMinutes = Math.max(20, Math.ceil(totalMinutes / 3));
  const workType = task.workType.toLowerCase();

  if (workType === "writing") {
    return ["Outline argument and evidence", "Write first full draft", "Revise and proofread"].map((title, index) => ({
      id: `${task.id}_breakdown_${index + 1}`,
      title,
      sequenceOrder: index + 1,
      estimatedMinutes: stepMinutes,
      cognitiveLoad: Math.max(1, Math.min(7, task.cognitiveLoad - (index === 2 ? 1 : 0))),
    }));
  }

  if (workType === "study") {
    return ["Review notes and formulas", "Work practice problems", "Check weak spots and summarize"].map(
      (title, index) => ({
        id: `${task.id}_breakdown_${index + 1}`,
        title,
        sequenceOrder: index + 1,
        estimatedMinutes: stepMinutes,
        cognitiveLoad: Math.max(1, Math.min(7, task.cognitiveLoad - (index === 2 ? 1 : 0))),
      }),
    );
  }

  if (workType === "project") {
    return ["Define remaining requirements", "Implement core changes", "Test and prepare handoff"].map(
      (title, index) => ({
        id: `${task.id}_breakdown_${index + 1}`,
        title,
        sequenceOrder: index + 1,
        estimatedMinutes: stepMinutes,
        cognitiveLoad: Math.max(1, Math.min(7, task.cognitiveLoad - (index === 0 ? 1 : 0))),
      }),
    );
  }

  return ["Clarify next step", "Complete focused work block", "Review and wrap up"].map((title, index) => ({
    id: `${task.id}_breakdown_${index + 1}`,
    title,
    sequenceOrder: index + 1,
    estimatedMinutes: stepMinutes,
    cognitiveLoad: Math.max(1, Math.min(7, task.cognitiveLoad)),
  }));
}

export async function generateTaskBreakdown(userId: string, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, userId },
    select: {
      id: true,
      title: true,
      workType: true,
      estimatedMinutes: true,
      cognitiveLoad: true,
    },
  });

  if (!task) {
    return { ok: false as const, error: "Task not found.", status: 404 };
  }

  const steps = buildBreakdownSteps(task);

  await Promise.all(
    steps.map((step) =>
      prisma.taskBreakdown.upsert({
        where: { id: step.id },
        update: {
          title: step.title,
          sequenceOrder: step.sequenceOrder,
          estimatedMinutes: step.estimatedMinutes,
          cognitiveLoad: step.cognitiveLoad,
          status: "todo",
          createdBy: "ai",
        },
        create: {
          id: step.id,
          userId,
          taskId,
          title: step.title,
          sequenceOrder: step.sequenceOrder,
          estimatedMinutes: step.estimatedMinutes,
          cognitiveLoad: step.cognitiveLoad,
          status: "todo",
          createdBy: "ai",
        },
      }),
    ),
  );

  const breakdowns = await prisma.taskBreakdown.findMany({
    where: { userId, taskId },
    orderBy: { sequenceOrder: "asc" },
  });

  return { ok: true as const, value: breakdowns };
}
