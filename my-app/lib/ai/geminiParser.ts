import { GoogleGenAI, ThinkingLevel, type GenerateContentConfig, type Part } from "@google/genai";
import { parseMockChatMessage, type MockParsedAction } from "@/lib/ai/mockParser";

const DEFAULT_GEMINI_MODELS = ["gemini-2.5-flash-lite", "gemini-2.0-flash-lite", "gemini-2.5-flash"];

const VALID_ACTION_TYPES = new Set([
  "CREATE_TASK",
  "CREATE_EVENT",
  "UPDATE_TASK",
  "GENERATE_SCHEDULE",
  "DAILY_CHECKIN",
  "ADJUST_TODAY",
]);

const responseSchema = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      actionType: {
        type: "STRING",
        enum: ["CREATE_TASK", "CREATE_EVENT", "UPDATE_TASK", "GENERATE_SCHEDULE", "DAILY_CHECKIN", "ADJUST_TODAY"],
      },
      requiresConfirmation: { type: "BOOLEAN" },
      ambiguous: { type: "BOOLEAN" },
      assistantSummary: { type: "STRING" },
      inputPayload: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          dueAt: { type: "STRING" },
          priority: { type: "NUMBER" },
          cognitiveLoad: { type: "NUMBER" },
          type: { type: "STRING", enum: ["school", "work", "personal", "health", "chores"] },
          workType: { type: "STRING", enum: ["focus", "study", "admin", "creative", "physical"] },
          timeframe: { type: "STRING", enum: ["daily", "weekly", "monthly"] },
          description: { type: "STRING" },
          startTime: { type: "STRING" },
          endTime: { type: "STRING" },
          isAllDay: { type: "BOOLEAN" },
          operation: { type: "STRING", enum: ["complete", "move"] },
          energyScore: { type: "NUMBER" },
          stressScore: { type: "NUMBER" },
          availableCapacityMinutes: { type: "NUMBER" },
          userNote: { type: "STRING" },
          checkinDate: { type: "STRING" },
          adjustToday: { type: "BOOLEAN" },
          rawText: { type: "STRING" },
        },
      },
    },
    required: ["actionType", "requiresConfirmation", "ambiguous", "assistantSummary", "inputPayload"],
  },
};

const VALID_TYPES = new Set(["school", "work", "personal", "health", "chores"]);
const VALID_WORK_TYPES = new Set(["focus", "study", "admin", "creative", "physical"]);
const VALID_TIMEFRAMES = new Set(["daily", "weekly", "monthly"]);
const VALID_OPERATIONS = new Set(["complete", "move"]);

function sanitizePayload(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };
  if (typeof out.type === "string" && !VALID_TYPES.has(out.type)) delete out.type;
  if (typeof out.workType === "string" && !VALID_WORK_TYPES.has(out.workType)) delete out.workType;
  if (typeof out.timeframe === "string" && !VALID_TIMEFRAMES.has(out.timeframe)) delete out.timeframe;
  if (typeof out.operation === "string" && !VALID_OPERATIONS.has(out.operation)) delete out.operation;
  return out;
}

export function validateGeminiResponse(raw: unknown): MockParsedAction[] {
  if (!Array.isArray(raw)) return [];

  const result: MockParsedAction[] = [];

  for (const item of raw) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) continue;

    const record = item as Record<string, unknown>;

    if (typeof record.actionType !== "string") continue;
    if (!VALID_ACTION_TYPES.has(record.actionType)) continue;

    const rawPayload =
      typeof record.inputPayload === "object" &&
      record.inputPayload !== null &&
      !Array.isArray(record.inputPayload)
        ? (record.inputPayload as Record<string, unknown>)
        : {};

    const inputPayload = sanitizePayload(rawPayload);

    result.push({
      actionType: record.actionType as MockParsedAction["actionType"],
      requiresConfirmation: record.requiresConfirmation === true,
      ambiguous: record.ambiguous === true,
      assistantSummary: typeof record.assistantSummary === "string" ? record.assistantSummary : "",
      inputPayload,
    });
  }

  return result;
}

