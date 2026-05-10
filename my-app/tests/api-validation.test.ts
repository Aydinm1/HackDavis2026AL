import assert from "node:assert/strict";
import test, { before } from "node:test";
import type * as CalendarEventsService from "@/lib/services/calendarEvents";
import type * as CheckinsService from "@/lib/services/checkins";
import type * as ChatService from "@/lib/services/chat";
import type * as DashboardService from "@/lib/services/dashboard";
import type * as MockParser from "@/lib/ai/mockParser";
import type * as GeminiParser from "@/lib/ai/geminiParser";
import type * as InsightsService from "@/lib/services/insights";
import type * as ScheduledBlocksService from "@/lib/services/scheduledBlocks";
import type * as TasksService from "@/lib/services/tasks";
import type * as UploadsService from "@/lib/services/uploads";

process.env.DATABASE_URL ??= "postgresql://user:password@localhost:5432/testdb?schema=public";

let validateCompleteTaskBody: typeof TasksService.validateCompleteTaskBody;
let validateCreateTaskBody: typeof TasksService.validateCreateTaskBody;
let validatePatchTaskBody: typeof TasksService.validatePatchTaskBody;
let validateCalendarRange: typeof CalendarEventsService.validateCalendarRange;
let validateCreateCalendarEventBody: typeof CalendarEventsService.validateCreateCalendarEventBody;
let validatePatchCalendarEventBody: typeof CalendarEventsService.validatePatchCalendarEventBody;
let validateDailyCheckinBody: typeof CheckinsService.validateDailyCheckinBody;
let validateChatMessageBody: typeof ChatService.validateChatMessageBody;
let resolveNextWeekdayDate: typeof ChatService.resolveNextWeekdayDate;
let parseDashboardDate: typeof DashboardService.parseDashboardDate;
let parseMockChatMessage: typeof MockParser.parseMockChatMessage;
let validateGeminiResponse: typeof GeminiParser.validateGeminiResponse;
let validateCurrentInsightsQuery: typeof InsightsService.validateCurrentInsightsQuery;
let validateGenerateInsightBody: typeof InsightsService.validateGenerateInsightBody;
let validateScheduledBlockPatchBody: typeof ScheduledBlocksService.validateScheduledBlockPatchBody;
let validateGenerateScheduleBody: typeof ScheduledBlocksService.validateGenerateScheduleBody;
let findFirstAvailableSlot: typeof ScheduledBlocksService.findFirstAvailableSlot;
let validateVoiceUploadBody: typeof UploadsService.validateVoiceUploadBody;
let validateImageUploadBody: typeof UploadsService.validateImageUploadBody;

before(async () => {
  const tasksService = await import("@/lib/services/tasks");
  const calendarEventsService = await import("@/lib/services/calendarEvents");
  const checkinsService = await import("@/lib/services/checkins");
  const chatService = await import("@/lib/services/chat");
  const dashboardService = await import("@/lib/services/dashboard");
  const mockParser = await import("@/lib/ai/mockParser");
  const geminiParser = await import("@/lib/ai/geminiParser");
  const insightsService = await import("@/lib/services/insights");
  const scheduledBlocksService = await import("@/lib/services/scheduledBlocks");
  const uploadsService = await import("@/lib/services/uploads");

  validateCompleteTaskBody = tasksService.validateCompleteTaskBody;
  validateCreateTaskBody = tasksService.validateCreateTaskBody;
  validatePatchTaskBody = tasksService.validatePatchTaskBody;
  validateCalendarRange = calendarEventsService.validateCalendarRange;
  validateCreateCalendarEventBody = calendarEventsService.validateCreateCalendarEventBody;
  validatePatchCalendarEventBody = calendarEventsService.validatePatchCalendarEventBody;
  validateDailyCheckinBody = checkinsService.validateDailyCheckinBody;
  validateChatMessageBody = chatService.validateChatMessageBody;
  resolveNextWeekdayDate = chatService.resolveNextWeekdayDate;
  parseDashboardDate = dashboardService.parseDashboardDate;
  parseMockChatMessage = mockParser.parseMockChatMessage;
  validateGeminiResponse = geminiParser.validateGeminiResponse;
  validateCurrentInsightsQuery = insightsService.validateCurrentInsightsQuery;
  validateGenerateInsightBody = insightsService.validateGenerateInsightBody;
  validateScheduledBlockPatchBody = scheduledBlocksService.validateScheduledBlockPatchBody;
  validateGenerateScheduleBody = scheduledBlocksService.validateGenerateScheduleBody;
  findFirstAvailableSlot = scheduledBlocksService.findFirstAvailableSlot;
  validateVoiceUploadBody = uploadsService.validateVoiceUploadBody;
  validateImageUploadBody = uploadsService.validateImageUploadBody;
});

