import "dotenv/config";
import { validateGeminiResponse } from "./geminiParser";
import type { MockParsedAction } from "./mockParser";

// In-memory map: our ChatThread.id → Backboard's threadId.
// Resets on server restart — acceptable for demo.
const threadIdMap = new Map<string, string>();

type BackboardClientInstance = {
  sendMessage(input: Record<string, unknown>): Promise<{
    threadId?: string;
    content?: string;
  }>;
};

let _client: BackboardClientInstance | null = null;

async function getClient(): Promise<BackboardClientInstance> {
  const { BackboardClient } = await import("backboard-sdk");
  if (!_client) {
    _client = new BackboardClient({
      apiKey: process.env.BACKBOARD_API_KEY ?? "",
    }) as unknown as BackboardClientInstance;
  }

  return _client;
}

function buildSystemPrompt(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `You are an AI assistant that extracts structured actions from user messages in a planning app. You maintain full conversation context and use previous messages to resolve follow-ups.
Today's date is ${today}.

You support exactly 6 action types:
- CREATE_TASK: User wants to add a task they need to do.
- CREATE_EVENT: User wants to add a calendar event (fixed time block).
- UPDATE_TASK: User wants to complete, move, or modify an existing task.
- GENERATE_SCHEDULE: User wants a schedule or day plan generated.
- DAILY_CHECKIN: User reports today's energy/stress.
- ADJUST_TODAY: User wants today's schedule made lighter or adjusted.

For CREATE_TASK, extract:
- title (required): concise task name. If the user says "that task", "it", or gives only attributes (e.g. "difficulty 7 priority 2"), infer the title from the PREVIOUS message in the conversation.
- dueAt: ISO 8601 datetime if a deadline is mentioned (resolve relative dates using today's date)
- priority: integer 1–5 (1=highest, 5=lowest). Infer from urgency language.
- cognitiveLoad: integer 1–7 (1=easy, 7=very demanding).
- estimatedMinutes: integer if duration is mentioned.
- type: one of "school", "work", "personal", "health", "chores"
- workType: one of "focus", "study", "admin", "creative", "physical"
- timeframe: one of "daily", "weekly", "monthly"
- description: optional extra detail

For CREATE_EVENT, extract:
- title (required)
- startTime: ISO 8601 string (required if time is given)
- endTime: ISO 8601 string
- isAllDay: boolean

For UPDATE_TASK, extract:
- operation: "complete" or "move"
- title: task name (infer from context if user says "that task" or "it")
- rawText: original user text

For GENERATE_SCHEDULE, extract:
- rawText: original user text

For DAILY_CHECKIN, extract:
- energyScore: integer 1-7
- stressScore: integer 1-7
- availableCapacityMinutes: optional integer minutes
- userNote: short summary or original text
- checkinDate: YYYY-MM-DD (default today)
- adjustToday: true

For ADJUST_TODAY, extract:
- rawText: original user text

Rules:
- CRITICAL: Use full conversation history to resolve context. If the user provides only attributes like "difficulty 7 priority 2" or "make it due thursday", look at earlier messages to find which task/event is being referenced and carry its title and all previously known fields forward.
- CRITICAL: When the previous assistant message proposed an ambiguous CREATE_TASK and the user is now supplying the missing fields (difficulty, priority, duration, etc.), return a COMPLETE CREATE_TASK with ALL fields merged — NOT an UPDATE_TASK. UPDATE_TASK is only for tasks that already exist in the database, never for tasks that are still being created in this conversation.
- Return an empty array [] ONLY for pure greetings or read-only lookup questions like "what do I have Monday".
- Never refuse to parse something because of informal or colloquial phrasing — interpret charitably.
- Set ambiguous: true ONLY if required fields (like title for CREATE_TASK) are genuinely unresolvable even from conversation context.
- Set requiresConfirmation: true for UPDATE_TASK, GENERATE_SCHEDULE, and still-ambiguous actions.
- Set requiresConfirmation: false for complete CREATE_TASK, complete DAILY_CHECKIN, and ADJUST_TODAY.
- Write a short, friendly assistantSummary confirming the action.

Return ONLY a valid JSON array. Each element: { actionType, requiresConfirmation, ambiguous, assistantSummary, inputPayload }.`;
}

export async function parseWithBackboard(
  content: string,
  ourThreadId?: string,
): Promise<MockParsedAction[]> {
  const client = await getClient();
  const backboardThreadId = ourThreadId ? threadIdMap.get(ourThreadId) : undefined;

  try {
    const response = (await client.sendMessage({
      content,
      systemPrompt: buildSystemPrompt(),
      jsonOutput: true,
      stream: false,
      memory: "Auto",
      ...(backboardThreadId ? { threadId: backboardThreadId } : {}),
    }));

    if (ourThreadId && response.threadId) {
      threadIdMap.set(ourThreadId, response.threadId);
    }

    const raw = response.content ?? "";
    console.log("[backboard] raw response:", raw.slice(0, 300));

    // Strip markdown code fences if present
    const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      console.error("[backboard] Failed to parse JSON:", text.slice(0, 300));
      return [];
    }

    const actions = validateGeminiResponse(parsed);
    console.log(`[backboard] Parsed ${actions.length} action(s) for thread ${ourThreadId?.slice(0, 8)}`);
    return actions;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[backboard] Error:", message);
    return [];
  }
}