let ai: GoogleGenAI | null = null;

function parseModelList(value: string | undefined) {
  return value
    ?.split(",")
    .map((model) => model.trim())
    .filter(Boolean) ?? [];
}

function getGeminiModels() {
  const configuredModels = [
    ...parseModelList(process.env.GEMINI_MODEL),
    ...parseModelList(process.env.GEMINI_FALLBACK_MODELS),
  ];

  return configuredModels.length > 0 ? configuredModels : DEFAULT_GEMINI_MODELS;
}

function getThinkingConfig(modelName: string): GenerateContentConfig["thinkingConfig"] {
  if (modelName.startsWith("gemini-3")) {
    return { thinkingLevel: ThinkingLevel.MINIMAL };
  }

  return { thinkingBudget: 0 };
}

function getGeminiClient() {
  ai ??= new GoogleGenAI({
    vertexai: true,
    project: process.env.GOOGLE_CLOUD_PROJECT,
    location: process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1",
  });

  return ai;
}

async function callGemini(modelName: string, systemInstruction: string, parts: Part[]): Promise<string> {
  const response = await getGeminiClient().models.generateContent({
    model: modelName,
    contents: [{ role: "user", parts }],
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema,
      thinkingConfig: getThinkingConfig(modelName),
    },
  });
  return response.text ?? "";
}

async function callGeminiTranscribe(modelName: string, parts: Part[]): Promise<string> {
  const response = await getGeminiClient().models.generateContent({
    model: modelName,
    contents: [{ role: "user", parts }],
    config: {
      systemInstruction:
        "You are a transcription service. Listen to the audio and return ONLY the verbatim transcript of what was said. Do not add any commentary, formatting, or JSON. Just the spoken words.",
      thinkingConfig: getThinkingConfig(modelName),
    },
  });
  return (response.text ?? "").trim();
}

