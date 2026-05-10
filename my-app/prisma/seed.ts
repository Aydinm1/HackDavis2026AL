import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { DEMO_USER_ID } from "../lib/auth";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed demo data.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const planningCycleId = "demo_cycle_2026_05_11";

const demoCheckins = [
  {
    id: "demo_checkin_2026_05_09",
    checkinDate: new Date("2026-05-09T00:00:00-07:00"),
    energyScore: 6,
    stressScore: 2,
    availableCapacityMinutes: 180,
    userNote: "Felt pretty good after finishing weekend errands.",
    logs: [
      {
        id: "demo_checkin_log_2026_05_09_morning",
        loggedAt: new Date("2026-05-09T09:30:00-07:00"),
        energyScore: 6,
        stressScore: 2,
        availableCapacityMinutes: 180,
        userNote: "Good energy and low stress after breakfast.",
      },
      {
        id: "demo_checkin_log_2026_05_09_evening",
        loggedAt: new Date("2026-05-09T19:45:00-07:00"),
        energyScore: 5,
        stressScore: 3,
        availableCapacityMinutes: 90,
        userNote: "Still okay, a little tired after chores.",
      },
    ],
  },
  {
    id: "demo_checkin_2026_05_11",
    checkinDate: new Date("2026-05-11T00:00:00-07:00"),
    energyScore: 3,
    stressScore: 6,
    availableCapacityMinutes: 150,
    userNote: "Afternoon energy dipped after lectures, and the midterm still feels heavy.",
    logs: [
      {
        id: "demo_checkin_log_2026_05_11_morning",
        loggedAt: new Date("2026-05-11T08:15:00-07:00"),
        energyScore: 5,
        stressScore: 4,
        availableCapacityMinutes: 210,
        userNote: "Morning feels manageable before the lecture stack.",
      },
      {
        id: "demo_checkin_log_2026_05_11_afternoon",
        loggedAt: new Date("2026-05-11T15:20:00-07:00"),
        energyScore: 3,
        stressScore: 6,
        availableCapacityMinutes: 150,
        userNote: "Afternoon energy dipped after lectures, and the midterm still feels heavy.",
      },
    ],
  },
  {
    id: "demo_checkin_2026_05_12",
    checkinDate: new Date("2026-05-12T00:00:00-07:00"),
    energyScore: 5,
    stressScore: 4,
    availableCapacityMinutes: 210,
    userNote: "Solid energy for project work before discussion section.",
    logs: [
      {
        id: "demo_checkin_log_2026_05_12_morning",
        loggedAt: new Date("2026-05-12T08:40:00-07:00"),
        energyScore: 5,
        stressScore: 4,
        availableCapacityMinutes: 210,
        userNote: "Solid energy for project work before discussion section.",
      },
    ],
  },
  {
    id: "demo_checkin_2026_05_13",
    checkinDate: new Date("2026-05-13T00:00:00-07:00"),
    energyScore: 2,
    stressScore: 7,
    availableCapacityMinutes: 120,
    userNote: "High stress before the lab report and chemistry review.",
    logs: [
      {
        id: "demo_checkin_log_2026_05_13_afternoon",
        loggedAt: new Date("2026-05-13T14:10:00-07:00"),
        energyScore: 2,
        stressScore: 7,
        availableCapacityMinutes: 120,
        userNote: "High stress before the lab report and chemistry review.",
      },
    ],
  },
  {
    id: "demo_checkin_2026_05_14",
    checkinDate: new Date("2026-05-14T00:00:00-07:00"),
    energyScore: 4,
    stressScore: 5,
    availableCapacityMinutes: 160,
    userNote: "Midterm day feels tense but manageable.",
    logs: [
      {
        id: "demo_checkin_log_2026_05_14_morning",
        loggedAt: new Date("2026-05-14T09:05:00-07:00"),
        energyScore: 4,
        stressScore: 5,
        availableCapacityMinutes: 160,
        userNote: "Midterm day feels tense but manageable.",
      },
    ],
  },
];

