import { getCurrentUserId } from "@/lib/auth";
import { confirmAiAction } from "@/lib/services/chat";

export const runtime = "nodejs";

type AiActionRouteContext = {
  params: Promise<{ id: string }>;
};

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request, context: AiActionRouteContext) {
  try {
    const { id } = await context.params;
    const body = await readJsonBody(request);

    if (body === null || !isRecord(body)) {
      return Response.json({ error: "Request body must be a JSON object." }, { status: 400 });
    }

    if (body.inputPayload !== undefined && !isRecord(body.inputPayload)) {
      return Response.json({ error: "inputPayload must be a JSON object." }, { status: 400 });
    }

    const result = await confirmAiAction(getCurrentUserId(), id, {
      inputPayload: body.inputPayload,
    });

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json({ data: result.value });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to confirm AI action." }, { status: 500 });
  }
}