export async function parseGeminiChatMessage(content: string): Promise<MockParsedAction[]> {
  const today = new Date().toISOString().slice(0, 10);

  const systemInstruction = `You are an AI assistant that extracts structured actions from user messages.
Today's date is ${today}.

You support exactly 6 action types:
- CREATE_TASK: User wants to add a task they need to do.
- CREATE_EVENT: User wants to add a calendar event (fixed time block).
- UPDATE_TASK: User wants to complete, move, or modify an existing task.
- GENERATE_SCHEDULE: User wants a schedule or day plan generated.
- DAILY_CHECKIN: User reports today's energy/stress or responds to a check-in prompt.
- ADJUST_TODAY: User wants today's existing schedule made lighter, adjusted, or rebalanced based on stress/energy.

For CREATE_TASK, extract:
- title (required): concise task name
- dueAt: ISO 8601 datetime string if a deadline is mentioned (resolve relative dates like "tomorrow", "Friday" using today's date)
- priority: integer 1–5 (1=highest, 5=lowest). Infer from urgency language.
- cognitiveLoad: integer 1–7 (1=easy, 7=very demanding). Infer from complexity.
- type: one of "school", "work", "personal", "health", "chores"
- workType: one of "focus", "study", "admin", "creative", "physical"
- timeframe: one of "daily", "weekly", "monthly"
- description: optional extra detail

For CREATE_EVENT, extract:
- title (required)
- startTime: ISO 8601 string (required if time is given)
- endTime: ISO 8601 string (required if duration or end time given)
- isAllDay: boolean

For UPDATE_TASK, extract:
- operation: "complete" or "move"
- title: task name being updated
- rawText: original user text

For GENERATE_SCHEDULE, extract:
- rawText: original user text

For DAILY_CHECKIN, extract:
- energyScore: integer 1-7 if mentioned or clearly inferable
- stressScore: integer 1-7 if mentioned or clearly inferable
- availableCapacityMinutes: optional integer minutes if mentioned
- userNote: short summary or original text
- checkinDate: YYYY-MM-DD if mentioned, otherwise today's date
- adjustToday: true

For ADJUST_TODAY, extract:
- rawText: original user text

Rules:
- Return an empty array [] ONLY for pure greetings or read-only questions. If there is ANY hint of a task, event, plan, or activity — extract it.
- Return an empty array [] for read-only questions like "what do I have to do Monday", "what is my highest priority task Monday", or "show my top task Friday". Do not turn those into GENERATE_SCHEDULE.
- If the previous assistant proposed an ambiguous CREATE_TASK and the user is supplying missing fields like difficulty, priority, or duration, return a CREATE_TASK with the merged fields, not UPDATE_TASK. UPDATE_TASK is only for tasks that already exist in the database.
- Never refuse to parse something because the wording sounds unusual, informal, or colloquial. Take the user at their word and extract the best-fit action.
- Interpret all colloquial, slang, and informal expressions as social plans or tasks. "beat [someone] up", "link up", "hang with", "kick it with", "chill with", "vibe with", "pull up on", "see [someone]" all mean meeting/socializing → CREATE_EVENT.
- Social plans with a time are CREATE_EVENT with a descriptive title using the person's name (e.g. "Hang with Raghav").
- Set ambiguous: true if required fields for the action type are missing. DAILY_CHECKIN requires both energyScore and stressScore.
- Set requiresConfirmation: true for UPDATE_TASK, GENERATE_SCHEDULE, and ambiguous actions.
- Set requiresConfirmation: false for complete DAILY_CHECKIN actions.
- Set requiresConfirmation: false for ADJUST_TODAY actions.
- Write a short, friendly assistantSummary confirming or clarifying the action.
- Do not hallucinate tasks that have no basis in the message.`;

  const models = getGeminiModels();

  for (const model of models) {
    try {
      const text = await callGemini(model, systemInstruction, [{ text: content }]);

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        console.error(`[geminiParser] Failed to parse JSON response from ${model}:`, text);
        continue;
      }

      const actions = validateGeminiResponse(parsed);
      console.log(`[geminiParser] Parsed ${actions.length} action(s) using ${model}`);
      return actions;
    } catch (error) {
      const status = (error as { status?: number }).status;
      const message = error instanceof Error ? error.message : String(error);
      if (status === 429 || status === 503) {
        console.warn(`[geminiParser] ${model} quota/overload (${status}), trying next model…`);
        continue;
      }
      console.error(`[geminiParser] Gemini error on ${model} (status=${status}): ${message}`);
      // try next model on any error
      continue;
    }
  }

  console.warn("[geminiParser] All Gemini models failed — falling back to mock parser");
  return parseMockChatMessage(content);
}

