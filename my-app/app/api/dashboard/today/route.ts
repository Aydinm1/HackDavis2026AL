import { getCurrentUserId } from "@/lib/auth";
import { getTodayDashboard, parseDashboardDate } from "@/lib/services/dashboard";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const validation = parseDashboardDate(searchParams);

    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: validation.status ?? 400 });
    }

    const dashboard = await getTodayDashboard(getCurrentUserId(), validation.value);
    return Response.json({ data: dashboard });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to fetch today's dashboard." }, { status: 500 });
  }
}
