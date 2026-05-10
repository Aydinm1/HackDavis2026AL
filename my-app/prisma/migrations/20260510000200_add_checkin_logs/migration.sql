-- AlterTable
ALTER TABLE "AiInsight" ADD COLUMN "checkinLogId" TEXT;

-- CreateTable
CREATE TABLE "CheckinLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planningCycleId" TEXT,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "energyScore" INTEGER NOT NULL,
    "stressScore" INTEGER NOT NULL,
    "availableCapacityMinutes" INTEGER,
    "userNote" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckinLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CheckinLog_userId_loggedAt_idx" ON "CheckinLog"("userId", "loggedAt");

-- CreateIndex
CREATE INDEX "CheckinLog_planningCycleId_idx" ON "CheckinLog"("planningCycleId");

-- CreateIndex
CREATE INDEX "AiInsight_checkinLogId_idx" ON "AiInsight"("checkinLogId");

-- AddForeignKey
ALTER TABLE "CheckinLog" ADD CONSTRAINT "CheckinLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckinLog" ADD CONSTRAINT "CheckinLog_planningCycleId_fkey" FOREIGN KEY ("planningCycleId") REFERENCES "PlanningCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiInsight" ADD CONSTRAINT "AiInsight_checkinLogId_fkey" FOREIGN KEY ("checkinLogId") REFERENCES "CheckinLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
