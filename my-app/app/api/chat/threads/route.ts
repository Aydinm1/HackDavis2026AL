import { getCurrentUserId } from "@/lib/auth";
import { listChatThreads } from "@/lib/services/chat";

export const runtime = "nodejs";

export async function GET() {
  try {
    const threads = await listChatThreads(getCurrentUserId());
    return Response.json({ data: threads });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to fetch chat threads." }, { status: 500 });
  }
}
