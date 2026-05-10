import { getCurrentUserId } from "@/lib/auth";
import { listThreadMessages } from "@/lib/services/chat";

export const runtime = "nodejs";

type ChatThreadRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: ChatThreadRouteContext) {
  try {
    const { id } = await context.params;
    const result = await listThreadMessages(getCurrentUserId(), id);

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json({ data: result.value });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to fetch chat messages." }, { status: 500 });
  }
}
