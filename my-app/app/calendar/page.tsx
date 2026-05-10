import { getCurrentUserId } from "@/lib/auth";
import { getSchedule } from "@/lib/services/scheduledBlocks";

export const dynamic = "force-dynamic";

const demoRange = {
  start: new Date("2026-05-11T00:00:00-07:00"),
  end: new Date("2026-05-18T00:00:00-07:00"),
};

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatDay(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(date);
}

function minutesBetween(startTime: Date, endTime: Date) {
  return Math.round((endTime.getTime() - startTime.getTime()) / 60_000);
}

function eventKindClass(kind: "event" | "block", status?: string) {
  if (kind === "event") return "border-blue-200 bg-blue-50";
  if (status === "accepted") return "border-emerald-200 bg-emerald-50";
  if (status === "completed") return "border-zinc-200 bg-zinc-100";
  if (status === "skipped") return "border-amber-200 bg-amber-50";
  return "border-violet-200 bg-violet-50";
}

export default async function Calendar() {
  const schedule = await getSchedule(getCurrentUserId(), demoRange);
  const items = [
    ...schedule.calendarEvents
      .filter((event) => event.status !== "cancelled")
      .map((event) => ({
        id: event.id,
        kind: "event" as const,
        title: event.title,
        subtitle: event.location || event.description || "Fixed calendar event",
        startTime: event.startTime,
        endTime: event.endTime,
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
        startTime: block.startTime,
        endTime: block.endTime,
        status: block.status,
        taskTitle: block.task?.title ?? null,
        reason: block.schedulingReason,
      })),
  ].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  const groupedItems = items.reduce<Record<string, typeof items>>((groups, item) => {
    const key = item.startTime.toISOString().slice(0, 10);
    groups[key] ??= [];
    groups[key].push(item);
    return groups;
  }, {});

  const totalEventMinutes = schedule.calendarEvents.reduce(
    (total, event) => total + minutesBetween(event.startTime, event.endTime),
    0,
  );
  const totalBlockMinutes = schedule.scheduledBlocks.reduce(
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
              <div className="text-lg font-semibold">{schedule.calendarEvents.length}</div>
              <div className="text-xs text-zinc-500">events</div>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
              <div className="text-lg font-semibold">{schedule.scheduledBlocks.length}</div>
              <div className="text-xs text-zinc-500">blocks</div>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
              <div className="text-lg font-semibold">{Math.round((totalEventMinutes + totalBlockMinutes) / 60)}h</div>
              <div className="text-xs text-zinc-500">planned</div>
            </div>
          </div>
        </header>

        <section className="grid gap-5">
          {Object.entries(groupedItems).map(([date, dayItems]) => (
            <section key={date} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                {formatDay(dayItems[0].startTime)}
              </h2>
              <div className="mt-3 grid gap-3">
                {dayItems.map((item) => (
                  <article
                    key={`${item.kind}-${item.id}`}
                    className={`rounded-lg border p-3 ${eventKindClass(item.kind, item.status)}`}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-zinc-950">{item.title}</h3>
                          <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-medium text-zinc-600">
                            {item.kind === "event" ? "busy" : item.status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-zinc-600">{item.subtitle}</p>
                      </div>
                      <div className="shrink-0 text-left text-sm font-medium text-zinc-800 sm:text-right">
                        {formatTime(item.startTime)} - {formatTime(item.endTime)}
                        <div className="text-xs font-normal text-zinc-500">
                          {minutesBetween(item.startTime, item.endTime)} min
                        </div>
                      </div>
                    </div>
                    {item.reason && (
                      <p className="mt-3 rounded-md bg-white/60 px-3 py-2 text-xs text-zinc-600">
                        {item.reason}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </section>
      </div>
    </main>
  );
}
