import { getCurrentUserId } from "@/lib/auth";
import { getSchedule } from "@/lib/services/scheduledBlocks";
import { CalendarClient, type CalendarItemViewModel } from "./calendar-client";

export const dynamic = "force-dynamic";

const demoRange = {
  start: new Date("2026-05-11T00:00:00-07:00"),
  end: new Date("2026-05-18T00:00:00-07:00"),
};

function minutesBetween(startTime: Date, endTime: Date) {
  return Math.round((endTime.getTime() - startTime.getTime()) / 60_000);
}

export default async function Calendar() {
  const schedule = await getSchedule(getCurrentUserId(), demoRange);
  const items: CalendarItemViewModel[] = [
    ...schedule.calendarEvents
      .filter((event) => event.status !== "cancelled")
      .map((event) => ({
        id: event.id,
        kind: "event" as const,
        title: event.title,
        subtitle: event.location || event.description || "Fixed calendar event",
        startTime: event.startTime.toISOString(),
        endTime: event.endTime.toISOString(),
        status: event.status,
        taskTitle: null,
        reason: null,
      })),
    ...schedule.scheduledBlocks
      .filter((block) => block.status !== "cancelled")
      .map((block) => ({
        id: block.id,
        kind: "block" as const,
        title: block.title,
        subtitle: block.task?.title ?? block.taskBreakdown?.title ?? "Scheduled work block",
        startTime: block.startTime.toISOString(),
        endTime: block.endTime.toISOString(),
        status: block.status,
        taskTitle: block.task?.title ?? null,
        reason: block.schedulingReason,
      })),
  ].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const activeEvents = schedule.calendarEvents.filter((event) => event.status !== "cancelled");
  const activeBlocks = schedule.scheduledBlocks.filter((block) => block.status !== "cancelled");
  const totalEventMinutes = activeEvents.reduce(
    (total, event) => total + minutesBetween(event.startTime, event.endTime),
    0,
  );
  const totalBlockMinutes = activeBlocks.reduce(
    (total, block) => total + minutesBetween(block.startTime, block.endTime),
    0,
  );

  return (
    <main className="min-h-screen bg-zinc-50 px-5 py-8 pb-28 font-sans text-zinc-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Seeded demo week</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950">Planner</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Fixed calendar events and scheduled work blocks loaded from Prisma.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
              <div className="text-lg font-semibold">{activeEvents.length}</div>
              <div className="text-xs text-zinc-500">events</div>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
              <div className="text-lg font-semibold">{activeBlocks.length}</div>
              <div className="text-xs text-zinc-500">blocks</div>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
              <div className="text-lg font-semibold">{Math.round((totalEventMinutes + totalBlockMinutes) / 60)}h</div>
              <div className="text-xs text-zinc-500">planned</div>
            </div>
          </div>
        </header>

        <CalendarClient
          initialItems={items}
          scheduleRange={{
            start: demoRange.start.toISOString(),
            end: demoRange.end.toISOString(),
          }}
        />
      </div>
    </main>
  );
}
