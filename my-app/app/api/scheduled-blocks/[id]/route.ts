import { getCurrentUserId } from "@/lib/auth";
import {
  updateScheduledBlock,
  validateScheduledBlockPatchBody,
} from "@/lib/services/scheduledBlocks";

export const runtime = "nodejs";

type ScheduledBlockRouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: ScheduledBlockRouteContext) {
  try {
    const { id } = await context.params;
    const validation = validateScheduledBlockPatchBody(await request.json());

    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: validation.status ?? 400 });
    }

    const result = await updateScheduledBlock(getCurrentUserId(), id, validation.value);
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json({ data: result.value });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to update scheduled block." }, { status: 500 });
  }
}
