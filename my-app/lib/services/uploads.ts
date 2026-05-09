import { Prisma } from "@prisma/client";
import { parseMockChatMessage } from "@/lib/ai/mockParser";
import { prisma } from "@/lib/db";

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; status?: number };

type UploadInput = {
  fileUrl?: string | null;
  rawTextExtracted?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseNullableString(value: unknown, field: string): ValidationResult<string | null | undefined> {
  if (value === undefined) {
    return { ok: true, value: undefined };
  }

  if (value === null) {
    return { ok: true, value: null };
  }

  if (typeof value !== "string") {
    return { ok: false, error: `${field} must be a string or null.` };
  }

  return { ok: true, value: value.trim() || null };
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

export function validateUploadBody(body: unknown): ValidationResult<UploadInput> {
  if (!isRecord(body)) {
    return { ok: false, error: "Request body must be a JSON object for MVP upload endpoints." };
  }

  const unknownFieldsError = rejectUnknownFields(body, ["fileUrl", "rawTextExtracted"]);
  if (unknownFieldsError) {
    return { ok: false, error: unknownFieldsError };
  }

  const fileUrl = parseNullableString(body.fileUrl, "fileUrl");
  if (!fileUrl.ok) return fileUrl;

  const rawTextExtracted = parseNullableString(body.rawTextExtracted, "rawTextExtracted");
  if (!rawTextExtracted.ok) return rawTextExtracted;

  if (!fileUrl.value && !rawTextExtracted.value) {
    return { ok: false, error: "fileUrl or rawTextExtracted is required." };
  }

  return {
    ok: true,
    value: {
      fileUrl: fileUrl.value,
      rawTextExtracted: rawTextExtracted.value,
    },
  };
}

function getImageParsedItems(input: UploadInput) {
  return [
    {
      type: "calendar_event",
      title: "Review uploaded schedule item",
      description: input.rawTextExtracted ?? "Mock event parsed from uploaded image.",
      startTime: "2026-05-12T14:00:00-07:00",
      endTime: "2026-05-12T15:00:00-07:00",
      source: "image",
      confidenceScore: 0.62,
    },
  ];
}

export async function createImageUpload(userId: string, input: UploadInput) {
  const parsedItems = getImageParsedItems(input);

  const uploadedInput = await prisma.uploadedInput.create({
    data: {
      userId,
      sourceType: "image",
      fileUrl: input.fileUrl,
      rawTextExtracted: input.rawTextExtracted,
      parsedPayload: jsonObject({ parsedItems }),
      confidenceScore: 0.62,
      status: "parsed",
    },
  });

  const proposedActions = await Promise.all(
    parsedItems.map((item) =>
      prisma.aiAction.create({
        data: {
          userId,
          actionType: "CREATE_EVENT",
          status: "proposed",
          requiresConfirmation: true,
          inputPayload: jsonObject({
            title: item.title,
            description: item.description,
            startTime: item.startTime,
            endTime: item.endTime,
            isAllDay: false,
            source: "image",
            uploadedInputId: uploadedInput.id,
          }),
        },
      }),
    ),
  );

  return {
    uploadedInput,
    parsedItems,
    proposedActions,
  };
}

export async function createVoiceUpload(userId: string, input: UploadInput) {
  const transcript = input.rawTextExtracted ?? "";
  const parsedItems = parseMockChatMessage(transcript).map((action) => ({
    type: action.actionType.toLowerCase(),
    actionType: action.actionType,
    requiresConfirmation: action.requiresConfirmation,
    ambiguous: action.ambiguous,
    inputPayload: action.inputPayload,
    assistantSummary: action.assistantSummary,
  }));

  const uploadedInput = await prisma.uploadedInput.create({
    data: {
      userId,
      sourceType: "voice",
      fileUrl: input.fileUrl,
      rawTextExtracted: transcript,
      parsedPayload: jsonObject({ parsedItems }),
      confidenceScore: parsedItems.length > 0 ? 0.74 : 0.35,
      status: parsedItems.length > 0 ? "parsed" : "failed",
    },
  });

  const proposedActions = await Promise.all(
    parsedItems.map((item) =>
      prisma.aiAction.create({
        data: {
          userId,
          actionType: item.actionType,
          status: "proposed",
          requiresConfirmation: true,
          inputPayload: jsonObject({
            ...item.inputPayload,
            uploadedInputId: uploadedInput.id,
            ambiguous: item.ambiguous,
          }),
        },
      }),
    ),
  );

  return {
    uploadedInput,
    parsedItems,
    proposedActions,
  };
}