export async function parseGeminiMultimodal(
  parts: Part[],
  mode: "voice" | "image"
): Promise<MockParsedAction[]> {
  const today = new Date().toISOString().slice(0, 10);

  const actionRules = `
You support exactly 6 action types:
- CREATE_TASK: A task the user needs to do.
- CREATE_EVENT: A fixed calendar event with a time.
- UPDATE_TASK: Completing, moving, or modifying an existing task.
- GENERATE_SCHEDULE: A request to generate a daily plan or schedule.
- DAILY_CHECKIN: Today's energy/stress check-in from text or transcript.
- ADJUST_TODAY: User wants today's existing schedule made lighter, adjusted, or rebalanced based on stress/energy.

For CREATE_TASK, extract:
- title (required): concise task name
- dueAt: ISO 8601 datetime string if a deadline is mentioned (resolve relative dates using today's date)
- priority: integer 1–5 (1=highest, 5=lowest)
- cognitiveLoad: integer 1–7 (1=easy, 7=very demanding)
- type: one of "school", "work", "personal", "health", "chores"
- workType: one of "focus", "study", "admin", "creative", "physical"
- timeframe: one of "daily", "weekly", "monthly"
- description: optional extra detail

For CREATE_EVENT, extract:
- title (required)
- startTime: ISO 8601 string
- endTime: ISO 8601 string
- isAllDay: boolean

For UPDATE_TASK, extract:
- operation: "complete" or "move"
- title: task name being updated
- rawText: original user text

For GENERATE_SCHEDULE, extract:
- rawText: original user text

For DAILY_CHECKIN, extract:
- energyScore: integer 1-7 if mentioned or clearly inferable
- stressScore: integer 1-7 if mentioned or clearly inferable
- availableCapacityMinutes: optional integer minutes if mentioned
- userNote: short summary or original text
- checkinDate: YYYY-MM-DD if mentioned, otherwise today's date
- adjustToday: true

For ADJUST_TODAY, extract:
- rawText: original user text

Rules:
- Return an empty array [] if no actionable intent is found.
- If the previous assistant proposed an ambiguous CREATE_TASK and the user is supplying missing fields like difficulty, priority, or duration, return a CREATE_TASK with the merged fields, not UPDATE_TASK. UPDATE_TASK is only for tasks that already exist in the database.
- Set ambiguous: true if required fields are missing. DAILY_CHECKIN requires both energyScore and stressScore.
- Set requiresConfirmation: true for UPDATE_TASK and ambiguous actions.
- Set requiresConfirmation: false for complete DAILY_CHECKIN actions.
- Set requiresConfirmation: false for ADJUST_TODAY actions.
- Write a short, friendly assistantSummary confirming or clarifying the action.
- Only extract actions that are clearly intended. Do not hallucinate tasks.`;

  const systemInstruction =
    mode === "voice"
      ? `You are listening to a voice memo. Transcribe the intent and extract structured actions (tasks, events, schedule requests). Today is ${today}.${actionRules}`
      : `You are analyzing an image the user uploaded (e.g. a schedule, to-do list, whiteboard, screenshot). Extract all tasks or events you can see. Today is ${today}.${actionRules}`;

  const models = getGeminiModels();

  for (const model of models) {
    try {
      const text = await callGemini(model, systemInstruction, parts);

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        console.error(`[geminiParser] Failed to parse JSON response from ${model} (${mode}):`, text);
        continue;
      }

      const actions = validateGeminiResponse(parsed);
      console.log(`[geminiParser] Multimodal (${mode}): parsed ${actions.length} action(s) using ${model}`);
      return actions;
    } catch (error) {
      const status = (error as { status?: number }).status;
      const message = error instanceof Error ? error.message : String(error);
      if (status === 429 || status === 503) {
        console.warn(`[geminiParser] ${model} quota/overload (${status}), trying next model…`);
        continue;
      }
      console.error(`[geminiParser] Gemini error on ${model} (${mode}, status=${status}): ${message}`);
      continue;
    }
  }

  console.warn(`[geminiParser] All Gemini models failed for ${mode} — falling back to empty`);
  return parseMockChatMessage("");
}

export async function parseGeminiVoice(
  parts: Part[]
): Promise<{ transcript: string; actions: MockParsedAction[] }> {
  const models = getGeminiModels();

  // Step 1: plain transcription (no JSON schema — avoids schema-key bleed)
  let transcript = "";
  for (const model of models) {
    try {
      transcript = await callGeminiTranscribe(model, parts);
      console.log(`[geminiParser] Voice transcript via ${model}: "${transcript.slice(0, 80)}…"`);
      break;
    } catch (error) {
      const status = (error as { status?: number }).status;
      const message = error instanceof Error ? error.message : String(error);
      if (status === 429 || status === 503) {
        console.warn(`[geminiParser] ${model} quota/overload (${status}), trying next for transcription…`);
        continue;
      }
      console.error(`[geminiParser] Gemini transcribe error on ${model} (status=${status}): ${message}`);
      continue;
    }
  }

  // Step 2: extract actions from the transcript text (same as chat)
  const actions = transcript ? await parseGeminiChatMessage(transcript) : [];

  return { transcript, actions };
}
