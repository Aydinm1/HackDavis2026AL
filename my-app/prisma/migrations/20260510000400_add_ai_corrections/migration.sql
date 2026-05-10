-- CreateTable
CREATE TABLE "AiCorrection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "aiActionId" TEXT,
    "threadId" TEXT,
    "messageId" TEXT,
    "correctionType" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'chat',
    "actionType" TEXT NOT NULL,
    "originalUserText" TEXT,
    "proposedPayload" JSONB NOT NULL,
    "correctedPayload" JSONB,
    "finalPayload" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiCorrection_userId_createdAt_idx" ON "AiCorrection"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiCorrection_userId_correctionType_idx" ON "AiCorrection"("userId", "correctionType");

-- CreateIndex
CREATE INDEX "AiCorrection_userId_actionType_idx" ON "AiCorrection"("userId", "actionType");

-- CreateIndex
CREATE INDEX "AiCorrection_aiActionId_idx" ON "AiCorrection"("aiActionId");

-- AddForeignKey
ALTER TABLE "AiCorrection" ADD CONSTRAINT "AiCorrection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCorrection" ADD CONSTRAINT "AiCorrection_aiActionId_fkey" FOREIGN KEY ("aiActionId") REFERENCES "AiAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCorrection" ADD CONSTRAINT "AiCorrection_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ChatThread"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCorrection" ADD CONSTRAINT "AiCorrection_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
