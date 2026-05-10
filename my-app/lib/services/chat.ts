import { Prisma } from "@prisma/client";
import { parseGeminiChatMessage } from "@/lib/ai/geminiParser";
import {
  inferDailyEnergyScore,
  inferDailyStressScore,
  parseDailyAvailableCapacityMinutes,
  type MockParsedAction,
} from "@/lib/ai/mockParser";
import { prisma } from "@/lib/db";
import { upsertDailyCheckin } from "@/lib/services/checkins";
import { generateSchedule } from "@/lib/services/scheduledBlocks";
import { generateTaskBreakdown } from "@/lib/services/tasks";

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; status?: number };

type ChatMessageInput = {
  threadId?: string;
  planningCycleId?: string | null;
  content: string;
};

const weekdayIndex: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
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

function clampInteger(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDateKey(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function inferTaskWorkType(text: string) {
  if (/\b(study|midterm|exam|test|quiz|final)\b/i.test(text)) return "study";
  if (/\b(essay|paper|write|writing|draft)\b/i.test(text)) return "writing";
  if (/\b(project|build|implement|code|cs)\b/i.test(text)) return "project";
  if (/\b(read|reading|chapter)\b/i.test(text)) return "reading";
  if (/\b(form|email|admin|submit)\b/i.test(text)) return "admin";
  return "focus";
}

function inferCognitiveLoad(text: string, workType: string) {
  if (/\b(easy|quick|simple|light)\b/i.test(text)) return 2;
  if (/\b(deep work|hard|difficult|intense)\b/i.test(text)) return 6;
  if (/\b(midterm|exam|final|project|essay|paper)\b/i.test(text)) return 6;

  const defaults: Record<string, number> = {
    study: 5,
    writing: 5,
    project: 6,
    admin: 2,
    reading: 4,
    creative: 5,
    personal: 3,
    focus: 4,
  };

  return defaults[workType] ?? 4;
}

function parseEstimatedMinutes(text: string) {
  const hourMatch = text.match(/\b(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i);
  if (hourMatch) {
    return clampInteger(Number(hourMatch[1]) * 60, 15, 720);
  }

  const minuteMatch = text.match(/\b(\d+)\s*(?:minutes?|mins?|m)\b/i);
  if (minuteMatch) {
    return clampInteger(Number(minuteMatch[1]), 15, 720);
  }

  if (/\b(final|project)\b/i.test(text)) return 240;
  if (/\b(midterm|exam|essay|paper)\b/i.test(text)) return 180;
  if (/\bquiz|test\b/i.test(text)) return 90;
  if (/\breading|chapter\b/i.test(text)) return 60;
  if (/\bquick|simple|easy\b/i.test(text)) return 30;

  return undefined;
}

function parsePriorityFromText(text: string) {
  if (/\b(high priority|urgent|asap|important|midterm|final)\b/i.test(text)) return 1;
  if (/\b(medium priority)\b/i.test(text)) return 3;
  if (/\b(low priority|not urgent)\b/i.test(text)) return 5;
  return undefined;
}

function inferStudyTitle(text: string) {
  const assessment = text.match(/\b(midterm|exam|test|quiz|final)\b/i)?.[1]?.toLowerCase() ?? "assessment";
  const subjectMatch = text.match(/\b(?:for|in)\s+([a-z][a-z\s&-]*?)(?:\s+(?:at|on|by|due|i need|need)\b|$)/i);
  const subject = subjectMatch?.[1]?.replace(/\bthis\b/gi, "").replace(/\s+/g, " ").trim();

  return subject ? `Study for ${subject} ${assessment}` : `Study for ${assessment}`;
}

function isImplicitStudyTask(text: string) {
  return /\b(study|review|prepare|prep)\b/i.test(text) && /\b(midterm|exam|test|quiz|final)\b/i.test(text);
}

function isImplicitCalendarEvent(text: string) {
  return /\b(midterm|exam|test|quiz|final|event|appointment)\b/i.test(text) && /\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/i.test(text);
}

function inferEventTitle(text: string) {
  const assessmentForSubjectMatch = text.match(/\b(midterm|exam|test|quiz|final)\b.*?\b(?:for|in)\s+([a-z][a-z\s&-]*?)(?:\s+(?:at|on|by|due|i need|need|that|this)\b|$)/i);
  if (assessmentForSubjectMatch) {
    return `${assessmentForSubjectMatch[2]} ${assessmentForSubjectMatch[1]}`.replace(/\s+/g, " ").trim();
  }

  const assessmentMatch = text.match(/\b(?:for|in)?\s*([a-z][a-z\s&-]*?)\s+(midterm|exam|test|quiz|final)\b/i);
  if (assessmentMatch) {
    return `${assessmentMatch[1]} ${assessmentMatch[2]}`.replace(/\s+/g, " ").trim();
  }

  const appointmentMatch = text.match(/\b(?:add\s+)?(.+?)\s+(?:event|appointment)\b/i);
  return appointmentMatch?.[1]?.replace(/\s+/g, " ").trim() ?? "";
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

function inferEventWindow(text: string) {
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

function normalizeComparableText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|a|an|my|for|at|on)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleLooksSimilar(a: string, b: string) {
  const left = normalizeComparableText(a);
  const right = normalizeComparableText(b);

  if (!left || !right) return false;
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) return true;

  const leftWords = new Set(left.split(" "));
  const rightWords = new Set(right.split(" "));
  const overlap = [...leftWords].filter((word) => rightWords.has(word)).length;

  return overlap >= 2 && overlap / Math.min(leftWords.size, rightWords.size) >= 0.67;
}

function startOfDay(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function minutesBetweenDates(a: Date, b: Date) {
  return Math.abs(a.getTime() - b.getTime()) / 60_000;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(date.getDate() + days);
  return result;
}

function startOfLocalDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfLocalDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0);
}

function formatReadableDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function resolveNextWeekdayDate(text: string, baseDate = new Date()) {
  const weekdayMatch = text.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
  if (!weekdayMatch) {
    return null;
  }

  const weekday = weekdayMatch[1].toLowerCase();
  const targetDay = weekdayIndex[weekday];
  const start = startOfLocalDate(baseDate);
  const daysUntil = (targetDay - start.getDay() + 7) % 7;

  return {
    weekday,
    date: addDays(start, daysUntil),
  };
}

function hasWeekdayMention(text: string) {
  return /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i.test(text);
}

function isTaskPriorityQuery(text: string) {
  const asksQuestion = /\b(what|which|show|tell|list|find)\b/i.test(text);
  const asksAboutWork = /\b(task|tasks|to do|todo|have to do|need to do|work on|do)\b/i.test(text);
  const asksPriority = /\b(priority|highest|top|important|most important|what matters)\b/i.test(text);

  return asksQuestion && asksAboutWork && asksPriority && hasWeekdayMention(text);
}

async function answerTaskPriorityQuery(userId: string, content: string) {
  if (!isTaskPriorityQuery(content)) {
    return null;
  }

  const resolved = resolveNextWeekdayDate(content);
  if (!resolved) {
    return "Which day should I check? You can say something like \"Monday\" or \"Friday\".";
  }

  const start = startOfLocalDate(resolved.date);
  const end = endOfLocalDate(resolved.date);

  const [dueTasks, scheduledBlocks] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId,
        status: { notIn: ["completed", "cancelled"] },
        dueAt: { gte: start, lt: end },
      },
      orderBy: [{ priority: "asc" }, { cognitiveLoad: "desc" }, { dueAt: "asc" }, { createdAt: "asc" }],
    }),
    prisma.scheduledBlock.findMany({
      where: {
        userId,
        status: { notIn: ["completed", "cancelled", "skipped"] },
        startTime: { gte: start, lt: end },
        task: {
          status: { notIn: ["completed", "cancelled"] },
        },
      },
      include: { task: true },
      orderBy: { startTime: "asc" },
    }),
  ]);

  const candidates = new Map<
    string,
    {
      id: string;
      title: string;
      priority: number;
      cognitiveLoad: number;
      dueAt: Date | null;
      estimatedMinutes: number | null;
      scheduledStart: Date | null;
      source: "due" | "scheduled" | "due and scheduled";
    }
  >();

  for (const task of dueTasks) {
    candidates.set(task.id, {
      id: task.id,
      title: task.title,
      priority: task.priority,
      cognitiveLoad: task.cognitiveLoad,
      dueAt: task.dueAt,
      estimatedMinutes: task.estimatedMinutes,
      scheduledStart: null,
      source: "due",
    });
  }

  for (const block of scheduledBlocks) {
    if (!block.task) continue;

    const existing = candidates.get(block.task.id);
    candidates.set(block.task.id, {
      id: block.task.id,
      title: block.task.title,
      priority: block.task.priority,
      cognitiveLoad: block.task.cognitiveLoad,
      dueAt: block.task.dueAt,
      estimatedMinutes: block.task.estimatedMinutes,
      scheduledStart: existing?.scheduledStart ?? block.startTime,
      source: existing ? "due and scheduled" : "scheduled",
    });
  }

  const sortedTasks = [...candidates.values()].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const aDue = a.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
    const bDue = b.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
    if (aDue !== bDue) return aDue - bDue;
    if (a.cognitiveLoad !== b.cognitiveLoad) return b.cognitiveLoad - a.cognitiveLoad;
    return (a.scheduledStart?.getTime() ?? 0) - (b.scheduledStart?.getTime() ?? 0);
  });

  const dateLabel = formatReadableDate(start);
  if (sortedTasks.length === 0) {
    return `Next ${resolved.weekday} is ${dateLabel}. I do not see any incomplete tasks due or scheduled for that day.`;
  }

  const topTask = sortedTasks[0];
  const supportingDetails = [
    `priority ${topTask.priority}/5`,
    `difficulty ${topTask.cognitiveLoad}/7`,
    topTask.estimatedMinutes ? `${topTask.estimatedMinutes} min estimate` : null,
    topTask.source === "due" ? "due that day" : topTask.source === "scheduled" ? "scheduled that day" : "due and scheduled that day",
  ].filter(Boolean);

  const otherTasks = sortedTasks
    .slice(1, 4)
    .map((task) => `${task.title} (priority ${task.priority}/5)`);
  const otherText = otherTasks.length > 0 ? ` Other Monday tasks: ${otherTasks.join(", ")}.` : "";

  return `Next ${resolved.weekday} is ${dateLabel}. Your highest priority task is "${topTask.title}" because it is ${supportingDetails.join(", ")}.${otherText}`;
}

