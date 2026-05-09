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

  for (const event of calendarEvents) {
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

  await prisma.dailyCheckin.upsert({
    where: {
      userId_checkinDate: {
        userId: DEMO_USER_ID,
        checkinDate: new Date("2026-05-11T00:00:00-07:00"),
      },
    },
    update: {
      planningCycleId,
      energyScore: 4,
      stressScore: 6,
      availableCapacityMinutes: 210,
      userNote: "Slept okay, but the midterm and project both feel heavy today.",
    },
    create: {
      id: "demo_checkin_2026_05_11",
      userId: DEMO_USER_ID,
      planningCycleId,
      checkinDate: new Date("2026-05-11T00:00:00-07:00"),
      energyScore: 4,
      stressScore: 6,
      availableCapacityMinutes: 210,
      userNote: "Slept okay, but the midterm and project both feel heavy today.",
    },
  });

  await prisma.aiInsight.upsert({
    where: { id: "demo_insight_recovery_window" },
    update: {
      planningCycleId,
      dailyCheckinId: "demo_checkin_2026_05_11",
      scope: "daily",
      insightType: "recovery_window",
      title: "Protect a recovery window tonight",
      body: "You have two high-load deadlines this week. Keep 8:30-9:30 PM unscheduled after chemistry review so you can reset before tomorrow's CS block.",
      severity: "caution",
      confidenceScore: 0.84,
      sourceData: { energyScore: 4, stressScore: 6, demo: true },
    },
    create: {
      id: "demo_insight_recovery_window",
      userId: DEMO_USER_ID,
      planningCycleId,
      dailyCheckinId: "demo_checkin_2026_05_11",
      scope: "daily",
      insightType: "recovery_window",
      title: "Protect a recovery window tonight",
      body: "You have two high-load deadlines this week. Keep 8:30-9:30 PM unscheduled after chemistry review so you can reset before tomorrow's CS block.",
      severity: "caution",
      confidenceScore: 0.84,
      sourceData: { energyScore: 4, stressScore: 6, demo: true },
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
