import { GoogleGenAI } from "@google/genai";
import { parseMockChatMessage, type MockParsedAction } from "@/lib/ai/mockParser";

const VALID_ACTION_TYPES = new Set([
  "CREATE_TASK",
  "CREATE_EVENT",
  "UPDATE_TASK",
  "GENERATE_SCHEDULE",
]);

const responseSchema = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      actionType: {
        type: "STRING",
        enum: ["CREATE_TASK", "CREATE_EVENT", "UPDATE_TASK", "GENERATE_SCHEDULE"],
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
          type: { type: "STRING" },
          workType: { type: "STRING" },
          timeframe: { type: "STRING" },
          description: { type: "STRING" },
          startTime: { type: "STRING" },
          endTime: { type: "STRING" },
          isAllDay: { type: "BOOLEAN" },
          operation: { type: "STRING" },
          rawText: { type: "STRING" },
        },
      },
    },
    required: ["actionType", "requiresConfirmation", "ambiguous", "assistantSummary", "inputPayload"],
  },
};

export function validateGeminiResponse(raw: unknown): MockParsedAction[] {
  if (!Array.isArray(raw)) return [];

  const result: MockParsedAction[] = [];

  for (const item of raw) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) continue;

    const record = item as Record<string, unknown>;

    if (typeof record.actionType !== "string") continue;
    if (!VALID_ACTION_TYPES.has(record.actionType)) continue;

    const inputPayload =
      typeof record.inputPayload === "object" &&
      record.inputPayload !== null &&
      !Array.isArray(record.inputPayload)
        ? (record.inputPayload as Record<string, unknown>)
        : {};

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

const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1",
});

async function callGemini(modelName: string, systemInstruction: string, userText: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: modelName,
    contents: [{ role: "user", parts: [{ text: userText }] }],
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  return response.text ?? "";
}

export async function parseGeminiChatMessage(content: string): Promise<MockParsedAction[]> {
  const today = new Date().toISOString().slice(0, 10);

  const systemInstruction = `You are an AI assistant that extracts structured actions from user messages.
Today's date is ${today}.

You support exactly 4 action types:
- CREATE_TASK: User wants to add a task they need to do.
- CREATE_EVENT: User wants to add a calendar event (fixed time block).
- UPDATE_TASK: User wants to complete, move, or modify an existing task.
- GENERATE_SCHEDULE: User wants a schedule or day plan generated.

For CREATE_TASK, extract:
- title (required): concise task name
- dueAt: ISO 8601 datetime string if a deadline is mentioned (resolve relative dates like "tomorrow", "Friday" using today's date)
- priority: integer 1–7 (1=highest, 7=lowest). Infer from urgency language.
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

Rules:
- Return an empty array [] if the message has no actionable intent (e.g. questions, greetings, casual chat).
- Set ambiguous: true if required fields for the action type are missing.
- Set requiresConfirmation: true for UPDATE_TASK and ambiguous actions.
- Write a short, friendly assistantSummary confirming or clarifying the action.
- Only extract actions that are clearly intended. Do not hallucinate tasks.`;

  const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];

  for (const model of models) {
    try {
      const text = await callGemini(model, systemInstruction, content);

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