function buildBreakdownPreview(workType: string, estimatedMinutes: number, cognitiveLoad: number) {
  const templates: Record<string, string[]> = {
    study: ["Review notes and key concepts", "Work practice problems", "Self-test and summarize weak spots"],
    writing: ["Outline argument and evidence", "Write first draft", "Revise and proofread"],
    project: ["Scope remaining work", "Implement focused changes", "Test and polish"],
    admin: ["Gather needed info", "Complete the task", "Submit and confirm"],
    reading: ["Skim headings and goals", "Read actively with notes", "Summarize takeaways"],
    focus: ["Clarify next step", "Complete focused work block", "Review and wrap up"],
  };
  const titles = templates[workType] ?? templates.focus;
  const stepMinutes = Math.max(20, Math.ceil(estimatedMinutes / titles.length));

  return titles.map((title, index) => ({
    title,
    sequenceOrder: index + 1,
    estimatedMinutes: stepMinutes,
    cognitiveLoad: Math.max(1, Math.min(7, cognitiveLoad - (index === titles.length - 1 ? 1 : 0))),
  }));
}

function normalizeCreateTaskAction(action: MockParsedAction, originalText: string): MockParsedAction {
  if (action.actionType !== "CREATE_TASK") {
    return action;
  }

  const payload = action.inputPayload;
  const workType = typeof payload.workType === "string" && payload.workType !== "focus"
    ? payload.workType
    : inferTaskWorkType(originalText);
  const estimatedMinutes = typeof payload.estimatedMinutes === "number"
    ? clampInteger(payload.estimatedMinutes, 15, 720)
    : parseEstimatedMinutes(originalText);
  const cognitiveLoad = typeof payload.cognitiveLoad === "number"
    ? clampInteger(payload.cognitiveLoad, 1, 7)
    : inferCognitiveLoad(originalText, workType);
  const priority = typeof payload.priority === "number"
    ? clampInteger(payload.priority, 1, 5)
    : parsePriorityFromText(originalText);
  const inferredTitle = isImplicitStudyTask(originalText) ? inferStudyTitle(originalText) : undefined;
  const title = typeof payload.title === "string" && payload.title.trim()
    ? payload.title.trim()
    : inferredTitle ?? "";

  const missingPlanningInputs = !estimatedMinutes || !cognitiveLoad;
  const requiresReview = action.requiresConfirmation || missingPlanningInputs || isImplicitStudyTask(originalText);
  const breakdownPreview = estimatedMinutes && cognitiveLoad
    ? buildBreakdownPreview(workType, estimatedMinutes, cognitiveLoad)
    : undefined;
  const scheduleImpactText = (priority ?? 3) <= 2 || (cognitiveLoad ?? 4) >= 6
    ? " This is likely to affect your current plan, so after it is saved I can generate a revised schedule proposal."
    : "";

  return {
    ...action,
    requiresConfirmation: requiresReview,
    ambiguous: action.ambiguous || !title || missingPlanningInputs,
    inputPayload: {
      ...payload,
      title,
      priority: priority ?? 3,
      cognitiveLoad,
      estimatedMinutes,
      workType,
      type: typeof payload.type === "string" ? payload.type : "school",
      timeframe: typeof payload.timeframe === "string" ? payload.timeframe : "weekly",
      canSplit: true,
      createdBy: "chat",
      rawText: originalText,
      breakdownPreview,
    },
    assistantSummary: missingPlanningInputs
      ? `I can create "${title || "that task"}", but I need estimated time and difficulty before adding it.`
      : requiresReview
        ? `I estimated "${title}" as ${estimatedMinutes} minutes with difficulty ${cognitiveLoad}/7 and prepared a ${breakdownPreview?.length ?? 0}-step breakdown. Please confirm before I add it.${scheduleImpactText}`
        : `${action.assistantSummary}${scheduleImpactText}`,
  };
}

