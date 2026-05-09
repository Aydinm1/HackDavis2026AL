import { getCurrentUserId } from "@/lib/auth";
import { createTask, listTasks, validateCreateTaskBody } from "@/lib/services/tasks";

export const runtime = "nodejs";

export async function GET() {
  try {
    const tasks = await listTasks(getCurrentUserId());
    return Response.json({ data: tasks });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to fetch tasks." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const validation = validateCreateTaskBody(await request.json());
    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: validation.status ?? 400 });
    }

    const result = await createTask(getCurrentUserId(), validation.value);
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json({ data: result.value }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to create task." }, { status: 500 });
  }
}
