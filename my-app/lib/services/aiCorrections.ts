import { Prisma, type AiCorrection, type AiAction } from "@prisma/client";
import { prisma } from "@/lib/db";

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; status?: number };

const correctionTypes = new Set(["confirmed", "edited", "cancelled", "failed"]);
const correctionSources = new Set(["chat", "image", "voice", "system"]);
const comparisonIgnoredFields = new Set(["ambiguous"]);

type CorrectionType = "confirmed" | "edited" | "cancelled" | "failed";
type CorrectionSource = "chat" | "image" | "voice" | "system";

type AiActionForCorrection = Pick<
  AiAction,
  "id" | "userId" | "threadId" | "messageId" | "actionType" | "inputPayload" | "resultPayload" | "errorMessage"
>;

type CreateCorrectionInput = {
  userId: string;
  aiActionId?: string | null;
  threadId?: string | null;
  messageId?: string | null;
  correctionType: CorrectionType;
  source?: CorrectionSource;
  actionType: string;
  originalUserText?: string | null;
  proposedPayload: unknown;
  correctedPayload?: unknown;
  finalPayload?: unknown;
  errorMessage?: string | null;
};

type CorrectionQuery = {
  correctionType?: string;
  actionType?: string;
  limit: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeForComparison(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeForComparison);
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !comparisonIgnoredFields.has(key))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nestedValue]) => [key, normalizeForComparison(nestedValue)]),
  );
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  if (value === undefined) {
    return {};
  }

  return value as Prisma.InputJsonValue;
}

function optionalJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  return value as Prisma.InputJsonValue;
}

function getSourceFromPayload(payload: unknown): CorrectionSource | undefined {
  if (!isRecord(payload) || typeof payload.source !== "string") {
    return undefined;
  }

  return correctionSources.has(payload.source) ? (payload.source as CorrectionSource) : undefined;
}

async function getOriginalUserText(userId: string, messageId?: string | null) {
  if (!messageId) {
    return null;
  }

  const message = await prisma.chatMessage.findFirst({
    where: { id: messageId, userId, role: "user" },
    select: { content: true },
  });

  return message?.content ?? null;
}

export function hasPayloadCorrection(proposedPayload: unknown, finalPayload: unknown) {
  return JSON.stringify(normalizeForComparison(proposedPayload)) !== JSON.stringify(normalizeForComparison(finalPayload));
}

export function validateAiCorrectionQuery(searchParams: URLSearchParams): ValidationResult<CorrectionQuery> {
  const correctionType = searchParams.get("correctionType")?.trim();
  const actionType = searchParams.get("actionType")?.trim();
  const limitParam = searchParams.get("limit");

  if (correctionType && !correctionTypes.has(correctionType)) {
    return {
      ok: false,
      error: `correctionType must be one of: ${Array.from(correctionTypes).join(", ")}.`,
      status: 400,
    };
  }

  const limit = limitParam === null ? 50 : Number(limitParam);
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    return { ok: false, error: "limit must be an integer between 1 and 200.", status: 400 };
  }

  return {
    ok: true,
    value: {
      correctionType: correctionType || undefined,
      actionType: actionType || undefined,
      limit,
    },
  };
}

export function buildAiCorrectionEvalCase(correction: Pick<
  AiCorrection,
  "id" | "actionType" | "correctionType" | "originalUserText" | "proposedPayload" | "correctedPayload" | "finalPayload" | "errorMessage"
>) {
  return {
    id: correction.id,
    input: correction.originalUserText ?? "",
    expectedActionType: correction.actionType,
    expectedPayload: correction.finalPayload ?? correction.correctedPayload ?? correction.proposedPayload,
    correctionType: correction.correctionType,
    proposedPayload: correction.proposedPayload,
    errorMessage: correction.errorMessage ?? undefined,
  };
}

export function buildAiCorrectionPromptExample(correction: Pick<
  AiCorrection,
  "actionType" | "correctionType" | "originalUserText" | "proposedPayload" | "correctedPayload" | "finalPayload" | "errorMessage"
>) {
  return {
    userText: correction.originalUserText ?? "",
    actionType: correction.actionType,
    expectedPayload: correction.finalPayload ?? correction.correctedPayload ?? correction.proposedPayload,
    correctionType: correction.correctionType,
    previousError: correction.errorMessage ?? undefined,
  };
}

export async function listAiCorrections(userId: string, query: CorrectionQuery) {
  const corrections = await prisma.aiCorrection.findMany({
    where: {
      userId,
      correctionType: query.correctionType,
      actionType: query.actionType,
    },
    orderBy: { createdAt: "desc" },
    take: query.limit,
  });

  return {
    corrections,
    evalCases: corrections.map(buildAiCorrectionEvalCase),
  };
}

export async function listAiCorrectionPromptExamples(userId: string, limit = 8) {
  const corrections = await prisma.aiCorrection.findMany({
    where: {
      userId,
      correctionType: { in: ["edited", "failed"] },
      originalUserText: { not: null },
    },
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(limit, 20)),
  });

  return corrections.map(buildAiCorrectionPromptExample);
}

export async function safeCreateAiCorrection(input: CreateCorrectionInput) {
  try {
    return await prisma.aiCorrection.create({
      data: {
        userId: input.userId,
        aiActionId: input.aiActionId ?? null,
        threadId: input.threadId ?? null,
        messageId: input.messageId ?? null,
        correctionType: input.correctionType,
        source: input.source ?? "chat",
        actionType: input.actionType,
        originalUserText: input.originalUserText ?? null,
        proposedPayload: jsonValue(input.proposedPayload),
        correctedPayload: optionalJsonValue(input.correctedPayload),
        finalPayload: optionalJsonValue(input.finalPayload),
        errorMessage: input.errorMessage ?? null,
      },
    });
  } catch (error) {
    console.error("Failed to record AI correction", error);
    return null;
  }
}

export async function recordAiCorrectionForAction(params: {
  action: AiActionForCorrection;
  correctionType: CorrectionType;
  proposedPayload?: unknown;
  correctedPayload?: unknown;
  finalPayload?: unknown;
  errorMessage?: string | null;
  source?: CorrectionSource;
}) {
  try {
    const proposedPayload = params.proposedPayload ?? params.action.inputPayload;
    const originalUserText = await getOriginalUserText(params.action.userId, params.action.messageId);

    return safeCreateAiCorrection({
      userId: params.action.userId,
      aiActionId: params.action.id,
      threadId: params.action.threadId,
      messageId: params.action.messageId,
      correctionType: params.correctionType,
      source: params.source ?? getSourceFromPayload(proposedPayload) ?? (params.action.threadId ? "chat" : "system"),
      actionType: params.action.actionType,
      originalUserText,
      proposedPayload,
      correctedPayload: params.correctedPayload,
      finalPayload: params.finalPayload,
      errorMessage: params.errorMessage ?? params.action.errorMessage,
    });
  } catch (error) {
    console.error("Failed to prepare AI correction", error);
    return null;
  }
}