function normalizeCreateEventAction(action: MockParsedAction, originalText: string): MockParsedAction {
  if (action.actionType !== "CREATE_EVENT") {
    return action;
  }

  const payload = action.inputPayload;
  const inferredWindow = inferEventWindow(originalText);
  const title = typeof payload.title === "string" && payload.title.trim()
    ? payload.title.trim()
    : inferEventTitle(originalText);
  const startTime = typeof payload.startTime === "string"
    ? payload.startTime
    : inferredWindow?.startTime.toISOString();
  const endTime = typeof payload.endTime === "string"
    ? payload.endTime
    : inferredWindow?.endTime.toISOString();
  const usedDefaultDuration = !payload.endTime && Boolean(inferredWindow);
  const inferredImplicitEvent = isImplicitCalendarEvent(originalText);
  const ambiguous = action.ambiguous || !title || !startTime || !endTime;
  const requiresReview = ambiguous || action.requiresConfirmation || usedDefaultDuration || inferredImplicitEvent;

  return {
    ...action,
    requiresConfirmation: requiresReview,
    ambiguous,
    inputPayload: {
      ...payload,
      title,
      startTime,
      endTime,
      isAllDay: typeof payload.isAllDay === "boolean" ? payload.isAllDay : false,
      source: "chat",
      inferredDurationMinutes: usedDefaultDuration ? 60 : undefined,
      rawText: originalText,
    },
    assistantSummary: ambiguous
      ? "I can add that event, but I need the date and time first."
      : requiresReview
        ? `I inferred "${title}" as a one-hour event. Please confirm before I add it.`
        : action.assistantSummary,
  };
}

