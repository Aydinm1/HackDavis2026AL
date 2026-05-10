import { getCurrentUserId } from "@/lib/auth";
import { listCurrentInsights, validateCurrentInsightsQuery } from "@/lib/services/insights";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const validation = validateCurrentInsightsQuery(searchParams);

    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: validation.status ?? 400 });
    }

    const insights = await listCurrentInsights(getCurrentUserId(), validation.value);
    return Response.json({ data: insights });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to fetch insights." }, { status: 500 });
  }
}
