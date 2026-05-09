import { getCurrentUserId } from "@/lib/auth";
import { generateTaskBreakdown } from "@/lib/services/tasks";

export const runtime = "nodejs";

type TaskRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: TaskRouteContext) {
  try {
    const { id } = await context.params;
    const result = await generateTaskBreakdown(getCurrentUserId(), id);

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json({ data: result.value }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to generate task breakdown." }, { status: 500 });
  }
}