function normalizeGenerateScheduleAction(action: MockParsedAction, originalText: string): MockParsedAction {
  if (action.actionType !== "GENERATE_SCHEDULE") {
    return action;
  }

  return {
    ...action,
    requiresConfirmation: true,
    ambiguous: false,
    inputPayload: {
      ...action.inputPayload,
      rawText: typeof action.inputPayload.rawText === "string" ? action.inputPayload.rawText : originalText,
      trigger: typeof action.inputPayload.trigger === "string" ? action.inputPayload.trigger : "chat",
    },
    assistantSummary:
      "I can generate a schedule proposal from your current tasks, fixed events, preferences, and latest check-in. Please confirm before I create new scheduled blocks.",
  };
}

function normalizeDailyCheckinAction(action: MockParsedAction, originalText: string): MockParsedAction {
  if (action.actionType !== "DAILY_CHECKIN") {
    return action;
  }

  const payload = action.inputPayload;
  const inferredEnergyScore = inferDailyEnergyScore(originalText);
  const inferredStressScore = inferDailyStressScore(originalText);
  const energyScore =
    typeof payload.energyScore === "number" ? clampInteger(payload.energyScore, 1, 7) : inferredEnergyScore;
  const stressScore =
    typeof payload.stressScore === "number" ? clampInteger(payload.stressScore, 1, 7) : inferredStressScore;
  const availableCapacityMinutes =
    typeof payload.availableCapacityMinutes === "number"
      ? Math.max(0, Math.round(payload.availableCapacityMinutes))
      : parseDailyAvailableCapacityMinutes(originalText);
  const checkinDate =
    typeof payload.checkinDate === "string" && parseLocalDateKey(payload.checkinDate)
      ? payload.checkinDate.slice(0, 10)
      : getLocalDateKey();
  const ambiguous = action.ambiguous || !energyScore || !stressScore;

  return {
    ...action,
    requiresConfirmation: ambiguous,
    ambiguous,
    inputPayload: {
      ...payload,
      checkinDate,
      energyScore,
      stressScore,
      availableCapacityMinutes,
      userNote: typeof payload.userNote === "string" && payload.userNote.trim() ? payload.userNote.trim() : originalText,
      adjustToday: true,
      rawText: originalText,
    },
    assistantSummary: ambiguous
      ? "Before I plan around today, tell me your energy and stress from 1-7, like \"energy 3 stress 6\"."
      : `I saved today's check-in as energy ${energyScore}/7 and stress ${stressScore}/7, and generated a daily adjustment insight.`,
  };
}