const tasks = [
  {
    id: "demo_task_chem_midterm",
    title: "Study for chemistry midterm",
    description: "Review equilibrium, thermodynamics, and practice problems from the last three lectures.",
    type: "school",
    workType: "study",
    dueAt: new Date("2026-05-14T15:30:00-07:00"),
    priority: 1,
    cognitiveLoad: 7,
    estimatedMinutes: 240,
  },
  {
    id: "demo_task_history_essay",
    title: "Draft history essay",
    description: "Write a first full draft about postwar urban policy using the three assigned primary sources.",
    type: "school",
    workType: "writing",
    dueAt: new Date("2026-05-16T23:59:00-07:00"),
    priority: 2,
    cognitiveLoad: 6,
    estimatedMinutes: 180,
  },
  {
    id: "demo_task_cs_project",
    title: "Finish CS project milestone",
    description: "Implement the scheduling view, test task filtering, and prepare the short demo walkthrough.",
    type: "school",
    workType: "project",
    dueAt: new Date("2026-05-15T18:00:00-07:00"),
    priority: 1,
    cognitiveLoad: 6,
    estimatedMinutes: 210,
  },
  {
    id: "demo_task_lab_report",
    title: "Clean up chemistry lab report",
    description: "Add error analysis, label charts, and proofread the conclusion section.",
    type: "school",
    workType: "writing",
    dueAt: new Date("2026-05-13T23:59:00-07:00"),
    priority: 3,
    cognitiveLoad: 4,
    estimatedMinutes: 75,
  },
  {
    id: "demo_task_club_budget",
    title: "Submit student club budget update",
    description: "Reconcile receipts and send the updated spreadsheet to the treasurer.",
    type: "admin",
    workType: "admin",
    dueAt: new Date("2026-05-12T17:00:00-07:00"),
    priority: 4,
    cognitiveLoad: 2,
    estimatedMinutes: 35,
  },
];

const completedTasks = [
  {
    id: "demo_task_yesterday_bio_quiz_review",
    title: "Review biology quiz notes",
    description: "Re-read photosynthesis notes and finish the short Canvas practice quiz.",
    type: "school",
    workType: "study",
    dueAt: new Date("2026-05-09T18:00:00-07:00"),
    priority: 2,
    cognitiveLoad: 4,
    estimatedMinutes: 60,
    actualMinutes: 55,
  },
  {
    id: "demo_task_yesterday_history_sources",
    title: "Annotate history essay sources",
    description: "Mark useful quotes from the postwar housing readings before drafting.",
    type: "school",
    workType: "reading",
    dueAt: new Date("2026-05-09T21:00:00-07:00"),
    priority: 3,
    cognitiveLoad: 4,
    estimatedMinutes: 75,
    actualMinutes: 70,
  },
  {
    id: "demo_task_yesterday_laundry",
    title: "Do laundry before the week starts",
    description: "Wash clothes and set out gym clothes for Monday.",
    type: "personal",
    workType: "admin",
    dueAt: new Date("2026-05-09T20:00:00-07:00"),
    priority: 5,
    cognitiveLoad: 1,
    estimatedMinutes: 45,
    actualMinutes: 40,
  },
];

const calendarEvents = [
  {
    id: "demo_event_chem_lecture",
    externalEventId: "demo-chem-lecture-2026-05-11",
    title: "CHE 118 lecture",
    location: "Sciences Lecture Hall 123",
    startTime: new Date("2026-05-11T09:00:00-07:00"),
    endTime: new Date("2026-05-11T10:20:00-07:00"),
  },
  {
    id: "demo_event_cs_lecture",
    externalEventId: "demo-cs-lecture-2026-05-11",
    title: "ECS 162 lecture",
    location: "Teaching and Learning Complex 1010",
    startTime: new Date("2026-05-11T11:00:00-07:00"),
    endTime: new Date("2026-05-11T12:20:00-07:00"),
  },
  {
    id: "demo_event_history_discussion",
    externalEventId: "demo-history-discussion-2026-05-12",
    title: "History discussion section",
    location: "Voorhies Hall 204",
    startTime: new Date("2026-05-12T14:10:00-07:00"),
    endTime: new Date("2026-05-12T15:00:00-07:00"),
  },
  {
    id: "demo_event_chem_lab",
    externalEventId: "demo-chem-lab-2026-05-13",
    title: "Chemistry lab",
    location: "Chemistry Annex Lab 3",
    startTime: new Date("2026-05-13T13:00:00-07:00"),
    endTime: new Date("2026-05-13T15:50:00-07:00"),
  },
];