test("task create validation accepts the frontend task payload", () => {
  const result = validateCreateTaskBody({
    planningCycleId: "demo_cycle_2026_05_11",
    title: "Study for chemistry midterm",
    description: "Review practice problems",
    type: "school",
    workType: "study",
    timeframe: "weekly",
    dueAt: "2026-05-14T15:30:00-07:00",
    priority: 1,
    cognitiveLoad: 7,
    estimatedMinutes: 90,
    canSplit: true,
    createdBy: "user",
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.title, "Study for chemistry midterm");
    assert.equal(result.value.priority, 1);
    assert.equal(result.value.cognitiveLoad, 7);
    assert.ok(result.value.dueAt instanceof Date);
  }
});

test("task validation rejects out-of-range priority and cognitive load", () => {
  const badPriority = validateCreateTaskBody({
    title: "Bad priority",
    priority: 6,
    cognitiveLoad: 4,
  });

  const badCognitiveLoad = validateCreateTaskBody({
    title: "Bad cognitive load",
    priority: 3,
    cognitiveLoad: 8,
  });

  assert.equal(badPriority.ok, false);
  assert.match(badPriority.ok ? "" : badPriority.error, /priority.*at most 5/);

  assert.equal(badCognitiveLoad.ok, false);
  assert.match(badCognitiveLoad.ok ? "" : badCognitiveLoad.error, /cognitiveLoad.*at most 7/);
});

test("task patch and complete validation allow status changes and actual minutes", () => {
  const patch = validatePatchTaskBody({
    status: "in_progress",
    actualMinutes: 45,
  });

  const complete = validateCompleteTaskBody({
    actualMinutes: 50,
  });

  assert.equal(patch.ok, true);
  assert.equal(complete.ok, true);
});

test("calendar range validation requires start before end", () => {
  const params = new URLSearchParams({
    start: "2026-05-15T12:00:00-07:00",
    end: "2026-05-15T11:00:00-07:00",
  });

  const result = validateCalendarRange(params);

  assert.equal(result.ok, false);
  assert.match(result.ok ? "" : result.error, /endTime must be after startTime/);
});

test("calendar event validation accepts manual busy blocks", () => {
  const result = validateCreateCalendarEventBody({
    title: "Chemistry lecture",
    description: "CHE 118",
    location: "Sciences Lecture Hall",
    startTime: "2026-05-11T09:00:00-07:00",
    endTime: "2026-05-11T10:20:00-07:00",
    isAllDay: false,
    source: "manual",
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.title, "Chemistry lecture");
    assert.ok(result.value.startTime instanceof Date);
    assert.ok(result.value.endTime instanceof Date);
  }
});

test("calendar patch validation rejects unknown fields", () => {
  const result = validatePatchCalendarEventBody({
    title: "Office hours",
    provider: "google",
  });

  assert.equal(result.ok, false);
  assert.match(result.ok ? "" : result.error, /Unsupported field/);
});

test("scheduled block patch validation accepts mutable fields only", () => {
  const goodPatch = validateScheduledBlockPatchBody({
    title: "CS project sprint",
    startTime: "2026-05-12T10:00:00-07:00",
    endTime: "2026-05-12T11:30:00-07:00",
    status: "accepted",
  });

  const badPatch = validateScheduledBlockPatchBody({
    taskId: "should-not-be-editable",
  });

  assert.equal(goodPatch.ok, true);
  assert.equal(badPatch.ok, false);
  assert.match(badPatch.ok ? "" : badPatch.error, /Unsupported field/);
});

test("schedule generation validation accepts optional range and dry run", () => {
  const result = validateGenerateScheduleBody({
    planningCycleId: "demo_cycle_2026_05_11",
    start: "2026-05-11T00:00:00-07:00",
    end: "2026-05-18T00:00:00-07:00",
    dryRun: true,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.planningCycleId, "demo_cycle_2026_05_11");
    assert.equal(result.value.dryRun, true);
    assert.ok(result.value.start instanceof Date);
    assert.ok(result.value.end instanceof Date);
  }
});

