import { getCurrentUserId } from "@/lib/auth";
import { cancelTask, updateTask, validatePatchTaskBody } from "@/lib/services/tasks";

export const runtime = "nodejs";

type TaskRouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: TaskRouteContext) {
  try {
    const { id } = await context.params;
    const validation = validatePatchTaskBody(await request.json());

    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: validation.status ?? 400 });
    }

    const result = await updateTask(getCurrentUserId(), id, validation.value);
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json({ data: result.value });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to update task." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: TaskRouteContext) {
  try {
    const { id } = await context.params;
    const result = await cancelTask(getCurrentUserId(), id);

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json({ data: result.value });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to delete task." }, { status: 500 });
  }
}
