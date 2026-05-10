import { getCurrentUserId } from "@/lib/auth";
import { getTodayDashboard, parseDashboardDate } from "@/lib/services/dashboard";
import { DailyCheckinForm, type DailyCheckinFormState } from "@/app/_components/daily-checkin-form";
import { TodayBlocksClient, type TodayBlockViewModel } from "@/app/_components/today-blocks-client";
import { AdjustTodayClient } from "@/app/_components/adjust-today-client";

const defaultDemoDate = "2026-05-11";

export type TodayDashboardProps = {
  searchParams?: Promise<{ date?: string }>;
};

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatDate(date: Date | null) {
  if (!date) return "No due date";

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatHeaderDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function minutesBetween(startTime: Date, endTime: Date) {
  return Math.round((endTime.getTime() - startTime.getTime()) / 60_000);
}

function insightClass(severity: string) {
  if (severity === "urgent") return "border-red-200 bg-red-50";
  if (severity === "caution") return "border-amber-200 bg-amber-50";
  return "border-blue-200 bg-blue-50";
}

function formatLoggedAt(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export async function TodayDashboard({ searchParams }: TodayDashboardProps) {
  const params = await searchParams;
  const date = params?.date ?? defaultDemoDate;
  const validation = parseDashboardDate(new URLSearchParams({ date }));

  if (!validation.ok) {
    return (
      <main className="min-h-screen bg-zinc-50 px-5 py-8 pb-28 font-sans text-zinc-950">
        <div className="mx-auto max-w-5xl rounded-lg border border-red-200 bg-red-50 p-5 text-red-700">
          {validation.error}
        </div>
      </main>
    );
  }

  const dashboard = await getTodayDashboard(getCurrentUserId(), validation.value);
  const totalBlockMinutes = dashboard.todayBlocks.reduce(
    (total, block) => total + minutesBetween(block.startTime, block.endTime),
    0,
  );
  const highLoadBlocks = dashboard.todayBlocks.filter((block) => (block.task?.cognitiveLoad ?? 0) >= 6);
  const todayBlocks: TodayBlockViewModel[] = dashboard.todayBlocks.map((block) => ({
    id: block.id,
    title: block.title,
    subtitle: block.task?.title ?? block.taskBreakdown?.title ?? "Scheduled work",
    startTime: block.startTime.toISOString(),
    endTime: block.endTime.toISOString(),
    status: block.status,
    schedulingReason: block.schedulingReason,
  }));
  const checkinFormState: DailyCheckinFormState | null = dashboard.checkin
    ? {
        planningCycleId: dashboard.checkin.planningCycleId,
        energyScore: dashboard.checkin.energyScore,
        stressScore: dashboard.checkin.stressScore,
        availableCapacityMinutes: dashboard.checkin.availableCapacityMinutes,
        userNote: dashboard.checkin.userNote,
      }
    : null;

  return (
    <main className="min-h-screen bg-zinc-50 px-5 py-8 pb-28 font-sans text-zinc-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Today dashboard</p>
          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-normal text-zinc-950">{formatHeaderDate(dashboard.date)}</h1>
              <p className="mt-1 text-sm text-zinc-500">
                Check-in, next event, scheduled blocks, top tasks, and AI guidance from Prisma.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
                <div className="text-lg font-semibold">{dashboard.todayBlocks.length}</div>
                <div className="text-xs text-zinc-500">blocks</div>
              </div>
              <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
                <div className="text-lg font-semibold">{Math.round(totalBlockMinutes / 60)}h</div>
                <div className="text-xs text-zinc-500">planned</div>
              </div>
              <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
                <div className="text-lg font-semibold">{highLoadBlocks.length}</div>
                <div className="text-xs text-zinc-500">hard</div>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <article className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-950">Daily check-in</h2>
            {dashboard.checkin ? (
              <div className="mt-4 grid gap-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md bg-zinc-50 px-3 py-2">
                    <div className="text-xs text-zinc-500">Energy</div>
                    <div className="text-lg font-semibold">{dashboard.checkin.energyScore}/7</div>
                  </div>
                  <div className="rounded-md bg-zinc-50 px-3 py-2">
                    <div className="text-xs text-zinc-500">Stress</div>
                    <div className="text-lg font-semibold">{dashboard.checkin.stressScore}/7</div>
                  </div>
                </div>
                {dashboard.checkin.availableCapacityMinutes && (
                  <div className="rounded-md bg-zinc-50 px-3 py-2 text-sm">
                    <span className="font-medium">{dashboard.checkin.availableCapacityMinutes} min</span> available capacity
                  </div>
                )}
                {dashboard.checkin.userNote && <p className="text-sm text-zinc-600">{dashboard.checkin.userNote}</p>}
              </div>
            ) : (
              <p className="mt-3 text-sm text-zinc-500">No check-in has been submitted for this date.</p>
            )}
            <DailyCheckinForm date={dashboard.date} initialCheckin={checkinFormState} />
            {dashboard.todayCheckinLogs.length > 0 && (
              <div className="mt-4 border-t border-zinc-100 pt-4">
                <h3 className="text-sm font-semibold text-zinc-950">Today&apos;s stress/energy log</h3>
                <div className="mt-2 grid gap-2">
                  {dashboard.todayCheckinLogs.map((log) => (
                    <div key={log.id} className="rounded-md bg-zinc-50 px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-zinc-700">{formatLoggedAt(log.loggedAt)}</span>
                        <span className="text-xs text-zinc-500">
                          Energy {log.energyScore}/7 · Stress {log.stressScore}/7
                        </span>
                      </div>
                      {log.userNote && <p className="mt-1 text-xs text-zinc-500">{log.userNote}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </article>

          <article className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-950">Next calendar event</h2>
            {dashboard.nextCalendarEvent ? (
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                <h3 className="font-semibold text-zinc-950">{dashboard.nextCalendarEvent.title}</h3>
                <p className="mt-1 text-sm text-zinc-600">
                  {formatTime(dashboard.nextCalendarEvent.startTime)} - {formatTime(dashboard.nextCalendarEvent.endTime)}
                </p>
                {dashboard.nextCalendarEvent.location && (
                  <p className="mt-1 text-sm text-zinc-600">{dashboard.nextCalendarEvent.location}</p>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-zinc-500">No upcoming fixed events for this date.</p>
            )}
          </article>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-950">Today&apos;s blocks</h2>
            </div>
            <AdjustTodayClient />
            <TodayBlocksClient initialBlocks={todayBlocks} />
          </article>

          <article className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-950">Top tasks</h2>
            <div className="mt-3 grid gap-2">
              {dashboard.topTasks.map((task) => (
                <div key={task.id} className="rounded-md bg-zinc-50 px-3 py-2 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-zinc-950">{task.title}</div>
                      <div className="mt-1 text-xs text-zinc-500">{formatDate(task.dueAt)}</div>
                    </div>
                    <div className="shrink-0 text-right text-xs text-zinc-500">
                      <div>P{task.priority}</div>
                      <div>Load {task.cognitiveLoad}/7</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-zinc-950">AI insights</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {dashboard.insights.map((insight) => (
              <article key={insight.id} className={`rounded-lg border p-3 ${insightClass(insight.severity)}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-zinc-950">{insight.title}</h3>
                  <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-medium text-zinc-600">
                    {insight.scope}
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-700">{insight.body}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