test("schedule generation validation rejects partial or inverted ranges", () => {
  const partial = validateGenerateScheduleBody({
    start: "2026-05-11T00:00:00-07:00",
  });
  const inverted = validateGenerateScheduleBody({
    start: "2026-05-18T00:00:00-07:00",
    end: "2026-05-11T00:00:00-07:00",
  });

  assert.equal(partial.ok, false);
  assert.match(partial.ok ? "" : partial.error, /start and end must be provided together/);

  assert.equal(inverted.ok, false);
  assert.match(inverted.ok ? "" : inverted.error, /endTime must be after startTime/);
});

test("schedule slot finder avoids busy windows and honors work hours", () => {
  const slot = findFirstAvailableSlot({
    range: {
      start: new Date("2026-05-11T09:00:00-07:00"),
      end: new Date("2026-05-11T17:00:00-07:00"),
    },
    durationMinutes: 45,
    busyWindows: [
      {
        startTime: new Date("2026-05-11T09:00:00-07:00"),
        endTime: new Date("2026-05-11T10:00:00-07:00"),
      },
    ],
    preferences: {
      workStartTime: "09:00",
      workEndTime: "17:00",
      minimumBreakMinutes: 15,
      maxTotalWorkMinutesPerDay: 360,
      maxHardWorkMinutesPerDay: 180,
    },
    dayUsage: new Map(),
    cognitiveLoad: 4,
  });

  assert.ok(slot);
  assert.equal(slot.startTime.toISOString(), new Date("2026-05-11T10:15:00-07:00").toISOString());
  assert.equal(slot.endTime.toISOString(), new Date("2026-05-11T11:00:00-07:00").toISOString());
});

test("current insights query validation accepts scope and bounded limit", () => {
  const valid = validateCurrentInsightsQuery(new URLSearchParams({ scope: "weekly", limit: "10" }));
  const badScope = validateCurrentInsightsQuery(new URLSearchParams({ scope: "monthly" }));
  const badLimit = validateCurrentInsightsQuery(new URLSearchParams({ limit: "50" }));

  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.value.scope, "weekly");
    assert.equal(valid.value.limit, 10);
  }

  assert.equal(badScope.ok, false);
  assert.match(badScope.ok ? "" : badScope.error, /scope must be daily or weekly/);

  assert.equal(badLimit.ok, false);
  assert.match(badLimit.ok ? "" : badLimit.error, /limit must be an integer/);
});

test("generate insight validation accepts planning session and rejects bad ranges", () => {
  const valid = validateGenerateInsightBody({
    scope: "planning_session",
    planningCycleId: "demo_cycle_2026_05_11",
    start: "2026-05-11T00:00:00-07:00",
    end: "2026-05-18T00:00:00-07:00",
    trigger: "weekly_planning",
  });
  const invalid = validateGenerateInsightBody({
    scope: "weekly",
    start: "2026-05-18T00:00:00-07:00",
    end: "2026-05-11T00:00:00-07:00",
  });

  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.value.scope, "planning_session");
    assert.equal(valid.value.trigger, "weekly_planning");
  }

  assert.equal(invalid.ok, false);
  assert.match(invalid.ok ? "" : invalid.error, /end must be after start/);
});

test("daily check-in validation accepts required fields and adjustToday", () => {
  const result = validateDailyCheckinBody({
    planningCycleId: "demo_cycle_2026_05_11",
    checkinDate: "2026-05-11",
    energyScore: 2,
    stressScore: 6,
    availableCapacityMinutes: 120,
    userNote: "Feeling overloaded.",
    adjustToday: true,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.energyScore, 2);
    assert.equal(result.value.stressScore, 6);
    assert.ok(result.value.checkinDate instanceof Date);
  }
});

test("daily check-in validation rejects mood and sleep fields", () => {
  const result = validateDailyCheckinBody({
    checkinDate: "2026-05-11",
    energyScore: 4,
    stressScore: 3,
    mood: "fine",
    sleepHours: 7,
  });

  assert.equal(result.ok, false);
  assert.match(result.ok ? "" : result.error, /Unsupported field/);
});

test("dashboard date validation accepts only valid YYYY-MM-DD dates", () => {
  const valid = parseDashboardDate(new URLSearchParams({ date: "2026-05-11" }));
  const invalidFormat = parseDashboardDate(new URLSearchParams({ date: "05-11-2026" }));
  const invalidDate = parseDashboardDate(new URLSearchParams({ date: "2026-02-30" }));

  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.value.date, "2026-05-11");
    assert.equal(valid.value.start.getFullYear(), 2026);
    assert.equal(valid.value.start.getMonth(), 4);
    assert.equal(valid.value.start.getDate(), 11);
    assert.equal(valid.value.start.getHours(), 0);
  }

  assert.equal(invalidFormat.ok, false);
  assert.match(invalidFormat.ok ? "" : invalidFormat.error, /YYYY-MM-DD/);

  assert.equal(invalidDate.ok, false);
  assert.match(invalidDate.ok ? "" : invalidDate.error, /valid calendar date/);
});

