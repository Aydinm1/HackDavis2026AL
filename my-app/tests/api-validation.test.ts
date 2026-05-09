import assert from "node:assert/strict";
import test, { before } from "node:test";
import type * as CalendarEventsService from "@/lib/services/calendarEvents";
import type * as CheckinsService from "@/lib/services/checkins";
import type * as ScheduledBlocksService from "@/lib/services/scheduledBlocks";
import type * as TasksService from "@/lib/services/tasks";

process.env.DATABASE_URL ??= "postgresql://user:password@localhost:5432/testdb?schema=public";

let validateCompleteTaskBody: typeof TasksService.validateCompleteTaskBody;
let validateCreateTaskBody: typeof TasksService.validateCreateTaskBody;
let validatePatchTaskBody: typeof TasksService.validatePatchTaskBody;
let validateCalendarRange: typeof CalendarEventsService.validateCalendarRange;
let validateCreateCalendarEventBody: typeof CalendarEventsService.validateCreateCalendarEventBody;
let validatePatchCalendarEventBody: typeof CalendarEventsService.validatePatchCalendarEventBody;
let validateDailyCheckinBody: typeof CheckinsService.validateDailyCheckinBody;
let validateScheduledBlockPatchBody: typeof ScheduledBlocksService.validateScheduledBlockPatchBody;

before(async () => {
  const tasksService = await import("@/lib/services/tasks");
  const calendarEventsService = await import("@/lib/services/calendarEvents");
  const checkinsService = await import("@/lib/services/checkins");
  const scheduledBlocksService = await import("@/lib/services/scheduledBlocks");

  validateCompleteTaskBody = tasksService.validateCompleteTaskBody;
  validateCreateTaskBody = tasksService.validateCreateTaskBody;
  validatePatchTaskBody = tasksService.validatePatchTaskBody;
  validateCalendarRange = calendarEventsService.validateCalendarRange;
  validateCreateCalendarEventBody = calendarEventsService.validateCreateCalendarEventBody;
  validatePatchCalendarEventBody = calendarEventsService.validatePatchCalendarEventBody;
  validateDailyCheckinBody = checkinsService.validateDailyCheckinBody;
  validateScheduledBlockPatchBody = scheduledBlocksService.validateScheduledBlockPatchBody;
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
