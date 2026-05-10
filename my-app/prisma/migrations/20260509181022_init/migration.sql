-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Los_Angeles',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workStartTime" TEXT NOT NULL DEFAULT '09:00',
    "workEndTime" TEXT NOT NULL DEFAULT '23:00',
    "preferredPlanningDay" TEXT NOT NULL DEFAULT 'sunday',
    "preferredPlanningTime" TEXT NOT NULL DEFAULT '19:00',
    "preferredBlockLengthMinutes" INTEGER NOT NULL DEFAULT 45,
    "minimumBreakMinutes" INTEGER NOT NULL DEFAULT 15,
    "maxTotalWorkMinutesPerDay" INTEGER NOT NULL DEFAULT 360,
    "maxHardWorkMinutesPerDay" INTEGER NOT NULL DEFAULT 180,
    "avoidsLateNightWork" BOOLEAN NOT NULL DEFAULT true,
    "reminderSensitivity" TEXT NOT NULL DEFAULT 'medium',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningCycle" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cycleStartDate" TIMESTAMP(3) NOT NULL,
    "cycleEndDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "intakeCompletedAt" TIMESTAMP(3),
    "userStatedWeekGoal" TEXT,
    "userStatedStressors" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanningCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planningCycleId" TEXT,
    "parentTaskId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'school',
    "workType" TEXT NOT NULL DEFAULT 'focus',
    "timeframe" TEXT NOT NULL DEFAULT 'weekly',
    "status" TEXT NOT NULL DEFAULT 'todo',
    "dueAt" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 3,
    "cognitiveLoad" INTEGER NOT NULL DEFAULT 4,
    "estimatedMinutes" INTEGER,
    "actualMinutes" INTEGER,
    "canSplit" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskBreakdown" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sequenceOrder" INTEGER NOT NULL,
    "estimatedMinutes" INTEGER,
    "cognitiveLoad" INTEGER NOT NULL DEFAULT 4,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "createdBy" TEXT NOT NULL DEFAULT 'ai',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskBreakdown_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT,
    "externalEventId" TEXT,
    "calendarId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "isAllDay" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "rawProviderData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledBlock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planningCycleId" TEXT,
    "taskId" TEXT,
    "taskBreakdownId" TEXT,
    "title" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "createdBy" TEXT NOT NULL DEFAULT 'agent',
    "source" TEXT NOT NULL DEFAULT 'scheduler',
    "schedulingReason" TEXT,
    "scheduleScore" DOUBLE PRECISION,
    "energyMatchScore" DOUBLE PRECISION,
    "deadlineUrgencyScore" DOUBLE PRECISION,
    "cognitiveBalanceScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyCheckin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planningCycleId" TEXT,
    "checkinDate" TIMESTAMP(3) NOT NULL,
    "energyScore" INTEGER NOT NULL,
    "stressScore" INTEGER NOT NULL,
    "availableCapacityMinutes" INTEGER,
    "userNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyCheckin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiInsight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planningCycleId" TEXT,
    "dailyCheckinId" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'daily',
    "insightType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "confidenceScore" DOUBLE PRECISION,
    "sourceData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatThread" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planningCycleId" TEXT,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "threadId" TEXT,
    "messageId" TEXT,
    "actionType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "requiresConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "inputPayload" JSONB NOT NULL,
    "resultPayload" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedAt" TIMESTAMP(3),

    CONSTRAINT "AiAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadedInput" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "fileUrl" TEXT,
    "rawTextExtracted" TEXT,
    "parsedPayload" JSONB,
    "confidenceScore" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadedInput_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreferences_userId_key" ON "UserPreferences"("userId");

-- CreateIndex
CREATE INDEX "PlanningCycle_userId_cycleStartDate_idx" ON "PlanningCycle"("userId", "cycleStartDate");

-- CreateIndex
CREATE INDEX "Task_userId_dueAt_idx" ON "Task"("userId", "dueAt");

-- CreateIndex
CREATE INDEX "Task_userId_status_idx" ON "Task"("userId", "status");

