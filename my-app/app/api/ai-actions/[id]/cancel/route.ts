import { getCurrentUserId } from "@/lib/auth";
import { cancelAiAction } from "@/lib/services/chat";

export const runtime = "nodejs";

type AiActionRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: AiActionRouteContext) {
  try {
    const { id } = await context.params;
    const result = await cancelAiAction(getCurrentUserId(), id);

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json({ data: result.value });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to cancel AI action." }, { status: 500 });
  }
}
