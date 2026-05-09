import { getCurrentUserId } from "@/lib/auth";
import { createImageUpload, validateImageUploadBody } from "@/lib/services/uploads";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const validation = validateImageUploadBody(await request.json());

    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    const result = await createImageUpload(getCurrentUserId(), validation.value);
    return Response.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to process image upload." }, { status: 500 });
  }
}