function addImplicitStudyActionIfNeeded(actions: MockParsedAction[], originalText: string) {
  if (!isImplicitStudyTask(originalText) || actions.some((action) => action.actionType === "CREATE_TASK")) {
    return actions;
  }

  return [
    ...actions,
    normalizeCreateTaskAction(
      {
        actionType: "CREATE_TASK",
        requiresConfirmation: true,
        ambiguous: false,
        inputPayload: {},
        assistantSummary: "",
      },
      originalText,
    ),
  ];
}

function addImplicitEventActionIfNeeded(actions: MockParsedAction[], originalText: string) {
  if (!isImplicitCalendarEvent(originalText) || actions.some((action) => action.actionType === "CREATE_EVENT")) {
    return actions;
  }

  return [
    ...actions,
    normalizeCreateEventAction(
      {
        actionType: "CREATE_EVENT",
        requiresConfirmation: false,
        ambiguous: false,
        inputPayload: {},
        assistantSummary: "",
      },
      originalText,
    ),
  ];
}

function normalizeParsedActions(actions: MockParsedAction[], originalText: string) {
  return addImplicitEventActionIfNeeded(addImplicitStudyActionIfNeeded(actions, originalText), originalText).map((action) =>
    normalizeDailyCheckinAction(
      normalizeGenerateScheduleAction(
        normalizeCreateEventAction(normalizeCreateTaskAction(action, originalText), originalText),
        originalText,
      ),
      originalText,
    ),
  );
}

function isPlanningRequest(text: string) {
  return /\b(schedule|plan my day|plan today|generate schedule|adjust today|plan my week|replan|reschedule)\b/i.test(text);
}

async function hasDailyCheckinForToday(userId: string) {
  const today = parseLocalDateKey(getLocalDateKey()) ?? startOfLocalDate(new Date());

  const checkin = await prisma.dailyCheckin.findUnique({
    where: {
      userId_checkinDate: {
        userId,
        checkinDate: today,
      },
    },
    select: { id: true },
  });

  return Boolean(checkin);
}

function buildMissingCheckinPromptAction(originalText: string): MockParsedAction {
  return {
    actionType: "DAILY_CHECKIN",
    requiresConfirmation: true,
    ambiguous: true,
    inputPayload: {
      checkinDate: getLocalDateKey(),
      adjustToday: true,
      rawText: originalText,
      missingBeforeSchedule: true,
    },
    assistantSummary:
      "Before I generate or adjust today's plan, tell me your energy and stress from 1-7, like \"energy 3 stress 6\". You can include available minutes too.",
  };
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
      estimatedMinutes: typeof payload.estimatedMinutes === "number" ? payload.estimatedMinutes : undefined,
      type: typeof payload.type === "string" ? payload.type : "school",
      workType: typeof payload.workType === "string" ? payload.workType : "focus",
      timeframe: typeof payload.timeframe === "string" ? payload.timeframe : "weekly",
      canSplit: typeof payload.canSplit === "boolean" ? payload.canSplit : true,
      createdBy: "chat",
    },
  });

  const breakdown = await generateTaskBreakdown(userId, task.id);

  return {
    task,
    taskBreakdowns: breakdown.ok ? breakdown.value.breakdowns : [],
  };
}

