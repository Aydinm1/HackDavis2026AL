import googleCalendar from "@/lib/services/googleCalendar";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      return Response.json({ error: `Google OAuth error: ${error}` }, { status: 400 });
    }

    if (!code || !state) {
      return Response.json({ error: "Google OAuth callback requires code and state." }, { status: 400 });
    }

    const result = await googleCalendar.handleGoogleCalendarCallback({ code, state });
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json({
      data: {
        ...result.value,
        message: "Google Calendar connected. Call POST /api/calendar/google/sync to import events.",
      },
    });
  } catch (caught) {
    console.error(caught);
    return Response.json(
      { error: caught instanceof Error ? caught.message : "Failed to finish Google Calendar connection." },
      { status: 500 },
    );
  }
}
