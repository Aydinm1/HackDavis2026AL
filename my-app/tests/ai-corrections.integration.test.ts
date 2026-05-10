import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { after, before } from "node:test";
import type { Prisma, PrismaClient } from "@prisma/client";
import type * as AiCorrectionsService from "@/lib/services/aiCorrections";
import type * as ChatService from "@/lib/services/chat";

function loadDotEnv() {
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("localhost:5432/testdb")) {
    return;
  }

  try {
    const env = readFileSync(".env", "utf8");
    for (const line of env.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // The explicit check below turns this into a useful failure message.
  }
}

loadDotEnv();

let prisma: PrismaClient;
let confirmAiAction: typeof ChatService.confirmAiAction;
let cancelAiAction: typeof ChatService.cancelAiAction;
let listAiCorrections: typeof AiCorrectionsService.listAiCorrections;
let listAiCorrectionPromptExamples: typeof AiCorrectionsService.listAiCorrectionPromptExamples;
let buildAiCorrectionPromptExample: typeof AiCorrectionsService.buildAiCorrectionPromptExample;

const createdUserIds: string[] = [];
const createdDemoCorrectionIds: string[] = [];

async function createTestUser(label: string) {
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("localhost:5432/testdb")) {
    throw new Error("DB-backed AI correction tests require DATABASE_URL or a local .env with DATABASE_URL.");
  }

  const id = `test_ai_correction_${label}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  createdUserIds.push(id);

  await prisma.user.create({
    data: {
      id,
      email: `${id}@example.com`,
      name: "AI Correction Test User",
      timezone: "America/Los_Angeles",
    },
  });

  return id;
}

async function createThreadAction(params: {
  userId: string;
  content: string;
  actionType: string;
  inputPayload: Record<string, unknown>;
  requiresConfirmation?: boolean;
}) {
  const thread = await prisma.chatThread.create({
    data: {
      userId: params.userId,
      title: "AI correction integration test",
    },
  });
  const message = await prisma.chatMessage.create({
    data: {
      userId: params.userId,
      threadId: thread.id,
      role: "user",
      content: params.content,
    },
  });
  const action = await prisma.aiAction.create({
    data: {
      userId: params.userId,
      threadId: thread.id,
      messageId: message.id,
      actionType: params.actionType,
      status: "proposed",
      requiresConfirmation: params.requiresConfirmation ?? true,
      inputPayload: params.inputPayload as Prisma.InputJsonObject,
    },
  });

  return { thread, message, action };
}

before(async () => {
  const dbModule = await import("@/lib/db");
  const chatService = await import("@/lib/services/chat");
  const aiCorrectionsService = await import("@/lib/services/aiCorrections");

  prisma = dbModule.prisma;
  confirmAiAction = chatService.confirmAiAction;
  cancelAiAction = chatService.cancelAiAction;
  listAiCorrections = aiCorrectionsService.listAiCorrections;
  listAiCorrectionPromptExamples = aiCorrectionsService.listAiCorrectionPromptExamples;
  buildAiCorrectionPromptExample = aiCorrectionsService.buildAiCorrectionPromptExample;
});

after(async () => {
  for (const id of createdDemoCorrectionIds) {
    await prisma.aiCorrection.deleteMany({ where: { id } });
  }

  for (const id of createdUserIds) {
    await prisma.user.deleteMany({ where: { id } });
  }

  await prisma.$disconnect();
});

test("confirmed AI task action records an AI correction audit row", async () => {
  const userId = await createTestUser("confirmed");
  const { action } = await createThreadAction({
    userId,
    content: "add laundry task difficulty 2",
    actionType: "CREATE_TASK",
    inputPayload: {
      title: "Fold laundry",
      priority: 4,
      cognitiveLoad: 2,
      type: "personal",
      workType: "admin",
      timeframe: "daily",
      ambiguous: false,
    },
  });

  const result = await confirmAiAction(userId, action.id);

  assert.equal(result.ok, true);

  const correction = await prisma.aiCorrection.findFirstOrThrow({
    where: { aiActionId: action.id },
  });

  assert.equal(correction.userId, userId);
  assert.equal(correction.correctionType, "confirmed");
  assert.equal(correction.actionType, "CREATE_TASK");
  assert.equal(correction.originalUserText, "add laundry task difficulty 2");
  assert.deepEqual(correction.correctedPayload, null);
  assert.equal((correction.finalPayload as Record<string, unknown>).title, "Fold laundry");
});

test("edited confirmation records proposed and corrected payloads", async () => {
  const userId = await createTestUser("edited");
  const { action } = await createThreadAction({
    userId,
    content: "add cs homework due at 2pm",
    actionType: "CREATE_TASK",
    inputPayload: {
      title: "CS homework",
      priority: 1,
      cognitiveLoad: 5,
      type: "school",
      workType: "study",
      timeframe: "daily",
      ambiguous: false,
    },
  });

  const result = await confirmAiAction(userId, action.id, {
    inputPayload: {
      priority: 3,
      cognitiveLoad: 7,
    },
  });

  assert.equal(result.ok, true);

  const correction = await prisma.aiCorrection.findFirstOrThrow({
    where: { aiActionId: action.id },
  });

  assert.equal(correction.correctionType, "edited");
  assert.equal((correction.proposedPayload as Record<string, unknown>).priority, 1);
  assert.equal((correction.correctedPayload as Record<string, unknown>).priority, 3);
  assert.equal((correction.finalPayload as Record<string, unknown>).cognitiveLoad, 7);

  const examples = await listAiCorrectionPromptExamples(userId);
  assert.equal(examples.length, 1);
  assert.equal(examples[0]?.userText, "add cs homework due at 2pm");
  assert.equal(examples[0]?.actionType, "CREATE_TASK");
  assert.deepEqual((examples[0]?.expectedPayload as Record<string, unknown>).priority, 3);
});

test("cancelled proposed action records a cancellation correction", async () => {
  const userId = await createTestUser("cancelled");
  const { action } = await createThreadAction({
    userId,
    content: "never mind don't plan this",
    actionType: "GENERATE_SCHEDULE",
    inputPayload: {
      rawText: "plan my week",
      dryRun: true,
      ambiguous: false,
    },
  });

  const result = await cancelAiAction(userId, action.id);

  assert.equal(result.ok, true);

  const correction = await prisma.aiCorrection.findFirstOrThrow({
    where: { aiActionId: action.id },
  });

  assert.equal(correction.correctionType, "cancelled");
  assert.equal(correction.actionType, "GENERATE_SCHEDULE");
  assert.equal(correction.originalUserText, "never mind don't plan this");
});

test("failed action execution records failure details for future parser examples", async () => {
  const userId = await createTestUser("failed");
  const { action } = await createThreadAction({
    userId,
    content: "i have a meeting at 2",
    actionType: "CREATE_EVENT",
    inputPayload: {
      title: "Meeting",
      startTime: "2026-05-12T14:00:00-07:00",
      ambiguous: false,
    },
  });

  const result = await confirmAiAction(userId, action.id);

  assert.equal(result.ok, false);
  assert.match(result.ok ? "" : result.error, /endTime/);

  const correction = await prisma.aiCorrection.findFirstOrThrow({
    where: { aiActionId: action.id },
  });

  assert.equal(correction.correctionType, "failed");
  assert.equal(correction.actionType, "CREATE_EVENT");
  assert.match(correction.errorMessage ?? "", /endTime/);

  const examples = await listAiCorrectionPromptExamples(userId);
  assert.equal(examples.length, 1);
  assert.equal(examples[0]?.correctionType, "failed");
  assert.match(examples[0]?.previousError ?? "", /endTime/);
});

test("AI correction list and eval cases are user scoped", async () => {
  const userId = await createTestUser("list");
  const otherUserId = await createTestUser("other");

  await prisma.aiCorrection.create({
    data: {
      userId,
      correctionType: "edited",
      source: "chat",
      actionType: "CREATE_TASK",
      originalUserText: "make it priority 3",
      proposedPayload: { title: "Essay", priority: 1 },
      correctedPayload: { title: "Essay", priority: 3 },
      finalPayload: { title: "Essay", priority: 3 },
    },
  });
  await prisma.aiCorrection.create({
    data: {
      userId: otherUserId,
      correctionType: "edited",
      source: "chat",
      actionType: "CREATE_TASK",
      originalUserText: "other user correction",
      proposedPayload: { title: "Other", priority: 1 },
      correctedPayload: { title: "Other", priority: 5 },
      finalPayload: { title: "Other", priority: 5 },
    },
  });

  const result = await listAiCorrections(userId, {
    correctionType: "edited",
    actionType: "CREATE_TASK",
    limit: 10,
  });

  assert.equal(result.corrections.length, 1);
  assert.equal(result.corrections[0]?.originalUserText, "make it priority 3");
  assert.equal(result.evalCases.length, 1);
  assert.deepEqual(result.evalCases[0]?.expectedPayload, { title: "Essay", priority: 3 });
});

test("GET /api/ai-corrections returns mock-user scoped corrections and eval cases", async () => {
  const { DEMO_USER_ID } = await import("@/lib/auth");
  const { GET } = await import("@/app/api/ai-corrections/route");
  const otherUserId = await createTestUser("route_other");

  await prisma.user.upsert({
    where: { id: DEMO_USER_ID },
    update: {},
    create: {
      id: DEMO_USER_ID,
      email: "demo-correction-route@example.com",
      name: "Demo Correction Route User",
      timezone: "America/Los_Angeles",
    },
  });

  const demoCorrection = await prisma.aiCorrection.create({
    data: {
      userId: DEMO_USER_ID,
      correctionType: "edited",
      source: "chat",
      actionType: "CREATE_TASK",
      originalUserText: "change this to priority 3",
      proposedPayload: { title: "Route Task", priority: 1 },
      correctedPayload: { title: "Route Task", priority: 3 },
      finalPayload: { title: "Route Task", priority: 3 },
    },
  });
  createdDemoCorrectionIds.push(demoCorrection.id);

  await prisma.aiCorrection.create({
    data: {
      userId: otherUserId,
      correctionType: "edited",
      source: "chat",
      actionType: "CREATE_TASK",
      originalUserText: "should not leak",
      proposedPayload: { title: "Other Route Task", priority: 1 },
      correctedPayload: { title: "Other Route Task", priority: 5 },
      finalPayload: { title: "Other Route Task", priority: 5 },
    },
  });

  const response = await GET(
    new Request("http://localhost/api/ai-corrections?correctionType=edited&actionType=CREATE_TASK&limit=20"),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(body.data.corrections));
  assert.ok(Array.isArray(body.data.evalCases));
  assert.ok(
    body.data.corrections.some((correction: { id: string; originalUserText: string }) => correction.id === demoCorrection.id),
  );
  assert.ok(
    body.data.evalCases.some((evalCase: { input: string }) => evalCase.input === "change this to priority 3"),
  );
  assert.equal(
    body.data.corrections.some((correction: { originalUserText: string }) => correction.originalUserText === "should not leak"),
    false,
  );
});

test("prompt example formatter produces stable demo-ready objects", async () => {
  const example = buildAiCorrectionPromptExample({
    actionType: "CREATE_EVENT",
    correctionType: "failed",
    originalUserText: "lunch at 2",
    proposedPayload: { title: "Lunch", startTime: "2026-05-11T14:00:00-07:00" },
    correctedPayload: null,
    finalPayload: null,
    errorMessage: "Event title, startTime, and endTime are required.",
  });

  assert.deepEqual(example, {
    userText: "lunch at 2",
    actionType: "CREATE_EVENT",
    expectedPayload: { title: "Lunch", startTime: "2026-05-11T14:00:00-07:00" },
    correctionType: "failed",
    previousError: "Event title, startTime, and endTime are required.",
  });
});