function taskNeedsScheduleImpact(task: { priority: number; cognitiveLoad: number; dueAt: Date | null; estimatedMinutes: number | null }) {
  if (task.priority <= 2 || task.cognitiveLoad >= 6) {
    return true;
  }

  if (!task.dueAt) {
    return false;
  }

  return task.dueAt.getTime() - Date.now() <= 3 * 24 * 60 * 60_000;
}

async function createScheduleImpactAction(params: {
  userId: string;
  threadId?: string | null;
  messageId?: string | null;
  task: { id: string; title: string; planningCycleId: string | null; priority: number; cognitiveLoad: number; dueAt: Date | null; estimatedMinutes: number | null };
}) {
  const { userId, threadId, messageId, task } = params;

  if (!taskNeedsScheduleImpact(task)) {
    return null;
  }

  return prisma.aiAction.create({
    data: {
      userId,
      threadId,
      messageId,
      actionType: "GENERATE_SCHEDULE",
      status: "proposed",
      requiresConfirmation: true,
      inputPayload: jsonObject({
        planningCycleId: task.planningCycleId,
        trigger: "task_added",
        taskId: task.id,
        rawText: `Generate a revised schedule proposal after adding "${task.title}".`,
        ambiguous: false,
        scheduleImpact: {
          reason: "This task is high priority, high difficulty, or due soon, so it may need to change the current schedule.",
          taskId: task.id,
          title: task.title,
          priority: task.priority,
          cognitiveLoad: task.cognitiveLoad,
          dueAt: task.dueAt?.toISOString() ?? null,
          estimatedMinutes: task.estimatedMinutes,
        },
      }),
    },
  });
}

