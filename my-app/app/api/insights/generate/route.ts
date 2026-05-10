import { getCurrentUserId } from "@/lib/auth";
import { generateInsight, validateGenerateInsightBody } from "@/lib/services/insights";

export const runtime = "nodejs";

async function readJsonBody(request: Request) {
  const text = await request.text();
  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    const validation = validateGenerateInsightBody(body);

    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: validation.status ?? 400 });
    }

    const result = await generateInsight(getCurrentUserId(), validation.value);

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status ?? 400 });
    }

    return Response.json({ data: result.value }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to generate insight." }, { status: 500 });
  }
}
