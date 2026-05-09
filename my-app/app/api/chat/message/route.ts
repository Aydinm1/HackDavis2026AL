import { getCurrentUserId } from "@/lib/auth";
import { handleChatMessage, validateChatMessageBody } from "@/lib/services/chat";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const validation = validateChatMessageBody(await request.json());

    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: validation.status ?? 400 });
    }

    const result = await handleChatMessage(getCurrentUserId(), validation.value);
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json({ data: result.value }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to process chat message." }, { status: 500 });
  }
}