const yesterdayCalendarEvents = [
  {
    id: "demo_event_yesterday_bio_discussion",
    externalEventId: "demo-bio-discussion-2026-05-09",
    title: "BIS 2B discussion",
    location: "Sciences Lab Building 102",
    startTime: new Date("2026-05-09T10:00:00-07:00"),
    endTime: new Date("2026-05-09T10:50:00-07:00"),
  },
  {
    id: "demo_event_yesterday_group_meeting",
    externalEventId: "demo-cs-group-meeting-2026-05-09",
    title: "CS project group meeting",
    location: "Shields Library study room",
    startTime: new Date("2026-05-09T13:30:00-07:00"),
    endTime: new Date("2026-05-09T14:30:00-07:00"),
  },
  {
    id: "demo_event_yesterday_dinner",
    externalEventId: "demo-dinner-with-roommates-2026-05-09",
    title: "Dinner with roommates",
    location: "Downtown Davis",
    startTime: new Date("2026-05-09T18:30:00-07:00"),
    endTime: new Date("2026-05-09T19:30:00-07:00"),
  },
];

async function main() {
  await prisma.user.upsert({
    where: { id: DEMO_USER_ID },
    update: {
      email: "demo.student@example.com",
      name: "Maya Chen",
      timezone: "America/Los_Angeles",
    },
    create: {
      id: DEMO_USER_ID,
      email: "demo.student@example.com",
      name: "Maya Chen",
      timezone: "America/Los_Angeles",
    },
  });

  await prisma.userPreferences.upsert({
    where: { userId: DEMO_USER_ID },
    update: {
      workStartTime: "09:00",
      workEndTime: "23:00",
      preferredPlanningDay: "sunday",
      preferredPlanningTime: "19:00",
      preferredBlockLengthMinutes: 45,
      minimumBreakMinutes: 15,
      maxTotalWorkMinutesPerDay: 360,
      maxHardWorkMinutesPerDay: 180,
      avoidsLateNightWork: true,
      reminderSensitivity: "medium",
    },
    create: {
      userId: DEMO_USER_ID,
      workStartTime: "09:00",
      workEndTime: "23:00",
      preferredPlanningDay: "sunday",
      preferredPlanningTime: "19:00",
      preferredBlockLengthMinutes: 45,
      minimumBreakMinutes: 15,
      maxTotalWorkMinutesPerDay: 360,
      maxHardWorkMinutesPerDay: 180,
      avoidsLateNightWork: true,
      reminderSensitivity: "medium",
    },
  });

  await prisma.planningCycle.upsert({
    where: { id: planningCycleId },
    update: {
      cycleStartDate: new Date("2026-05-11T00:00:00-07:00"),
      cycleEndDate: new Date("2026-05-17T23:59:59-07:00"),
      status: "active",
      intakeCompletedAt: new Date("2026-05-10T19:15:00-07:00"),
      userStatedWeekGoal: "Stay ahead for finals week while protecting sleep.",
      userStatedStressors: "Chem midterm, CS project milestone, and a history essay due close together.",
    },
    create: {
      id: planningCycleId,
      userId: DEMO_USER_ID,
      cycleStartDate: new Date("2026-05-11T00:00:00-07:00"),
      cycleEndDate: new Date("2026-05-17T23:59:59-07:00"),
      status: "active",
      intakeCompletedAt: new Date("2026-05-10T19:15:00-07:00"),
      userStatedWeekGoal: "Stay ahead for finals week while protecting sleep.",
      userStatedStressors: "Chem midterm, CS project milestone, and a history essay due close together.",
    },
  });

  for (const task of tasks) {
    await prisma.task.upsert({
      where: { id: task.id },
      update: {
        planningCycleId,
        title: task.title,
        description: task.description,
        type: task.type,
        workType: task.workType,
        timeframe: "weekly",
        status: "todo",
        dueAt: task.dueAt,
        priority: task.priority,
        cognitiveLoad: task.cognitiveLoad,
        estimatedMinutes: task.estimatedMinutes,
        canSplit: true,
        createdBy: "user",
      },
      create: {
        ...task,
        userId: DEMO_USER_ID,
        planningCycleId,
        timeframe: "weekly",
        status: "todo",
        canSplit: true,
        createdBy: "user",
      },
    });
  }

  for (const task of completedTasks) {
    await prisma.task.upsert({
      where: { id: task.id },
      update: {
        planningCycleId,
        title: task.title,
        description: task.description,
        type: task.type,
        workType: task.workType,
        timeframe: "weekly",
        status: "completed",
        dueAt: task.dueAt,
        priority: task.priority,
        cognitiveLoad: task.cognitiveLoad,
        estimatedMinutes: task.estimatedMinutes,
        actualMinutes: task.actualMinutes,
        canSplit: true,
        createdBy: "user",
      },
      create: {
        ...task,
        userId: DEMO_USER_ID,
        planningCycleId,
        timeframe: "weekly",
        status: "completed",
        canSplit: true,
        createdBy: "user",
      },
    });
  }

  for (const event of [...yesterdayCalendarEvents, ...calendarEvents]) {
    await prisma.calendarEvent.upsert({
      where: {
        userId_provider_externalEventId: {
          userId: DEMO_USER_ID,
          provider: "mock",
          externalEventId: event.externalEventId,
        },
      },
      update: {
        title: event.title,
        location: event.location,
        startTime: event.startTime,
        endTime: event.endTime,
        source: "manual",
        status: "confirmed",
        rawProviderData: { demo: true },
      },
      create: {
        ...event,
        userId: DEMO_USER_ID,
        provider: "mock",
        calendarId: "demo-student-calendar",
        source: "manual",
        status: "confirmed",
        rawProviderData: { demo: true },
      },
    });
  }

  await prisma.scheduledBlock.upsert({
    where: { id: "demo_block_yesterday_bio_quiz_review" },
    update: {
      planningCycleId,
      taskId: "demo_task_yesterday_bio_quiz_review",
      title: "Biology quiz review",
      startTime: new Date("2026-05-09T11:15:00-07:00"),
      endTime: new Date("2026-05-09T12:10:00-07:00"),
      status: "completed",
      createdBy: "agent",
      source: "scheduler",
      schedulingReason: "Placed right after discussion while the biology material was fresh.",
      scheduleScore: 0.82,
      energyMatchScore: 0.78,
      deadlineUrgencyScore: 0.7,
      cognitiveBalanceScore: 0.86,
    },
    create: {
      id: "demo_block_yesterday_bio_quiz_review",
      userId: DEMO_USER_ID,
      planningCycleId,
      taskId: "demo_task_yesterday_bio_quiz_review",
      title: "Biology quiz review",
      startTime: new Date("2026-05-09T11:15:00-07:00"),
      endTime: new Date("2026-05-09T12:10:00-07:00"),
      status: "completed",
      createdBy: "agent",
      source: "scheduler",
      schedulingReason: "Placed right after discussion while the biology material was fresh.",
      scheduleScore: 0.82,
      energyMatchScore: 0.78,
      deadlineUrgencyScore: 0.7,
      cognitiveBalanceScore: 0.86,
    },
  });

  await prisma.scheduledBlock.upsert({
    where: { id: "demo_block_yesterday_history_sources" },
    update: {
      planningCycleId,
      taskId: "demo_task_yesterday_history_sources",
      title: "History source annotations",
      startTime: new Date("2026-05-09T15:15:00-07:00"),
      endTime: new Date("2026-05-09T16:25:00-07:00"),
      status: "completed",
      createdBy: "agent",
      source: "scheduler",
      schedulingReason: "Medium-load reading block placed after the group meeting with a short break.",
      scheduleScore: 0.8,
      energyMatchScore: 0.76,
      deadlineUrgencyScore: 0.64,
      cognitiveBalanceScore: 0.84,
    },
    create: {
      id: "demo_block_yesterday_history_sources",
      userId: DEMO_USER_ID,
      planningCycleId,
      taskId: "demo_task_yesterday_history_sources",
      title: "History source annotations",
      startTime: new Date("2026-05-09T15:15:00-07:00"),
      endTime: new Date("2026-05-09T16:25:00-07:00"),
      status: "completed",
      createdBy: "agent",
      source: "scheduler",
      schedulingReason: "Medium-load reading block placed after the group meeting with a short break.",
      scheduleScore: 0.8,
      energyMatchScore: 0.76,
      deadlineUrgencyScore: 0.64,
      cognitiveBalanceScore: 0.84,
    },
  });

  await prisma.scheduledBlock.upsert({
    where: { id: "demo_block_yesterday_laundry" },
    update: {
      planningCycleId,
      taskId: "demo_task_yesterday_laundry",
      title: "Laundry reset",
      startTime: new Date("2026-05-09T17:00:00-07:00"),
      endTime: new Date("2026-05-09T17:40:00-07:00"),
      status: "completed",
      createdBy: "user",
      source: "manual",
      schedulingReason: "Quick personal reset before dinner.",
      scheduleScore: 0.68,
      energyMatchScore: 0.9,
      deadlineUrgencyScore: 0.35,
      cognitiveBalanceScore: 0.92,
    },
    create: {
      id: "demo_block_yesterday_laundry",
      userId: DEMO_USER_ID,
      planningCycleId,
      taskId: "demo_task_yesterday_laundry",
      title: "Laundry reset",
      startTime: new Date("2026-05-09T17:00:00-07:00"),
      endTime: new Date("2026-05-09T17:40:00-07:00"),
      status: "completed",
      createdBy: "user",
      source: "manual",
      schedulingReason: "Quick personal reset before dinner.",
      scheduleScore: 0.68,
      energyMatchScore: 0.9,
      deadlineUrgencyScore: 0.35,
      cognitiveBalanceScore: 0.92,
    },
  });

  await prisma.scheduledBlock.upsert({
    where: { id: "demo_block_chem_review" },
    update: {
      planningCycleId,
      taskId: "demo_task_chem_midterm",
      title: "Chem midterm practice set",
      startTime: new Date("2026-05-11T16:00:00-07:00"),
      endTime: new Date("2026-05-11T17:30:00-07:00"),
      status: "accepted",
      createdBy: "agent",
      source: "scheduler",
      schedulingReason: "High-load study block placed after classes with enough buffer before dinner.",
      scheduleScore: 0.91,
      energyMatchScore: 0.86,
      deadlineUrgencyScore: 0.94,
      cognitiveBalanceScore: 0.82,
    },
    create: {
      id: "demo_block_chem_review",
      userId: DEMO_USER_ID,
      planningCycleId,
      taskId: "demo_task_chem_midterm",
      title: "Chem midterm practice set",
      startTime: new Date("2026-05-11T16:00:00-07:00"),
      endTime: new Date("2026-05-11T17:30:00-07:00"),
      status: "accepted",
      createdBy: "agent",
      source: "scheduler",
      schedulingReason: "High-load study block placed after classes with enough buffer before dinner.",
      scheduleScore: 0.91,
      energyMatchScore: 0.86,
      deadlineUrgencyScore: 0.94,
      cognitiveBalanceScore: 0.82,
    },
  });

  await prisma.scheduledBlock.upsert({
    where: { id: "demo_block_cs_project" },
    update: {
      planningCycleId,
      taskId: "demo_task_cs_project",
      title: "CS project implementation sprint",
      startTime: new Date("2026-05-12T10:00:00-07:00"),
      endTime: new Date("2026-05-12T11:30:00-07:00"),
      status: "accepted",
      createdBy: "agent",
      source: "scheduler",
      schedulingReason: "Focused coding block before afternoon discussion section.",
      scheduleScore: 0.88,
      energyMatchScore: 0.9,
      deadlineUrgencyScore: 0.87,
      cognitiveBalanceScore: 0.8,
    },
    create: {
      id: "demo_block_cs_project",
      userId: DEMO_USER_ID,
      planningCycleId,
      taskId: "demo_task_cs_project",
      title: "CS project implementation sprint",
      startTime: new Date("2026-05-12T10:00:00-07:00"),
      endTime: new Date("2026-05-12T11:30:00-07:00"),
      status: "accepted",
      createdBy: "agent",
      source: "scheduler",
      schedulingReason: "Focused coding block before afternoon discussion section.",
      scheduleScore: 0.88,
      energyMatchScore: 0.9,
      deadlineUrgencyScore: 0.87,
      cognitiveBalanceScore: 0.8,
    },
  });

  const seededCheckinIds = new Map<string, string>();
  const seededCheckinLogIds = new Map<string, string>();

  for (const checkin of demoCheckins) {
    const savedCheckin = await prisma.dailyCheckin.upsert({
      where: {
        userId_checkinDate: {
          userId: DEMO_USER_ID,
          checkinDate: checkin.checkinDate,
        },
      },
      update: {
        planningCycleId,
        energyScore: checkin.energyScore,
        stressScore: checkin.stressScore,
        availableCapacityMinutes: checkin.availableCapacityMinutes,
        userNote: checkin.userNote,
      },
      create: {
        id: checkin.id,
        userId: DEMO_USER_ID,
        planningCycleId,
        checkinDate: checkin.checkinDate,
        energyScore: checkin.energyScore,
        stressScore: checkin.stressScore,
        availableCapacityMinutes: checkin.availableCapacityMinutes,
        userNote: checkin.userNote,
      },
    });
    seededCheckinIds.set(checkin.id, savedCheckin.id);

    for (const log of checkin.logs) {
      const savedLog = await prisma.checkinLog.upsert({
        where: { id: log.id },
        update: {
          planningCycleId,
          loggedAt: log.loggedAt,
          energyScore: log.energyScore,
          stressScore: log.stressScore,
          availableCapacityMinutes: log.availableCapacityMinutes,
          userNote: log.userNote,
          source: "manual",
        },
        create: {
          id: log.id,
          userId: DEMO_USER_ID,
          planningCycleId,
          loggedAt: log.loggedAt,
          energyScore: log.energyScore,
          stressScore: log.stressScore,
          availableCapacityMinutes: log.availableCapacityMinutes,
          userNote: log.userNote,
          source: "manual",
        },
      });
      seededCheckinLogIds.set(log.id, savedLog.id);
    }
  }

  await prisma.aiInsight.upsert({
    where: { id: "demo_insight_recovery_window" },
    update: {
      planningCycleId,
      dailyCheckinId: seededCheckinIds.get("demo_checkin_2026_05_11"),
      checkinLogId: seededCheckinLogIds.get("demo_checkin_log_2026_05_11_afternoon"),
      scope: "daily",
      insightType: "recovery_window",
      title: "Protect a recovery window tonight",
      body: "You have two high-load deadlines this week. Keep 8:30-9:30 PM unscheduled after chemistry review so you can reset before tomorrow's CS block.",
      severity: "caution",
      confidenceScore: 0.84,
      sourceData: {
        energyScore: 3,
        stressScore: 6,
        checkinLogId: seededCheckinLogIds.get("demo_checkin_log_2026_05_11_afternoon"),
        checkinTimeline: [
          { id: "demo_checkin_log_2026_05_11_morning", energyScore: 5, stressScore: 4 },
          { id: "demo_checkin_log_2026_05_11_afternoon", energyScore: 3, stressScore: 6 },
        ],
        demo: true,
      },
    },
    create: {
      id: "demo_insight_recovery_window",
      userId: DEMO_USER_ID,
      planningCycleId,
      dailyCheckinId: seededCheckinIds.get("demo_checkin_2026_05_11"),
      checkinLogId: seededCheckinLogIds.get("demo_checkin_log_2026_05_11_afternoon"),
      scope: "daily",
      insightType: "recovery_window",
      title: "Protect a recovery window tonight",
      body: "You have two high-load deadlines this week. Keep 8:30-9:30 PM unscheduled after chemistry review so you can reset before tomorrow's CS block.",
      severity: "caution",
      confidenceScore: 0.84,
      sourceData: {
        energyScore: 3,
        stressScore: 6,
        checkinLogId: seededCheckinLogIds.get("demo_checkin_log_2026_05_11_afternoon"),
        checkinTimeline: [
          { id: "demo_checkin_log_2026_05_11_morning", energyScore: 5, stressScore: 4 },
          { id: "demo_checkin_log_2026_05_11_afternoon", energyScore: 3, stressScore: 6 },
        ],
        demo: true,
      },
    },
  });

  await prisma.aiInsight.upsert({
    where: { id: "demo_insight_workload_warning" },
    update: {
      planningCycleId,
      scope: "weekly",
      insightType: "workload_warning",
      title: "Front-load the hardest work",
      body: "Chemistry and CS both need deep focus before Thursday. Schedule essay polishing after the midterm instead of stacking all three on the same night.",
      severity: "info",
      confidenceScore: 0.79,
      sourceData: { highPriorityTasks: ["chem midterm", "CS project", "history essay"], demo: true },
    },
    create: {
      id: "demo_insight_workload_warning",
      userId: DEMO_USER_ID,
      planningCycleId,
      scope: "weekly",
      insightType: "workload_warning",
      title: "Front-load the hardest work",
      body: "Chemistry and CS both need deep focus before Thursday. Schedule essay polishing after the midterm instead of stacking all three on the same night.",
      severity: "info",
      confidenceScore: 0.79,
      sourceData: { highPriorityTasks: ["chem midterm", "CS project", "history essay"], demo: true },
    },
  });

  console.log(`Seeded MVP demo data for user ${DEMO_USER_ID}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