test("chat message validation requires content", () => {
  const valid = validateChatMessageBody({
    content: "add chemistry review task due 2026-05-14 high priority",
  });
  const invalid = validateChatMessageBody({
    threadId: "thread-id",
  });

  assert.equal(valid.ok, true);
  assert.equal(invalid.ok, false);
  assert.match(invalid.ok ? "" : invalid.error, /content is required/);
});

test("chat task priority questions resolve the next mentioned weekday", () => {
  const result = resolveNextWeekdayDate(
    "what to do i have to do monday whats my highest priority task",
    new Date("2026-05-10T10:00:00-07:00"),
  );

  assert.equal(result?.weekday, "monday");
  assert.equal(result?.date.toISOString().slice(0, 10), "2026-05-11");
});

test("mock parser does not turn read-only task questions into schedule actions", () => {
  const actions = parseMockChatMessage("what to do i have to do monday whats my highest priority task");

  assert.deepEqual(actions, []);
});

test("mock parser creates task and event actions from simple text", () => {
  const taskActions = parseMockChatMessage("add chemistry review task due 2026-05-14 high priority");
  const eventActions = parseMockChatMessage("dentist appointment 2026-05-12 at 2pm");

  assert.equal(taskActions[0]?.actionType, "CREATE_TASK");
  assert.equal(taskActions[0]?.requiresConfirmation, false);
  assert.equal(taskActions[0]?.inputPayload.priority, 1);

  assert.equal(eventActions[0]?.actionType, "CREATE_EVENT");
  assert.equal(eventActions[0]?.requiresConfirmation, true);
  assert.equal(typeof eventActions[0]?.inputPayload.startTime, "string");
});

test("mock parser treats implicit midterm study request as a proposed task", () => {
  const actions = parseMockChatMessage("i have a midterm on tuesday for bio at 1pm i need to study for this");
  const eventAction = actions.find((action) => action.actionType === "CREATE_EVENT");

  assert.equal(actions[0]?.actionType, "CREATE_TASK");
  assert.equal(actions[0]?.requiresConfirmation, true);
  assert.equal(actions[0]?.inputPayload.title, "Study for bio midterm");
  assert.equal(actions[0]?.inputPayload.workType, "study");
  assert.equal(actions[0]?.inputPayload.cognitiveLoad, 6);
  assert.equal(actions[0]?.inputPayload.estimatedMinutes, 180);

  assert.equal(eventAction?.inputPayload.title, "bio midterm");
  assert.equal(eventAction?.requiresConfirmation, true);
  assert.equal(typeof eventAction?.inputPayload.startTime, "string");
  assert.equal(typeof eventAction?.inputPayload.endTime, "string");

  const startTime = new Date(eventAction?.inputPayload.startTime as string);
  const endTime = new Date(eventAction?.inputPayload.endTime as string);
  assert.equal(endTime.getTime() - startTime.getTime(), 60 * 60_000);
});

test("mock parser warns high-difficulty study tasks can affect the schedule", () => {
  const actions = parseMockChatMessage("i have a bio midterm on wednesday at 1pm and need to study");
  const taskAction = actions.find((action) => action.actionType === "CREATE_TASK");

  assert.match(taskAction?.assistantSummary ?? "", /confirm before I add it/i);
});

test("mock parser requires confirmation or clarification for updates", () => {
  const completeActions = parseMockChatMessage("complete chemistry review");
  const moveActions = parseMockChatMessage("move my study block");

  assert.equal(completeActions[0]?.actionType, "UPDATE_TASK");
  assert.equal(completeActions[0]?.requiresConfirmation, true);
  assert.equal(completeActions[0]?.ambiguous, false);

  assert.equal(moveActions[0]?.actionType, "UPDATE_TASK");
  assert.equal(moveActions[0]?.requiresConfirmation, true);
  assert.equal(moveActions[0]?.ambiguous, true);
});

test("mock parser proposes schedule generation before creating blocks", () => {
  const actions = parseMockChatMessage("plan my day");

  assert.equal(actions[0]?.actionType, "GENERATE_SCHEDULE");
  assert.equal(actions[0]?.requiresConfirmation, true);
  assert.match(actions[0]?.assistantSummary ?? "", /confirm/i);
});

