import { Prisma } from "@prisma/client";
import { parseGeminiMultimodal, parseGeminiVoice } from "@/lib/ai/geminiParser";
import type { MockParsedAction } from "@/lib/ai/mockParser";
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

function parseMonthName(value: string) {
  const month = value.toLowerCase();
  return [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ].findIndex((name) => name.startsWith(month));
}

function parseClockTime(hourText: string, minuteText: string | undefined, meridiemText: string) {
  let hour = Number(hourText);
  const minute = Number(minuteText ?? "0");
  const meridiem = meridiemText.toLowerCase();
  if (meridiem === "pm" && hour !== 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  return { hour, minute };
}

function inferEventWindowFromText(text: string) {
  const dateMatch = text.match(
    /\b(?:mon|tue|wed|thu|fri|sat|sun)?(?:day)?[,]?\s*(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(\d{4})\b/i,
  );
  if (!dateMatch) return null;

  const [, monthText, dayText, yearText] = dateMatch;
  const month = parseMonthName(monthText);
  if (month < 0) return null;

  const timeRangeMatch = text.match(
    /\bfrom\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s+to\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i,
  );
  const singleTimeMatch = text.match(/\b(?:at|from)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  const timeMatch = timeRangeMatch ?? singleTimeMatch;
  if (!timeMatch) return null;

  const startClock = parseClockTime(timeMatch[1], timeMatch[2], timeMatch[3]);
  const start = new Date(Number(yearText), month, Number(dayText), startClock.hour, startClock.minute);
  if (Number.isNaN(start.getTime())) return null;

  if (timeRangeMatch) {
    const endClock = parseClockTime(timeRangeMatch[4], timeRangeMatch[5], timeRangeMatch[6]);
    const end = new Date(Number(yearText), month, Number(dayText), endClock.hour, endClock.minute);
    if (!Number.isNaN(end.getTime()) && end > start) {
      return { start, end, inferredDurationMinutes: Math.round((end.getTime() - start.getTime()) / 60_000) };
    }
  }

  return {
    start,
    end: new Date(start.getTime() + 60 * 60_000),
    inferredDurationMinutes: 60,
  };
}

function normalizeUploadCreateEventAction(action: MockParsedAction): MockParsedAction {
  if (action.actionType !== "CREATE_EVENT") return action;

  const payload = action.inputPayload;
  const summary = action.assistantSummary;
  const payloadStart = typeof payload.startTime === "string" ? new Date(payload.startTime) : null;
  const validPayloadStart = payloadStart && !Number.isNaN(payloadStart.getTime()) ? payloadStart : null;
  const inferredWindow = validPayloadStart
    ? {
        start: validPayloadStart,
        end: new Date(validPayloadStart.getTime() + 60 * 60_000),
        inferredDurationMinutes: 60,
      }
    : inferEventWindowFromText(summary);
  const startTime = typeof payload.startTime === "string"
    ? payload.startTime
    : inferredWindow?.start.toISOString();
  const endTime = typeof payload.endTime === "string"
    ? payload.endTime
    : inferredWindow
      ? inferredWindow.end.toISOString()
      : undefined;
  const ambiguous = action.ambiguous || !payload.title || !startTime || !endTime;

  return {
    ...action,
    requiresConfirmation: true,
    ambiguous,
    inputPayload: {
      ...payload,
      startTime,
      endTime,
      isAllDay: typeof payload.isAllDay === "boolean" ? payload.isAllDay : false,
      source: "image",
      inferredDurationMinutes: !payload.endTime && inferredWindow ? inferredWindow.inferredDurationMinutes : undefined,
    },
    assistantSummary: ambiguous
      ? action.assistantSummary
      : action.assistantSummary.replace(/^I've added\b/i, "I found"),
  };
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
  const parsedActions = (await parseGeminiMultimodal(parts, "image")).map(normalizeUploadCreateEventAction);

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
