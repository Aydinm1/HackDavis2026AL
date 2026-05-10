export type MockParsedAction = {
  actionType: "CREATE_TASK" | "CREATE_EVENT" | "UPDATE_TASK" | "GENERATE_SCHEDULE" | "DAILY_CHECKIN" | "ADJUST_TODAY";
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

const weekdayIndex: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

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

function inferStudyTitle(text: string) {
  const subjectMatch = text.match(/\b(?:for|in)\s+([a-z][a-z\s&-]*?)(?:\s+(?:at|on|by|due)\b|$)/i);
  const subject = cleanTitle(subjectMatch?.[1] ?? "").replace(/\bthis\b/i, "").trim();
  const assessment = text.match(/\b(midterm|exam|test|quiz|final)\b/i)?.[1]?.toLowerCase() ?? "assessment";

  if (!subject) {
    return `Study for ${assessment}`;
  }

  return `Study for ${subject} ${assessment}`;
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

function parseEventDate(text: string) {
  const dateMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (dateMatch) {
    return dateMatch[1];
  }

  const weekdayMatch = text.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
  if (!weekdayMatch) {
    return null;
  }

  const today = new Date();
  const targetDay = weekdayIndex[weekdayMatch[1].toLowerCase()];
  const daysUntil = (targetDay - today.getDay() + 7) % 7;
  const date = new Date(today);
  date.setDate(today.getDate() + daysUntil);

  return date.toISOString().slice(0, 10);
}

function parseEventWindow(text: string) {
  const date = parseEventDate(text);
  const timeMatch = text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);

  if (!date || !timeMatch) {
    return null;
  }

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

function parseCheckinScore(text: string, label: "energy" | "stress") {
  const directMatch = text.match(new RegExp(`\\b${label}\\s*(?:is|=|:)?\\s*([1-7])\\b`, "i"));
  if (directMatch) {
    return Number(directMatch[1]);
  }

  const outOfMatch = text.match(new RegExp(`\\b([1-7])\\s*/\\s*7\\s+${label}\\b`, "i"));
  if (outOfMatch) {
    return Number(outOfMatch[1]);
  }

  return undefined;
}

export function inferDailyEnergyScore(text: string) {
  const explicit = parseCheckinScore(text, "energy");
  if (explicit) return explicit;

  if (/\b(no energy|zero energy|completely drained|can't move|can barely function|burnt out|burned out)\b/i.test(text)) return 1;
  if (/\b(fully energized|super energized|pumped|amazing energy|great energy)\b/i.test(text)) return 7;
  if (/\b(energized|high energy|good energy|locked in|ready to go)\b/i.test(text)) return 6;
  if (/\b(decent|alright|pretty good|some energy)\b/i.test(text)) return 5;
  if (/\b(okay|ok|fine|average|normal|neutral)\b/i.test(text) && /\b(energy|feel|feeling)\b/i.test(text)) return 4;
  if (/\b(kinda tired|kind of tired|a little tired|sluggish|low-ish energy|lowish energy)\b/i.test(text)) return 3;
  if (/\b(drained|exhausted|wiped|wiped out|tired|low energy|really low energy|super low energy|dead|spent)\b/i.test(text)) return 2;

  if (/\benergy\s+(?:is\s+)?low\b/i.test(text)) return 2;
  if (/\benergy\s+(?:is\s+)?medium\b/i.test(text)) return 4;
  if (/\benergy\s+(?:is\s+)?high\b/i.test(text)) return 6;

  return undefined;
}

export function inferDailyStressScore(text: string) {
  const explicit = parseCheckinScore(text, "stress");
  if (explicit) return explicit;

  if (/\b(no stress|zero stress|peaceful|totally calm)\b/i.test(text)) return 1;
  if (/\b(max stress|maximum stress|stress\s+(?:is\s+)?max|stress\s+(?:is\s+)?maximum|crisis|can't cope|cannot cope|spiraling)\b/i.test(text)) return 7;
  if (/\b(overwhelmed|very stressed|really stressed|super stressed|high stress|panicking|panic|anxious|freaking out)\b/i.test(text)) return 6;
  if (/\b(stressed|busy|under pressure|pressure)\b/i.test(text)) return 5;
  if (/\b(manageable|medium stress|average stress|normal stress)\b/i.test(text)) return 4;
  if (/\b(a little stressed|slightly stressed|minor stress|kind of stressed|kinda stressed)\b/i.test(text)) return 3;
  if (/\b(calm|low stress|not stressed|pretty calm)\b/i.test(text)) return 2;

  if (/\bstress\s+(?:is\s+)?low\b/i.test(text)) return 2;
  if (/\bstress\s+(?:is\s+)?medium\b/i.test(text)) return 4;
  if (/\bstress\s+(?:is\s+)?high\b/i.test(text)) return 6;

  return undefined;
}

export function parseDailyAvailableCapacityMinutes(text: string) {
  const capacityMatch = text.match(/\b(?:available|capacity|free)\s+(?:for\s+)?(\d+)\s*(?:minutes?|mins?|m)\b/i);
  if (capacityMatch) return Number(capacityMatch[1]);

  const trailingCapacityMatch = text.match(/\b(\d+)\s*(?:minutes?|mins?|m)\s+(?:available|free)\b/i);
  if (trailingCapacityMatch) return Number(trailingCapacityMatch[1]);

  const hourCapacityMatch = text.match(/\b(?:available|capacity|free)\s+(?:for\s+)?(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i);
  if (hourCapacityMatch) return Math.round(Number(hourCapacityMatch[1]) * 60);

  const trailingHourCapacityMatch = text.match(/\b(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\s+(?:available|free)\b/i);
  if (trailingHourCapacityMatch) return Math.round(Number(trailingHourCapacityMatch[1]) * 60);

  return undefined;
}

function isDailyCheckinMessage(text: string) {
  const hasScore = /\b(?:energy|stress)\s*(?:is|=|:)?\s*[1-7]\b/i.test(text);
  const hasCheckinLanguage = /\b(check.?in|energy|stress|drained|exhausted|overwhelmed|stressed|available capacity|calm|energized|tired|anxious|burnt out|burned out)\b/i.test(text);
  const hasIntensityLanguage = /\b(low|medium|high|super|very|really|zero|max|maximum)\b/i.test(text);
  return hasScore || (hasCheckinLanguage && (hasIntensityLanguage || /\b(today|right now|rn|i'?m|i am|feeling|feel)\b/i.test(text)));
}

function isImplicitStudyTask(text: string) {
  return /\b(study|review|prepare|prep)\b/i.test(text) && /\b(midterm|exam|test|quiz|final)\b/i.test(text);
}

function parseEventTitle(text: string) {
  const assessmentForSubjectMatch = text.match(/\b(midterm|exam|test|quiz|final)\b.*?\b(?:for|in)\s+([a-z][a-z\s&-]*?)(?:\s+(?:at|on|by|due|i need|need|that|this)\b|$)/i);
  if (assessmentForSubjectMatch) {
    return cleanTitle(`${assessmentForSubjectMatch[2]} ${assessmentForSubjectMatch[1]}`);
  }

  const assessmentMatch = text.match(/\b(?:for|in)?\s*([a-z][a-z\s&-]*?)\s+(midterm|exam|test|quiz|final)\b/i);
  if (assessmentMatch) {
    return cleanTitle(`${assessmentMatch[1]} ${assessmentMatch[2]}`);
  }

  const match = text.match(/\b(?:add\s+)?(.+?)\s+(?:event|appointment)\b/i);
  return cleanTitle(match?.[1] ?? text);
}

function isImplicitCalendarEvent(text: string) {
  return /\b(midterm|exam|test|quiz|final|event|appointment)\b/i.test(text) && /\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/i.test(text);
}

export function parseMockChatMessage(content: string): MockParsedAction[] {
  const text = content.trim();
  const actions: MockParsedAction[] = [];

  if (!text) return actions;

  if (isDailyCheckinMessage(text)) {
    const energyScore = inferDailyEnergyScore(text);
    const stressScore = inferDailyStressScore(text);
    const ambiguous = !energyScore || !stressScore;

    actions.push({
      actionType: "DAILY_CHECKIN",
      requiresConfirmation: ambiguous,
      ambiguous,
      inputPayload: {
        energyScore,
        stressScore,
        availableCapacityMinutes: parseDailyAvailableCapacityMinutes(text),
        userNote: text,
        adjustToday: true,
      },
      assistantSummary: ambiguous
        ? "I can save today's check-in, but I need both energy and stress from 1-7."
        : `I logged today's check-in as energy ${energyScore}/7 and stress ${stressScore}/7, then generated a daily adjustment insight.`,
    });
  }

  if ((/\b(add|create|make)\b/i.test(text) && /\btask\b/i.test(text)) || isImplicitStudyTask(text)) {
    const title = parseTaskTitle(text) || inferStudyTitle(text);
    const dueAt = parseDueAt(text);
    const priority = parsePriority(text);
    const ambiguous = !title;
    const inferredStudyTask = isImplicitStudyTask(text);

    actions.push({
      actionType: "CREATE_TASK",
      requiresConfirmation: ambiguous || inferredStudyTask,
      ambiguous,
      inputPayload: {
        title,
        dueAt: dueAt?.toISOString(),
        priority: priority ?? (inferredStudyTask ? 1 : undefined),
        cognitiveLoad: inferredStudyTask ? 6 : undefined,
        estimatedMinutes: inferredStudyTask ? 180 : undefined,
        type: "school",
        workType: inferredStudyTask ? "study" : "focus",
        timeframe: "weekly",
        createdBy: "chat",
        rawText: text,
      },
      assistantSummary: ambiguous
        ? "I can add a task, but I need the task title first."
        : inferredStudyTask
          ? `I can create "${title}" as a high-difficulty study task and break it into focused study blocks. Please confirm before I add it.`
          : `I can add the task "${title}".`,
    });
  }

  if (/\b(event|appointment)\b/i.test(text) || isImplicitCalendarEvent(text)) {
    const title = parseEventTitle(text);
    const window = parseEventWindow(text);
    const ambiguous = !title || !window;

    actions.push({
      actionType: "CREATE_EVENT",
      requiresConfirmation: ambiguous || isImplicitCalendarEvent(text),
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
        : `I inferred "${title}" as a one-hour event. Please confirm before I add it.`,
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
    const hasFieldKeywords = /\b(?:difficulty|cognitive(?:\s*load)?|priority|\d+\s*(?:min|h(?:ou?r)?s?))\b/i.test(text);
    if (hasFieldKeywords) {
      const title = parseTaskTitle(text);
      actions.push({
        actionType: "UPDATE_TASK",
        requiresConfirmation: true,
        ambiguous: !title,
        inputPayload: { operation: "update_fields", title, rawText: text },
        assistantSummary: title
          ? `I'll update the fields for "${title}". Please confirm.`
          : "Which task should I update?",
      });
    } else {
      actions.push({
        actionType: "UPDATE_TASK",
        requiresConfirmation: true,
        ambiguous: true,
        inputPayload: { operation: "move", rawText: text },
        assistantSummary: "Which task or block should I move, and what new time should it use?",
      });
    }
  }

  // "set difficulty 7 on CS homework" / "update priority 2 for CS homework" / "change CS homework difficulty to 3"
  if (
    /\b(?:set|update|change)\b.*\b(?:difficulty|cognitive(?:\s*load)?|priority|estimated|minutes)\b/i.test(text) ||
    /\b(?:difficulty|cognitive(?:\s*load)?|priority)\s*[:=]?\s*\d+\b/i.test(text)
  ) {
    const title = parseTaskTitle(text);
    actions.push({
      actionType: "UPDATE_TASK",
      requiresConfirmation: true,
      ambiguous: !title,
      inputPayload: { operation: "update_fields", title, rawText: text },
      assistantSummary: title
        ? `I'll update the fields for "${title}". Please confirm.`
        : "Which task should I update the fields for?",
    });
  }

  if (/\b(adjust my day|lighten|make today easier|i('m| am) (stressed|overwhelmed)|too much today|adjust today|reschedule today)\b/i.test(text)) {
    actions.push({
      actionType: "ADJUST_TODAY",
      requiresConfirmation: false,
      ambiguous: false,
      inputPayload: { rawText: text },
      assistantSummary: "Let me analyze today's schedule and suggest adjustments based on your check-in.",
    });
  }

  if (/\b(schedule|plan my day|generate schedule)\b/i.test(text)) {
    actions.push({
      actionType: "GENERATE_SCHEDULE",
      requiresConfirmation: true,
      ambiguous: false,
      inputPayload: {
        rawText: text,
      },
      assistantSummary: "I can generate a schedule proposal from your current tasks, events, preferences, and latest check-in. Please confirm before I create new scheduled blocks.",
    });
  }

  return actions;
}