async function executeCreateEvent(userId: string, action: MockParsedAction) {
  const payload = action.inputPayload;
  const title = typeof payload.title === "string" ? payload.title : "";
  const startTime = typeof payload.startTime === "string" ? new Date(payload.startTime) : null;
  const endTime = typeof payload.endTime === "string" ? new Date(payload.endTime) : null;

  if (!title || !startTime || !endTime) {
    throw new Error("Event title, startTime, and endTime are required.");
  }

  const dayStart = startOfDay(startTime);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000);
  const possibleDuplicates = await prisma.calendarEvent.findMany({
    where: {
      userId,
      status: { not: "cancelled" },
      startTime: { lt: dayEnd },
      endTime: { gt: dayStart },
    },
    orderBy: { startTime: "asc" },
  });
  const duplicate = possibleDuplicates.find((event) => {
    const sameTitle = titleLooksSimilar(event.title, title);
    const sameStart = minutesBetweenDates(event.startTime, startTime) <= 15;
    const overlapping = event.startTime < endTime && event.endTime > startTime;

    return sameTitle && (sameStart || overlapping);
  });

  if (duplicate) {
    throw new Error(
      `Possible duplicate event found: "${duplicate.title}" from ${duplicate.startTime.toISOString()} to ${duplicate.endTime.toISOString()}. Edit this action if this is a different event, or cancel it.`,
    );
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

async function executeGenerateSchedule(userId: string, action: MockParsedAction) {
  const payload = action.inputPayload;
  const result = await generateSchedule(userId, {
    planningCycleId: typeof payload.planningCycleId === "string" ? payload.planningCycleId : undefined,
    start: typeof payload.start === "string" ? new Date(payload.start) : undefined,
    end: typeof payload.end === "string" ? new Date(payload.end) : undefined,
    dryRun: typeof payload.dryRun === "boolean" ? payload.dryRun : undefined,
  });

  if (!result.ok) {
    throw new Error(result.error);
  }

  return result.value;
}

async function executeDailyCheckin(userId: string, action: MockParsedAction) {
  const payload = action.inputPayload;
  const checkinDate =
    typeof payload.checkinDate === "string" ? parseLocalDateKey(payload.checkinDate) : parseLocalDateKey(getLocalDateKey());
  const energyScore = typeof payload.energyScore === "number" ? clampInteger(payload.energyScore, 1, 7) : null;
  const stressScore = typeof payload.stressScore === "number" ? clampInteger(payload.stressScore, 1, 7) : null;

  if (!checkinDate) {
    throw new Error("checkinDate must be a valid YYYY-MM-DD date.");
  }

  if (!energyScore || !stressScore) {
    throw new Error("energyScore and stressScore are required.");
  }

  const result = await upsertDailyCheckin(userId, {
    planningCycleId: typeof payload.planningCycleId === "string" ? payload.planningCycleId : null,
    checkinDate,
    energyScore,
    stressScore,
    availableCapacityMinutes:
      typeof payload.availableCapacityMinutes === "number" ? Math.max(0, Math.round(payload.availableCapacityMinutes)) : null,
    userNote: typeof payload.userNote === "string" ? payload.userNote : null,
    adjustToday: typeof payload.adjustToday === "boolean" ? payload.adjustToday : true,
  });

  if (!result.ok) {
    throw new Error(result.error);
  }

  return result.value;
}

async function executeAction(userId: string, action: MockParsedAction) {
  if (action.actionType === "CREATE_TASK") return executeCreateTask(userId, action);
  if (action.actionType === "CREATE_EVENT") return executeCreateEvent(userId, action);
  if (action.actionType === "UPDATE_TASK") return executeUpdateTask(userId, action);
  if (action.actionType === "DAILY_CHECKIN") return executeDailyCheckin(userId, action);
  return executeGenerateSchedule(userId, action);
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
    const proposedScheduleAction =
      action.actionType === "CREATE_TASK" && "task" in result
        ? await createScheduleImpactAction({
            userId,
            threadId,
            messageId,
            task: result.task,
          })
        : null;

    return prisma.aiAction.update({
      where: { id: aiAction.id },
      data: {
        status: "executed",
        resultPayload: jsonObject({ ...result, proposedScheduleAction }),
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

  const taskQueryAnswer = await answerTaskPriorityQuery(userId, input.content);
  if (taskQueryAnswer) {
    const assistantMessage = await prisma.chatMessage.create({
      data: {
        userId,
        threadId: thread.id,
        role: "assistant",
        content: taskQueryAnswer,
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
        actions: [],
      },
    };
  }

  const parsedActions = normalizeParsedActions(await parseGeminiChatMessage(input.content), input.content);
  const shouldPromptForCheckin =
    isPlanningRequest(input.content) &&
    !parsedActions.some((action) => action.actionType === "DAILY_CHECKIN") &&
    !(await hasDailyCheckinForToday(userId));
  const actionableParsedActions = shouldPromptForCheckin ? [buildMissingCheckinPromptAction(input.content)] : parsedActions;
  const actions = await Promise.all(
    actionableParsedActions.map((action) =>
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
      content: buildAssistantResponse(actionableParsedActions),
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

export async function confirmAiAction(
  userId: string,
  actionId: string,
  overrides: { inputPayload?: Record<string, unknown> } = {},
) {
  const aiAction = await prisma.aiAction.findFirst({
    where: { id: actionId, userId },
  });

  if (!aiAction) {
    return { ok: false as const, error: "AI action not found.", status: 404 };
  }

  if (aiAction.status !== "proposed") {
    return { ok: false as const, error: `AI action is already ${aiAction.status}.`, status: 400 };
  }

  const inputPayload = {
    ...(aiAction.inputPayload as Record<string, unknown>),
    ...(overrides.inputPayload ?? {}),
  };
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
    const proposedScheduleAction =
      aiAction.actionType === "CREATE_TASK" && "task" in result
        ? await createScheduleImpactAction({
            userId,
            threadId: aiAction.threadId,
            messageId: aiAction.messageId,
            task: result.task,
          })
        : null;

    const updatedAction = await prisma.aiAction.update({
      where: { id: aiAction.id },
      data: {
        status: "executed",
        inputPayload: jsonObject(inputPayload),
        resultPayload: jsonObject({ ...result, proposedScheduleAction }),
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
