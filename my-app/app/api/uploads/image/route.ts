import { getCurrentUserId } from "@/lib/auth";
import { createImageUpload, validateImageUploadBody } from "@/lib/services/uploads";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as unknown;
    console.log("[upload/image] body keys:", Object.keys(body as object));
    if (Array.isArray((body as Record<string, unknown>).images)) {
      console.log("[upload/image] images count:", ((body as Record<string, unknown>).images as unknown[]).length);
    }
    const validation = validateImageUploadBody(body);

    if (!validation.ok) {
      console.log("[upload/image] validation failed:", validation.error);
      return Response.json({ error: validation.error }, { status: 400 });
    }

    const result = await createImageUpload(getCurrentUserId(), validation.value);
    return Response.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to process image upload." }, { status: 500 });
  }
}
