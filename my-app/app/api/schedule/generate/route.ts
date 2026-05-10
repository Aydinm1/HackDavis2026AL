import { getCurrentUserId } from "@/lib/auth";
import { generateSchedule, validateGenerateScheduleBody } from "@/lib/services/scheduledBlocks";

export const runtime = "nodejs";

async function readJsonBody(request: Request) {
  const text = await request.text();
  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);

    if (body === null) {
      return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    const validation = validateGenerateScheduleBody(body);

    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: validation.status ?? 400 });
    }

    const result = await generateSchedule(getCurrentUserId(), validation.value);

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status ?? 400 });
    }

    return Response.json({ data: result.value }, { status: validation.value.dryRun ? 200 : 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to generate schedule." }, { status: 500 });
  }
}
