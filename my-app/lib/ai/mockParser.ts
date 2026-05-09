export type MockParsedAction = {
  actionType: "CREATE_TASK" | "CREATE_EVENT" | "UPDATE_TASK" | "GENERATE_SCHEDULE";
  requiresConfirmation: boolean;
  ambiguous: boolean;
  inputPayload: Record<string, unknown>;
  assistantSummary: string;
};

const priorityMap = {
  high: 1,
  medium: 3,
  low: 5,
} as const;

function cleanTitle(value: string) {
  return value
    .replace(/\bdue\b.*$/i, "")
    .replace(/\b(high|medium|low) priority\b/gi, "")
    .replace(/\btask\b/gi, "")
    .replace(/\bevent\b/gi, "")
    .replace(/\bappointment\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePriority(text: string) {
  if (/\bhigh priority\b/i.test(text)) return priorityMap.high;
  if (/\bmedium priority\b/i.test(text)) return priorityMap.medium;
  if (/\blow priority\b/i.test(text)) return priorityMap.low;
  return undefined;
}

function parseDueAt(text: string) {
  const dueMatch = text.match(/\bdue\s+(\d{4}-\d{2}-\d{2})(?:\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/i);
  if (!dueMatch) return undefined;

  const [, date, hourText, minuteText, meridiem] = dueMatch;
  let hour = hourText ? Number(hourText) : 23;
  const minute = minuteText ? Number(minuteText) : 59;

  if (meridiem?.toLowerCase() === "pm" && hour < 12) hour += 12;
  if (meridiem?.toLowerCase() === "am" && hour === 12) hour = 0;

  return new Date(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-07:00`);
}

function parseEventWindow(text: string) {
  const dateMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  const timeMatch = text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);

  if (!dateMatch || !timeMatch) {
    return null;
  }

  const [, date] = dateMatch;
  const [, hourText, minuteText, meridiem] = timeMatch;
  let hour = Number(hourText);
  const minute = minuteText ? Number(minuteText) : 0;

  if (meridiem?.toLowerCase() === "pm" && hour < 12) hour += 12;
  if (meridiem?.toLowerCase() === "am" && hour === 12) hour = 0;

  const startTime = new Date(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-07:00`);
  const endTime = new Date(startTime.getTime() + 60 * 60_000);

  return { startTime, endTime };
}

function parseTaskTitle(text: string) {
  const addMatch = text.match(/\badd\s+(.+?)(?:\s+task\b|$)/i);
  if (addMatch) {
    return cleanTitle(addMatch[1]);
  }

  const completeMatch = text.match(/\bcomplete\s+(.+)$/i);
  if (completeMatch) {
    return cleanTitle(completeMatch[1]);
  }

  return "";
}

function parseEventTitle(text: string) {
  const match = text.match(/\b(?:add\s+)?(.+?)\s+(?:event|appointment)\b/i);
  return cleanTitle(match?.[1] ?? text);
}

export function parseMockChatMessage(content: string): MockParsedAction[] {
  const text = content.trim();
  const actions: MockParsedAction[] = [];

  if (!text) return actions;

  if (/\b(add|create|make)\b/i.test(text) && /\btask\b/i.test(text)) {
    const title = parseTaskTitle(text);
    const dueAt = parseDueAt(text);
    const priority = parsePriority(text);
    const ambiguous = !title;

    actions.push({
      actionType: "CREATE_TASK",
      requiresConfirmation: ambiguous,
      ambiguous,
      inputPayload: {
        title,
        dueAt: dueAt?.toISOString(),
        priority,
        cognitiveLoad: 4,
        type: "school",
        workType: "focus",
        timeframe: "weekly",
        createdBy: "chat",
      },
      assistantSummary: ambiguous
        ? "I can add a task, but I need the task title first."
        : `I can add the task "${title}".`,
    });
  }

  if (/\b(event|appointment)\b/i.test(text)) {
    const title = parseEventTitle(text);
    const window = parseEventWindow(text);
    const ambiguous = !title || !window;

    actions.push({
      actionType: "CREATE_EVENT",
      requiresConfirmation: ambiguous,
      ambiguous,
      inputPayload: {
        title,
        startTime: window?.startTime.toISOString(),
        endTime: window?.endTime.toISOString(),
        isAllDay: false,
        source: "chat",
      },
      assistantSummary: ambiguous
        ? "I can create that event, but I need a date and time like 2026-05-12 at 2pm."
        : `I can add the event "${title}".`,
    });
  }

  if (/\bcomplete\b/i.test(text)) {
    const title = parseTaskTitle(text);

    actions.push({
      actionType: "UPDATE_TASK",
      requiresConfirmation: true,
      ambiguous: !title,
      inputPayload: {
        operation: "complete",
        title,
      },
      assistantSummary: title
        ? `I found a request to complete "${title}". Please confirm before I update the task.`
        : "Which task should I complete?",
    });
  } else if (/\bmove\b/i.test(text)) {
    actions.push({
      actionType: "UPDATE_TASK",
      requiresConfirmation: true,
      ambiguous: true,
      inputPayload: {
        operation: "move",
        rawText: text,
      },
      assistantSummary: "Which task or block should I move, and what new time should it use?",
    });
  }

  if (/\b(schedule|plan my day|generate schedule)\b/i.test(text)) {
    actions.push({
      actionType: "GENERATE_SCHEDULE",
      requiresConfirmation: false,
      ambiguous: false,
      inputPayload: {
        rawText: text,
      },
      assistantSummary: "I can generate a simple schedule suggestion from your current tasks and events.",
    });
  }

  return actions;
}
