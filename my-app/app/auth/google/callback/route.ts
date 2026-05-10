import { getCurrentUserId } from "@/lib/auth";
import googleCalendar from "@/lib/services/googleCalendar";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const redirectUrl = new URL("/calendar", request.url);

  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      redirectUrl.searchParams.set("gcal", "error");
      redirectUrl.searchParams.set("message", error);
      return Response.redirect(redirectUrl);
    }

    if (!code || !state) {
      redirectUrl.searchParams.set("gcal", "error");
      redirectUrl.searchParams.set("message", "missing_oauth_params");
      return Response.redirect(redirectUrl);
    }

    const connection = await googleCalendar.handleGoogleCalendarCallback({ code, state });
    if (!connection.ok) {
      redirectUrl.searchParams.set("gcal", "error");
      redirectUrl.searchParams.set("message", connection.error);
      return Response.redirect(redirectUrl);
    }

    const sync = await googleCalendar.syncGoogleCalendarEvents(getCurrentUserId());
    if (!sync.ok) {
      redirectUrl.searchParams.set("gcal", "connected");
      redirectUrl.searchParams.set("sync", "error");
      redirectUrl.searchParams.set("message", sync.error);
      return Response.redirect(redirectUrl);
    }

    redirectUrl.searchParams.set("gcal", "connected");
    redirectUrl.searchParams.set("imported", String(sync.value.importedCount));
    return Response.redirect(redirectUrl);
  } catch (caught) {
    console.error(caught);
    redirectUrl.searchParams.set("gcal", "error");
    redirectUrl.searchParams.set("message", caught instanceof Error ? caught.message : "google_calendar_callback_failed");
    return Response.redirect(redirectUrl);
  }
}