-- CreateIndex
CREATE INDEX "Task_planningCycleId_idx" ON "Task"("planningCycleId");

-- CreateIndex
CREATE INDEX "TaskBreakdown_userId_taskId_idx" ON "TaskBreakdown"("userId", "taskId");

-- CreateIndex
CREATE INDEX "CalendarEvent_userId_startTime_endTime_idx" ON "CalendarEvent"("userId", "startTime", "endTime");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEvent_userId_provider_externalEventId_key" ON "CalendarEvent"("userId", "provider", "externalEventId");

-- CreateIndex
CREATE INDEX "ScheduledBlock_userId_startTime_endTime_idx" ON "ScheduledBlock"("userId", "startTime", "endTime");

-- CreateIndex
CREATE INDEX "ScheduledBlock_userId_status_idx" ON "ScheduledBlock"("userId", "status");

-- CreateIndex
CREATE INDEX "ScheduledBlock_planningCycleId_idx" ON "ScheduledBlock"("planningCycleId");

-- CreateIndex
CREATE INDEX "ScheduledBlock_taskId_idx" ON "ScheduledBlock"("taskId");

-- CreateIndex
CREATE INDEX "DailyCheckin_planningCycleId_idx" ON "DailyCheckin"("planningCycleId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyCheckin_userId_checkinDate_key" ON "DailyCheckin"("userId", "checkinDate");

-- CreateIndex
CREATE INDEX "AiInsight_userId_scope_idx" ON "AiInsight"("userId", "scope");

-- CreateIndex
CREATE INDEX "AiInsight_planningCycleId_idx" ON "AiInsight"("planningCycleId");

-- CreateIndex
CREATE INDEX "ChatThread_userId_updatedAt_idx" ON "ChatThread"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "ChatMessage_threadId_createdAt_idx" ON "ChatMessage"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "AiAction_userId_status_idx" ON "AiAction"("userId", "status");

-- CreateIndex
CREATE INDEX "AiAction_threadId_idx" ON "AiAction"("threadId");

-- CreateIndex
CREATE INDEX "UploadedInput_userId_createdAt_idx" ON "UploadedInput"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserPreferences" ADD CONSTRAINT "UserPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningCycle" ADD CONSTRAINT "PlanningCycle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_planningCycleId_fkey" FOREIGN KEY ("planningCycleId") REFERENCES "PlanningCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskBreakdown" ADD CONSTRAINT "TaskBreakdown_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskBreakdown" ADD CONSTRAINT "TaskBreakdown_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledBlock" ADD CONSTRAINT "ScheduledBlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledBlock" ADD CONSTRAINT "ScheduledBlock_planningCycleId_fkey" FOREIGN KEY ("planningCycleId") REFERENCES "PlanningCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledBlock" ADD CONSTRAINT "ScheduledBlock_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledBlock" ADD CONSTRAINT "ScheduledBlock_taskBreakdownId_fkey" FOREIGN KEY ("taskBreakdownId") REFERENCES "TaskBreakdown"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCheckin" ADD CONSTRAINT "DailyCheckin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCheckin" ADD CONSTRAINT "DailyCheckin_planningCycleId_fkey" FOREIGN KEY ("planningCycleId") REFERENCES "PlanningCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiInsight" ADD CONSTRAINT "AiInsight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiInsight" ADD CONSTRAINT "AiInsight_planningCycleId_fkey" FOREIGN KEY ("planningCycleId") REFERENCES "PlanningCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiInsight" ADD CONSTRAINT "AiInsight_dailyCheckinId_fkey" FOREIGN KEY ("dailyCheckinId") REFERENCES "DailyCheckin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatThread" ADD CONSTRAINT "ChatThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatThread" ADD CONSTRAINT "ChatThread_planningCycleId_fkey" FOREIGN KEY ("planningCycleId") REFERENCES "PlanningCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ChatThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAction" ADD CONSTRAINT "AiAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAction" ADD CONSTRAINT "AiAction_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ChatThread"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAction" ADD CONSTRAINT "AiAction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedInput" ADD CONSTRAINT "UploadedInput_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
