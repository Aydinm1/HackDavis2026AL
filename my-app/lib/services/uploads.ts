import { Prisma } from "@prisma/client";
import { parseGeminiMultimodal, parseGeminiVoice } from "@/lib/ai/geminiParser";
import { prisma } from "@/lib/db";

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; status?: number };

export type VoiceUploadInput = {
  audioData: string;
  mimeType: string;
};

export type ImageUploadInput = {
  images: { imageData: string; mimeType: string }[];
  textMessage?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonObject(value: unknown): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject;
}

export function validateVoiceUploadBody(body: unknown): ValidationResult<VoiceUploadInput> {
  if (!isRecord(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  if (typeof body.audioData !== "string" || !body.audioData) {
    return { ok: false, error: "audioData is required and must be a non-empty string." };
  }

  if (typeof body.mimeType !== "string" || !body.mimeType) {
    return { ok: false, error: "mimeType is required and must be a non-empty string." };
  }

  return { ok: true, value: { audioData: body.audioData, mimeType: body.mimeType } };
}

export function validateImageUploadBody(body: unknown): ValidationResult<ImageUploadInput> {
  if (!isRecord(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  if (!Array.isArray(body.images) || body.images.length === 0) {
    return { ok: false, error: "images must be a non-empty array." };
  }

  for (const img of body.images) {
    if (!isRecord(img) || typeof img.imageData !== "string" || !img.imageData) {
      return { ok: false, error: "Each image must have a non-empty imageData string." };
    }
    if (typeof img.mimeType !== "string" || !img.mimeType) {
      return { ok: false, error: "Each image must have a non-empty mimeType string." };
    }
  }

  const textMessage = typeof body.textMessage === "string" && body.textMessage.trim()
    ? body.textMessage.trim()
    : undefined;

  return {
    ok: true,
    value: {
      images: body.images as { imageData: string; mimeType: string }[],
      textMessage,
    },
  };
}

export async function createVoiceUpload(userId: string, input: VoiceUploadInput) {
  const parts = [{ inlineData: { data: input.audioData, mimeType: input.mimeType } }];
  const { transcript, actions: parsedActions } = await parseGeminiVoice(parts);

  const parsedItems = parsedActions.map((action) => ({
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
      rawTextExtracted: transcript || null,
      parsedPayload: jsonObject({ parsedItems }),
      confidenceScore: parsedItems.length > 0 ? 0.82 : 0.35,
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
          requiresConfirmation: item.requiresConfirmation,
          inputPayload: jsonObject({
            ...item.inputPayload,
            uploadedInputId: uploadedInput.id,
            ambiguous: item.ambiguous,
          }),
        },
      }),
    ),
  );

  return { transcript, uploadedInput, parsedItems, proposedActions };
}

export async function createImageUpload(userId: string, input: ImageUploadInput) {
  const parts = [
    ...input.images.map((img) => ({ inlineData: { data: img.imageData, mimeType: img.mimeType } })),
    ...(input.textMessage ? [{ text: input.textMessage }] : []),
  ];
  const parsedActions = await parseGeminiMultimodal(parts, "image");

  const parsedItems = parsedActions.map((action) => ({
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
      sourceType: "image",
      parsedPayload: jsonObject({ parsedItems }),
      confidenceScore: parsedItems.length > 0 ? 0.82 : 0.35,
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
          requiresConfirmation: item.requiresConfirmation,
          inputPayload: jsonObject({
            ...item.inputPayload,
            uploadedInputId: uploadedInput.id,
            ambiguous: item.ambiguous,
          }),
        },
      }),
    ),
  );

  return { uploadedInput, parsedItems, proposedActions };
}