test("voice upload validation requires audioData and mimeType", () => {
  const valid = validateVoiceUploadBody({ audioData: "base64string==", mimeType: "audio/webm" });
  const missingAudio = validateVoiceUploadBody({ mimeType: "audio/webm" });
  const missingMime = validateVoiceUploadBody({ audioData: "base64string==" });
  const empty = validateVoiceUploadBody({});

  assert.equal(valid.ok, true);
  assert.equal(missingAudio.ok, false);
  assert.equal(missingMime.ok, false);
  assert.equal(empty.ok, false);
});

test("image upload validation requires imageData and mimeType", () => {
  const valid = validateImageUploadBody({ imageData: "base64string==", mimeType: "image/jpeg" });
  const missingImage = validateImageUploadBody({ mimeType: "image/jpeg" });
  const missingMime = validateImageUploadBody({ imageData: "base64string==" });
  const empty = validateImageUploadBody({});

  assert.equal(valid.ok, true);
  assert.equal(missingImage.ok, false);
  assert.equal(missingMime.ok, false);
  assert.equal(empty.ok, false);
});

test("validateGeminiResponse passes through valid CREATE_TASK entry", () => {
  const raw = [
    {
      actionType: "CREATE_TASK",
      requiresConfirmation: false,
      ambiguous: false,
      assistantSummary: "I can add that task.",
      inputPayload: { title: "Study for bio exam", dueAt: "2026-05-14T23:59:00Z", priority: 2, cognitiveLoad: 5 },
    },
  ];

  const result = validateGeminiResponse(raw);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.actionType, "CREATE_TASK");
  assert.equal(result[0]?.requiresConfirmation, false);
  assert.equal(result[0]?.inputPayload.title, "Study for bio exam");
});

test("validateGeminiResponse passes through valid CREATE_EVENT entry", () => {
  const raw = [
    {
      actionType: "CREATE_EVENT",
      requiresConfirmation: false,
      ambiguous: false,
      assistantSummary: "I can add that event.",
      inputPayload: { title: "Dentist", startTime: "2026-05-12T14:00:00Z", endTime: "2026-05-12T15:00:00Z" },
    },
  ];

  const result = validateGeminiResponse(raw);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.actionType, "CREATE_EVENT");
  assert.equal(result[0]?.inputPayload.startTime, "2026-05-12T14:00:00Z");
});

test("validateGeminiResponse passes through GENERATE_SCHEDULE with no required fields", () => {
  const raw = [
    {
      actionType: "GENERATE_SCHEDULE",
      requiresConfirmation: true,
      ambiguous: false,
      assistantSummary: "Generating your schedule.",
      inputPayload: { rawText: "plan my day" },
    },
  ];

  const result = validateGeminiResponse(raw);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.actionType, "GENERATE_SCHEDULE");
  assert.equal(result[0]?.requiresConfirmation, true);
});

test("validateGeminiResponse skips entries missing actionType", () => {
  const raw = [
    {
      requiresConfirmation: false,
      ambiguous: false,
      assistantSummary: "Missing action type.",
      inputPayload: {},
    },
  ];

  const result = validateGeminiResponse(raw);

  assert.equal(result.length, 0);
});

test("validateGeminiResponse skips entries with unknown actionType", () => {
  const raw = [
    {
      actionType: "DO_SOMETHING_WEIRD",
      requiresConfirmation: false,
      ambiguous: false,
      assistantSummary: "Unknown type.",
      inputPayload: {},
    },
  ];

  const result = validateGeminiResponse(raw);

  assert.equal(result.length, 0);
});

test("validateGeminiResponse uses empty object when inputPayload is not an object", () => {
  const raw = [
    {
      actionType: "CREATE_TASK",
      requiresConfirmation: false,
      ambiguous: true,
      assistantSummary: "Bad payload.",
      inputPayload: "not-an-object",
    },
  ];

  const result = validateGeminiResponse(raw);

  assert.equal(result.length, 1);
  assert.deepEqual(result[0]?.inputPayload, {});
});

test("validateGeminiResponse returns empty array for empty input", () => {
  assert.deepEqual(validateGeminiResponse([]), []);
});

test("validateGeminiResponse returns empty array for non-array input", () => {
  assert.deepEqual(validateGeminiResponse(null), []);
  assert.deepEqual(validateGeminiResponse({ actionType: "CREATE_TASK" }), []);
  assert.deepEqual(validateGeminiResponse("a string"), []);
});
