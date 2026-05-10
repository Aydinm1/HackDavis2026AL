import { getCurrentUserId } from "@/lib/auth";
import { listAiCorrections, validateAiCorrectionQuery } from "@/lib/services/aiCorrections";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const validation = validateAiCorrectionQuery(new URL(request.url).searchParams);

    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: validation.status ?? 400 });
    }

    const result = await listAiCorrections(getCurrentUserId(), validation.value);

    return Response.json({ data: result });
  } catch (error) {
    console.error("Failed to list AI corrections", error);
    return Response.json({ error: "Failed to list AI corrections." }, { status: 500 });
  }
}
