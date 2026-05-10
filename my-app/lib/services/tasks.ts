import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const taskInclude = {
  taskBreakdowns: {
    orderBy: { sequenceOrder: "asc" as const },
  },
  scheduledBlocks: {
    include: {
      taskBreakdown: true,
    },
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

type TaskBreakdownInput = {
  replaceExisting?: boolean;
  targetBlockMinutes?: number;
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

export function validateTaskBreakdownBody(body: unknown): ValidationResult<TaskBreakdownInput> {
  if (body === undefined || body === null) {
    return { ok: true, value: {} };
  }

  if (!isRecord(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const unknownFieldsError = rejectUnknownFields(body, ["replaceExisting", "targetBlockMinutes"]);
  if (unknownFieldsError) {
    return { ok: false, error: unknownFieldsError };
  }

  const replaceExisting = parseBoolean(body.replaceExisting, "replaceExisting");
  if (!replaceExisting.ok) return replaceExisting;

  const targetBlockMinutes = parseInteger(body.targetBlockMinutes, "targetBlockMinutes", { min: 15, max: 180 });
  if (!targetBlockMinutes.ok) return targetBlockMinutes;

  return {
    ok: true,
    value: {
      replaceExisting: replaceExisting.value,
      targetBlockMinutes: targetBlockMinutes.value ?? undefined,
    },
  };
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

export async function hardDeleteTask(userId: string, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, userId },
    select: { id: true },
  });

  if (!task) {
    return { ok: false as const, error: "Task not found.", status: 404 };
  }

  await prisma.task.delete({ where: { id: taskId } });

  return { ok: true as const, value: { id: taskId } };
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

const breakdownTemplates: Record<string, string[]> = {
  study: ["Review core material", "Practice problems or recall", "Self-test weak spots", "Summarize final takeaways"],
  writing: ["Outline argument and evidence", "Draft the main sections", "Revise structure and clarity", "Proofread and finalize"],
  project: ["Scope remaining work", "Implement focused changes", "Test the result", "Polish and prepare handoff"],
  admin: ["Gather needed information", "Complete the form or task", "Submit and confirm"],
  reading: ["Preview headings and goals", "Read actively with notes", "Summarize key takeaways"],
  creative: ["Sketch the direction", "Create the first pass", "Refine the strongest version", "Review and export"],
  personal: ["Clarify the next action", "Do the main task", "Wrap up and reset"],
  focus: ["Clarify the next action", "Complete a focused work block", "Review and wrap up"],
};

function clampBreakdownLoad(cognitiveLoad: number, index: number, totalSteps: number) {
  const adjustment = index === totalSteps - 1 && totalSteps > 1 ? -1 : 0;
  return Math.max(1, Math.min(7, cognitiveLoad + adjustment));
}

export function buildBreakdownSteps(task: {
  id: string;
  title: string;
  workType: string;
  estimatedMinutes: number | null;
  cognitiveLoad: number;
  canSplit: boolean;
}, targetBlockMinutes = 45) {
  const safeTargetMinutes = Math.max(15, Math.min(180, Math.round(targetBlockMinutes)));
  const totalMinutes = task.estimatedMinutes ?? safeTargetMinutes;
  const workType = task.workType.toLowerCase();
  const templates = breakdownTemplates[workType] ?? breakdownTemplates.focus;
  const shouldSplit = task.canSplit && totalMinutes > safeTargetMinutes;
  const stepCount = shouldSplit ? Math.min(8, Math.max(2, Math.ceil(totalMinutes / safeTargetMinutes))) : 1;
  const baseStepMinutes = Math.floor(totalMinutes / stepCount);
  const remainderMinutes = totalMinutes % stepCount;

  return Array.from({ length: stepCount }, (_, index) => {
    const templateTitle = templates[index] ?? `Continue focused work block ${index + 1}`;
    const title = stepCount === 1 ? `Complete ${task.title}` : templateTitle;

    return {
      id: `${task.id}_breakdown_${index + 1}`,
      title,
      description:
        stepCount === 1
          ? "This task is small enough to handle as one focused step."
          : `Planned as part ${index + 1} of ${stepCount} for ${task.title}.`,
      sequenceOrder: index + 1,
      estimatedMinutes: baseStepMinutes + (index < remainderMinutes ? 1 : 0),
      cognitiveLoad: clampBreakdownLoad(task.cognitiveLoad, index, stepCount),
    };
  });
}

async function alignScheduledBlocksToBreakdowns(userId: string, taskId: string, breakdowns: Array<{ id: string; title: string }>) {
  const scheduledBlocks = await prisma.scheduledBlock.findMany({
    where: {
      userId,
      taskId,
      status: { not: "cancelled" },
    },
    select: {
      id: true,
      status: true,
    },
    orderBy: [{ startTime: "asc" }, { createdAt: "asc" }],
  });

  await Promise.all(
    scheduledBlocks.slice(0, breakdowns.length).map((block, index) => {
      const breakdown = breakdowns[index];

      return prisma.scheduledBlock.update({
        where: { id: block.id },
        data: {
          taskBreakdownId: breakdown.id,
          title: breakdown.title,
        },
      });
    }),
  );

  const activeBreakdownIds = scheduledBlocks
    .slice(0, breakdowns.length)
    .filter((block) => ["proposed", "accepted", "rescheduled"].includes(block.status))
    .map((_, index) => breakdowns[index]?.id)
    .filter(Boolean) as string[];

  if (activeBreakdownIds.length > 0) {
    await prisma.taskBreakdown.updateMany({
      where: {
        userId,
        taskId,
        id: { in: activeBreakdownIds },
        status: "todo",
      },
      data: { status: "scheduled" },
    });
  }
}

export async function generateTaskBreakdown(userId: string, taskId: string, input: TaskBreakdownInput = {}) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, userId },
    select: {
      id: true,
      title: true,
      workType: true,
      estimatedMinutes: true,
      cognitiveLoad: true,
      canSplit: true,
      user: {
        select: {
          preferences: {
            select: {
              preferredBlockLengthMinutes: true,
            },
          },
        },
      },
    },
  });

  if (!task) {
    return { ok: false as const, error: "Task not found.", status: 404 };
  }

  const { user, ...taskData } = task;
  const existingBreakdowns = await prisma.taskBreakdown.findMany({
    where: { userId, taskId },
    orderBy: { sequenceOrder: "asc" },
  });

  const targetBlockMinutes = input.targetBlockMinutes ?? user.preferences?.preferredBlockLengthMinutes ?? 45;

  if (existingBreakdowns.length > 0 && !input.replaceExisting) {
    return {
      ok: true as const,
      value: {
        task: taskData,
        breakdowns: existingBreakdowns,
        replacedExisting: false,
        targetBlockMinutes,
        message: "Existing breakdowns were preserved. Pass replaceExisting: true to regenerate them.",
      },
    };
  }

  const steps = buildBreakdownSteps(task, targetBlockMinutes);

  if (existingBreakdowns.length > 0 && input.replaceExisting) {
    await prisma.taskBreakdown.deleteMany({
      where: { userId, taskId },
    });
  }

  await Promise.all(
    steps.map((step) =>
      prisma.taskBreakdown.upsert({
        where: { id: step.id },
        update: {
          title: step.title,
          description: step.description,
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
          description: step.description,
          sequenceOrder: step.sequenceOrder,
          estimatedMinutes: step.estimatedMinutes,
          cognitiveLoad: step.cognitiveLoad,
          status: "todo",
          createdBy: "ai",
        },
      }),
    ),
  );

  let breakdowns = await prisma.taskBreakdown.findMany({
    where: { userId, taskId },
    orderBy: { sequenceOrder: "asc" },
  });

  await alignScheduledBlocksToBreakdowns(userId, taskId, breakdowns);

  breakdowns = await prisma.taskBreakdown.findMany({
    where: { userId, taskId },
    orderBy: { sequenceOrder: "asc" },
  });

  return {
    ok: true as const,
    value: {
      task: taskData,
      breakdowns,
      replacedExisting: existingBreakdowns.length > 0 && input.replaceExisting === true,
      targetBlockMinutes,
      message:
        steps.length === 1
          ? "Task is small enough to handle as one focused step."
          : `Task was split into ${steps.length} steps based on a ${targetBlockMinutes}-minute target block.`,
    },
  };
}
