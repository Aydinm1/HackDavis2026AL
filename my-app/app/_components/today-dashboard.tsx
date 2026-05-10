import Link from "next/link";
import { getCurrentUserId } from "@/lib/auth";
import { getTodayDashboard, parseDashboardDate } from "@/lib/services/dashboard";
import { DailyCheckinForm, type DailyCheckinFormState } from "@/app/_components/daily-checkin-form";
import { TodayBlocksClient, type TodayBlockViewModel } from "@/app/_components/today-blocks-client";
import { AdjustTodayClient } from "@/app/_components/adjust-today-client";
import { DailyOnboardingCheckin } from "@/app/_components/daily-onboarding-checkin";
import { EnergyStressShape } from "@/app/_components/energy-stress-shape";
import { ResetCheckinButton } from "@/app/_components/reset-checkin-button";

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
      <main className="min-h-screen bg-[#101010] px-5 py-8 pb-28 font-sans text-zinc-950">
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-700">
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

  // Pick 3 blocks: priority is the primary factor, then try to cover low/medium/high difficulty.
  const byPriority = [...dashboard.todayBlocks].sort((a, b) => {
    const ap = a.task?.priority ?? Number.POSITIVE_INFINITY;
    const bp = b.task?.priority ?? Number.POSITIVE_INFINITY;
    if (ap !== bp) return ap - bp;
    return a.startTime.getTime() - b.startTime.getTime();
  });
  const difficultyBucket = (block: (typeof byPriority)[number]) => {
    const load = block.task?.cognitiveLoad ?? block.taskBreakdown?.cognitiveLoad ?? null;
    if (load == null) return null;
    if (load <= 2) return "low" as const;
    if (load <= 5) return "medium" as const;
    return "high" as const;
  };
  const picked: typeof byPriority = [];
  const pickedIds = new Set<string>();
  for (const level of ["high", "medium", "low"] as const) {
    const candidate = byPriority.find(
      (b) => !pickedIds.has(b.id) && difficultyBucket(b) === level,
    );
    if (candidate) {
      picked.push(candidate);
      pickedIds.add(candidate.id);
    }
  }
  for (const block of byPriority) {
    if (picked.length >= 3) break;
    if (!pickedIds.has(block.id)) {
      picked.push(block);
      pickedIds.add(block.id);
    }
  }
  const urgentBlocks = picked.sort((a, b) => {
    const ap = a.task?.priority ?? Number.POSITIVE_INFINITY;
    const bp = b.task?.priority ?? Number.POSITIVE_INFINITY;
    if (ap !== bp) return ap - bp;
    return a.startTime.getTime() - b.startTime.getTime();
  });
  const hasMoreBlocks = dashboard.todayBlocks.length > 3;
  const remainingCount = dashboard.todayBlocks.length - 3;

  const todayBlocks: TodayBlockViewModel[] = urgentBlocks.map((block) => ({
    id: block.id,
    title: block.title,
    subtitle: block.task?.title ?? block.taskBreakdown?.title ?? "Scheduled work",
    startTime: block.startTime.toISOString(),
    endTime: block.endTime.toISOString(),
    status: block.status,
    schedulingReason: block.schedulingReason,
    priority: block.task?.priority ?? null,
    cognitiveLoad: block.task?.cognitiveLoad ?? block.taskBreakdown?.cognitiveLoad ?? null,
    dueAt: block.task?.dueAt ? block.task.dueAt.toISOString() : null,
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
  const shouldShowOnboardingCheckin = !dashboard.checkin && dashboard.todayCheckinLogs.length === 0;
  const activeCheckin = dashboard.latestCheckinLog ?? dashboard.checkin;

  return (
    <main className="min-h-screen bg-[#101010] px-5 py-8 pb-28 font-sans text-zinc-950">
      {shouldShowOnboardingCheckin && (
        <DailyOnboardingCheckin date={dashboard.date} planningCycleId={checkinFormState?.planningCycleId ?? null} />
      )}
      <div className="flex w-full flex-col gap-6">
        <header className="relative">
          <ResetCheckinButton date={dashboard.date}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M21.6488 19.875C20.2209 17.4065 18.0206 15.6365 15.4528 14.7975C16.723 14.0414 17.7098 12.8892 18.2618 11.5179C18.8137 10.1467 18.9003 8.63211 18.5082 7.20688C18.1161 5.78165 17.267 4.52454 16.0912 3.6286C14.9155 2.73266 13.4782 2.24744 12 2.24744C10.5218 2.24744 9.08451 2.73266 7.90878 3.6286C6.73306 4.52454 5.88394 5.78165 5.49183 7.20688C5.09971 8.63211 5.18629 10.1467 5.73825 11.5179C6.29021 12.8892 7.27704 14.0414 8.5472 14.7975C5.97938 15.6356 3.77907 17.4056 2.35126 19.875C2.2989 19.9604 2.26417 20.0554 2.24912 20.1544C2.23407 20.2534 2.239 20.3544 2.26363 20.4515C2.28825 20.5486 2.33207 20.6397 2.3925 20.7196C2.45293 20.7995 2.52874 20.8664 2.61547 20.9165C2.7022 20.9666 2.79808 20.9988 2.89745 21.0113C2.99683 21.0237 3.0977 21.0161 3.19409 20.989C3.29049 20.9618 3.38047 20.9156 3.45872 20.8531C3.53697 20.7906 3.6019 20.713 3.6497 20.625C5.41595 17.5725 8.53782 15.75 12 15.75C15.4622 15.75 18.5841 17.5725 20.3503 20.625C20.3981 20.713 20.4631 20.7906 20.5413 20.8531C20.6196 20.9156 20.7095 20.9618 20.8059 20.989C20.9023 21.0161 21.0032 21.0237 21.1026 21.0113C21.2019 20.9988 21.2978 20.9666 21.3845 20.9165C21.4713 20.8664 21.5471 20.7995 21.6075 20.7196C21.6679 20.6397 21.7118 20.5486 21.7364 20.4515C21.761 20.3544 21.766 20.2534 21.7509 20.1544C21.7358 20.0554 21.7011 19.9604 21.6488 19.875ZM6.75001 8.99999C6.75001 7.96164 7.05792 6.9466 7.63479 6.08324C8.21167 5.21989 9.03161 4.54698 9.99092 4.14962C10.9502 3.75226 12.0058 3.64829 13.0242 3.85086C14.0426 4.05344 14.9781 4.55345 15.7123 5.28768C16.4465 6.0219 16.9466 6.95736 17.1491 7.97576C17.3517 8.99416 17.2477 10.0498 16.8504 11.0091C16.453 11.9684 15.7801 12.7883 14.9168 13.3652C14.0534 13.9421 13.0384 14.25 12 14.25C10.6081 14.2485 9.27359 13.6949 8.28934 12.7107C7.3051 11.7264 6.7515 10.3919 6.75001 8.99999Z" fill="#F5F5F5"/>
            </svg>
          </ResetCheckinButton>
          <div className="pt-[80px]">
            <EnergyStressShape
              energyScore={activeCheckin?.energyScore ?? null}
              stressScore={activeCheckin?.stressScore ?? null}
              className="h-[53px] w-[58px]"
              label={
                activeCheckin
                  ? `Energy ${activeCheckin.energyScore} and stress ${activeCheckin.stressScore}`
                  : "No check-in logged"
              }
            />
            <h1 className="font-normal py-[20px]">your day at a glance</h1>
          </div>
        </header>

        {/* Today's blocks — capped at 3 */}
        <article className="rounded-lg shadow-sm">
          <h2 className="text-base font-semibold text-zinc-950">— upcoming events & tasks</h2>
          <TodayBlocksClient initialBlocks={todayBlocks} />
          <Link
            href="/calendar"
            className="mt-3 flex-col flex w-full items-center justify-center gap-2 rounded-lg  px-4 py-3 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-200"
          >
          <svg xmlns="http://www.w3.org/2000/svg" width="8" height="17" viewBox="0 0 8 17" fill="none">
            <path d="M3.32845 16.3536C3.52372 16.5488 3.8403 16.5488 4.03556 16.3536L7.21754 13.1716C7.4128 12.9763 7.4128 12.6597 7.21754 12.4645C7.02228 12.2692 6.7057 12.2692 6.51043 12.4645L3.68201 15.2929L0.85358 12.4645C0.658318 12.2692 0.341735 12.2692 0.146473 12.4645C-0.0487893 12.6597 -0.0487893 12.9763 0.146473 13.1716L3.32845 16.3536ZM3.68201 0H3.18201V16H3.68201H4.18201V0H3.68201Z" fill="#F5F5F5"/>
          </svg>
          <span className="caption font-thin">
            {hasMoreBlocks ? `view more events & tasks` : "See full calendar"}
          </span>
          </Link>
        </article>

        {/* AI insights */}
        <article className="flex flex-col gap-3">
          {/* First insight — full width rectangle */}
          {dashboard.insights[0] && (
            <div className="relative overflow-hidden rounded-2xl bg-[#1a1f1a] p-5">
              <div
                className="pointer-events-none absolute -right-16 -top-24 h-[303px] w-[303px]"
                style={{
                  borderRadius: "303.043px",
                  background:
                    "linear-gradient(199deg, rgba(54, 181, 57, 0.20) 32.23%, rgba(54, 181, 57, 0.00) 101.41%)",
                  filter: "blur(55px)",
                }}
              />
              <div className="relative z-10 flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-[#F5F5F5]">{dashboard.insights[0].title}</h3>
                <span className="text-xs text-zinc-500">{dashboard.insights[0].scope}</span>
              </div>
              <p className="relative z-10 mt-2 text-sm text-[#A0A0A0]">{dashboard.insights[0].body}</p>
            </div>
          )}

          {/* Yesterday stats — 2 column grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-[#1a1f1a] p-5">
              <p
                className="mt-2"
                style={{
                  color: "#F5F5F5",
                  fontFamily: '"Cormorant Garamond"',
                  fontSize: "64px",
                  fontStyle: "italic",
                  fontWeight: 400,
                  lineHeight: "normal",
                }}
              >
                {dashboard.yesterdayEventsAttended}
              </p>
              <p className="mt-1 pt-2 text-xs text-[#A0A0A0]">Events attended yesterday</p>
            </div>
            <div className="rounded-2xl bg-[#1a1f1a] p-5">
              <p
                className="mt-2"
                style={{
                  color: "#F5F5F5",
                  fontFamily: '"Cormorant Garamond"',
                  fontSize: "64px",
                  fontStyle: "italic",
                  fontWeight: 400,
                  lineHeight: "normal",
                }}
              >
                {dashboard.yesterdayTasksCompleted}
              </p>
              <p className="mt-1 pt-2 text-xs text-[#A0A0A0]">Tasks completed yesterday</p>
            </div>
          </div>
        </article>

        <footer className="relative">
          <div className="pt-[80px] flex flex-col items-center text-center">
            <EnergyStressShape
              energyScore={activeCheckin?.energyScore ?? null}
              stressScore={activeCheckin?.stressScore ?? null}
              className="h-[53px] w-[58px]"
            />
            <p className="font-normal py-[20px]">hug your mom!</p>
          </div>
        </footer>
      </div>
    </main>
  );
}
