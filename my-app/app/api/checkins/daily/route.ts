import { getCurrentUserId } from "@/lib/auth";
import { upsertDailyCheckin, validateDailyCheckinBody } from "@/lib/services/checkins";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const validation = validateDailyCheckinBody(await request.json());

    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: validation.status ?? 400 });
    }

    const result = await upsertDailyCheckin(getCurrentUserId(), validation.value);
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json({ data: result.value }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to save daily check-in." }, { status: 500 });
  }
}
