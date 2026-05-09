import { getCurrentUserId } from "@/lib/auth";
import { completeTask, validateCompleteTaskBody } from "@/lib/services/tasks";

export const runtime = "nodejs";

type TaskRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: TaskRouteContext) {
  try {
    const { id } = await context.params;
    const text = await request.text();
    const body = text ? JSON.parse(text) : undefined;
    const validation = validateCompleteTaskBody(body);

    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: validation.status ?? 400 });
    }

    const result = await completeTask(getCurrentUserId(), id, validation.value);
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json({ data: result.value });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to complete task." }, { status: 500 });
  }
}
