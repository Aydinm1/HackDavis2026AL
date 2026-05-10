import { getCurrentUserId } from "@/lib/auth";
import { completeScheduledBlock } from "@/lib/services/scheduledBlocks";

export const runtime = "nodejs";

type ScheduledBlockRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: ScheduledBlockRouteContext) {
  try {
    const { id } = await context.params;
    const result = await completeScheduledBlock(getCurrentUserId(), id);

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json({ data: result.value });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to complete scheduled block." }, { status: 500 });
  }
}
