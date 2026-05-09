import { Prisma } from "@prisma/client";
import { parseGeminiChatMessage } from "@/lib/ai/geminiParser";
import type { MockParsedAction } from "@/lib/ai/mockParser";
import { prisma } from "@/lib/db";

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; status?: number };

type ChatMessageInput = {
  threadId?: string;
  planningCycleId?: string | null;
  content: string;
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

function rejectUnknownFields(body: Record<string, unknown>, allowedFields: readonly string[]) {
  const allowed = new Set(allowedFields);
  const unknown = Object.keys(body).filter((key) => !allowed.has(key));

  if (unknown.length > 0) {
    return `Unsupported field(s): ${unknown.join(", ")}.`;
  }

  return null;
}

function jsonObject(value: unknown): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject;
}

export function validateChatMessageBody(body: unknown): ValidationResult<ChatMessageInput> {
  if (!isRecord(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const unknownFieldsError = rejectUnknownFields(body, ["threadId", "planningCycleId", "content"]);
  if (unknownFieldsError) {
    return { ok: false, error: unknownFieldsError };
  }

  const threadId = parseString(body.threadId, "threadId");
  if (!threadId.ok) return threadId;

  const planningCycleId = parseString(body.planningCycleId, "planningCycleId");
  if (!planningCycleId.ok) return planningCycleId;

  const content = parseString(body.content, "content", true);
  if (!content.ok) return content;

  return {
    ok: true,
    value: {
      threadId: threadId.value,
      planningCycleId: planningCycleId.value,
      content: content.value ?? "",
    },
  };
}

async function getOrCreateThread(userId: string, input: ChatMessageInput) {
  if (input.threadId) {
    const thread = await prisma.chatThread.findFirst({
      where: { id: input.threadId, userId },
    });

    if (!thread) {
      return null;
    }

    return thread;
  }

  return prisma.chatThread.create({
    data: {
      userId,
      planningCycleId: input.planningCycleId,
      title: input.content.slice(0, 60),
    },
  });
}

async function executeCreateTask(userId: string, action: MockParsedAction) {
  const payload = action.inputPayload;
  const title = typeof payload.title === "string" ? payload.title : "";

  if (!title) {
    throw new Error("Task title is required.");
  }

  const task = await prisma.task.create({
    data: {
      userId,
      title,
      description: typeof payload.description === "string" ? payload.description : undefined,
      dueAt: typeof payload.dueAt === "string" ? new Date(payload.dueAt) : undefined,
      priority: typeof payload.priority === "number" ? payload.priority : 3,
      cognitiveLoad: typeof payload.cognitiveLoad === "number" ? payload.cognitiveLoad : 4,
      type: typeof payload.type === "string" ? payload.type : "school",
      workType: typeof payload.workType === "string" ? payload.workType : "focus",
      timeframe: typeof payload.timeframe === "string" ? payload.timeframe : "weekly",
      createdBy: "chat",
    },
  });

  return { task };
}

async function executeCreateEvent(userId: string, action: MockParsedAction) {
  const payload = action.inputPayload;
  const title = typeof payload.title === "string" ? payload.title : "";
  const startTime = typeof payload.startTime === "string" ? new Date(payload.startTime) : null;
  const endTime = typeof payload.endTime === "string" ? new Date(payload.endTime) : null;

  if (!title || !startTime || !endTime) {
    throw new Error("Event title, startTime, and endTime are required.");
  }

  const event = await prisma.calendarEvent.create({
    data: {
      userId,
      title,
      startTime,
      endTime,
      isAllDay: false,
      provider: "manual",
      calendarId: "mvp-chat-calendar",
      source: "chat",
      status: "confirmed",
    },
  });

  return { event };
}

async function executeUpdateTask(userId: string, action: MockParsedAction) {
  const payload = action.inputPayload;
  const operation = typeof payload.operation === "string" ? payload.operation : "";

  if (operation !== "complete") {
    throw new Error("This update needs clarification before it can run.");
  }

  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  if (!title) {
    throw new Error("Task title is required to complete a task.");
  }

  const candidates = await prisma.task.findMany({
    where: {
      userId,
      status: { notIn: ["completed", "cancelled"] },
    },
  });
  const task = candidates.find((candidate) => candidate.title.toLowerCase().includes(title.toLowerCase()));

  if (!task) {
    throw new Error(`No incomplete task matched "${title}".`);
  }

  const updatedTask = await prisma.task.update({
    where: { id: task.id },
    data: { status: "completed" },
  });

  return { task: updatedTask };
}

async function executeGenerateSchedule() {
  return {
    suggestion: "For MVP, use /api/schedule and /api/schedule/adjust-today to build the visible plan from tasks, events, and scheduled blocks.",
  };
}

async function executeAction(userId: string, action: MockParsedAction) {
  if (action.actionType === "CREATE_TASK") return executeCreateTask(userId, action);
  if (action.actionType === "CREATE_EVENT") return executeCreateEvent(userId, action);
  if (action.actionType === "UPDATE_TASK") return executeUpdateTask(userId, action);
  return executeGenerateSchedule();
}

async function recordAndMaybeExecuteAction(params: {
  userId: string;
  threadId: string;
  messageId: string;
  action: MockParsedAction;
}) {
  const { userId, threadId, messageId, action } = params;
  const aiAction = await prisma.aiAction.create({
    data: {
      userId,
      threadId,
      messageId,
      actionType: action.actionType,
      status: "proposed",
      requiresConfirmation: action.requiresConfirmation,
      inputPayload: jsonObject({
        ...action.inputPayload,
        ambiguous: action.ambiguous,
      }),
    },
  });

  if (action.ambiguous || action.requiresConfirmation) {
    return { ...aiAction, status: "proposed" };
  }

  try {
    const result = await executeAction(userId, action);

    return prisma.aiAction.update({
      where: { id: aiAction.id },
      data: {
        status: "executed",
        resultPayload: jsonObject(result),
        executedAt: new Date(),
      },
    });
  } catch (error) {
    return prisma.aiAction.update({
      where: { id: aiAction.id },
      data: {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown action execution error.",
      },
    });
  }
}

function buildAssistantResponse(actions: MockParsedAction[]) {
  if (actions.length === 0) {
    return "I did not find a task, event, schedule, or update action in that message.";
  }

  return actions.map((action) => action.assistantSummary).join(" ");
}

export async function handleChatMessage(userId: string, input: ChatMessageInput) {
  const thread = await getOrCreateThread(userId, input);

  if (!thread) {
    return { ok: false as const, error: "Chat thread not found.", status: 404 };
  }

  const userMessage = await prisma.chatMessage.create({
    data: {
      userId,
      threadId: thread.id,
      role: "user",
      content: input.content,
    },
  });

  const parsedActions = await parseGeminiChatMessage(input.content);
  const actions = await Promise.all(
    parsedActions.map((action) =>
      recordAndMaybeExecuteAction({
        userId,
        threadId: thread.id,
        messageId: userMessage.id,
        action,
      }),
    ),
  );

  const assistantMessage = await prisma.chatMessage.create({
    data: {
      userId,
      threadId: thread.id,
      role: "assistant",
      content: buildAssistantResponse(parsedActions),
      metadata: jsonObject({
        actionIds: actions.map((action) => action.id),
      }),
    },
  });

  await prisma.chatThread.update({
    where: { id: thread.id },
    data: { updatedAt: new Date() },
  });

  return {
    ok: true as const,
    value: {
      thread,
      userMessage,
      assistantMessage,
      actions,
    },
  };
}

export async function listChatThreads(userId: string) {
  return prisma.chatThread.findMany({
    where: { userId },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      aiActions: {
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function listThreadMessages(userId: string, threadId: string) {
  const thread = await prisma.chatThread.findFirst({
    where: { id: threadId, userId },
    select: { id: true },
  });

  if (!thread) {
    return { ok: false as const, error: "Chat thread not found.", status: 404 };
  }

  const messages = await prisma.chatMessage.findMany({
    where: { userId, threadId },
    include: {
      aiActions: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return { ok: true as const, value: messages };
}

export async function confirmAiAction(userId: string, actionId: string) {
  const aiAction = await prisma.aiAction.findFirst({
    where: { id: actionId, userId },
  });

  if (!aiAction) {
    return { ok: false as const, error: "AI action not found.", status: 404 };
  }

  if (aiAction.status !== "proposed") {
    return { ok: false as const, error: `AI action is already ${aiAction.status}.`, status: 400 };
  }

  const inputPayload = aiAction.inputPayload as Record<string, unknown>;
  if (inputPayload.ambiguous) {
    return { ok: false as const, error: "AI action needs clarification before it can be confirmed.", status: 400 };
  }

  try {
    const result = await executeAction(userId, {
      actionType: aiAction.actionType as MockParsedAction["actionType"],
      requiresConfirmation: aiAction.requiresConfirmation,
      ambiguous: false,
      inputPayload,
      assistantSummary: "",
    });

    const updatedAction = await prisma.aiAction.update({
      where: { id: aiAction.id },
      data: {
        status: "executed",
        resultPayload: jsonObject(result),
        executedAt: new Date(),
      },
    });

    return { ok: true as const, value: updatedAction };
  } catch (error) {
    const updatedAction = await prisma.aiAction.update({
      where: { id: aiAction.id },
      data: {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown action execution error.",
      },
    });

    return { ok: false as const, error: updatedAction.errorMessage ?? "AI action failed.", status: 400 };
  }
}

export async function cancelAiAction(userId: string, actionId: string) {
  const aiAction = await prisma.aiAction.findFirst({
    where: { id: actionId, userId },
  });

  if (!aiAction) {
    return { ok: false as const, error: "AI action not found.", status: 404 };
  }

  if (aiAction.status !== "proposed") {
    return { ok: false as const, error: `AI action is already ${aiAction.status}.`, status: 400 };
  }

  const updatedAction = await prisma.aiAction.update({
    where: { id: actionId },
    data: { status: "cancelled" },
  });

  return { ok: true as const, value: updatedAction };
}
