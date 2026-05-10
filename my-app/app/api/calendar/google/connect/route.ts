import { getCurrentUserId } from "@/lib/auth";
import googleCalendar from "@/lib/services/googleCalendar";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const authorizationUrl = googleCalendar.buildGoogleCalendarAuthUrl(getCurrentUserId());

    if (url.searchParams.get("json") === "1") {
      return Response.json({ data: { authorizationUrl } });
    }

    return Response.redirect(authorizationUrl);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to start Google Calendar connection." },
      { status: 500 },
    );
  }
}
