import { getCurrentUserId } from "@/lib/auth";
import { generateTaskBreakdown, validateTaskBreakdownBody } from "@/lib/services/tasks";

export const runtime = "nodejs";

type TaskRouteContext = {
  params: Promise<{ id: string }>;
};

async function readJsonBody(request: Request) {
  const text = await request.text();
  if (!text.trim()) {
    return undefined;
  }

  return JSON.parse(text) as unknown;
}

export async function POST(request: Request, context: TaskRouteContext) {
  try {
    const { id } = await context.params;
    const body = await readJsonBody(request);
    const validation = validateTaskBreakdownBody(body);

    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: validation.status ?? 400 });
    }

    const result = await generateTaskBreakdown(getCurrentUserId(), id, validation.value);

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json({ data: result.value }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to generate task breakdown." }, { status: 500 });
  }
}
