"use client";

import { EnergyStressShape } from "@/app/_components/energy-stress-shape";

interface Insight {
  type: string;
  title: string;
  reason: string;
}

interface TaskDay {
  date: string;
  completed: number;
  total: number;
  tasksCompleted?: number;
  eventsCompleted?: number;
}

interface WeeklyAiInsightsProps {
  insights: Insight[];
  weeklyTasks: TaskDay[];
  averageEnergy: number;
  averageStress: number;
  todayEnergy: number | null;
  todayStress: number | null;
}

function pickSuggestion(insights: Insight[]) {
  return (
    insights.find((insight) => /suggest|recovery|break|window|protect|warning/i.test(insight.type)) ??
    insights[1] ??
    null
  );
}

export default function WeeklyAiInsights({
  insights,
  weeklyTasks,
  averageEnergy,
  averageStress,
  todayEnergy,
  todayStress,
}: WeeklyAiInsightsProps) {
  const overview = insights[0];
  const suggestion = pickSuggestion(insights);

  const overviewText =
    overview?.reason ??
    "From last week into this week, you've felt extremely overwhelmed. Take a break where you can.";
  const suggestionText =
    suggestion?.reason ?? "After your exam, schedule time to meet up with a friend or two.";

  return (
    <section className="mt-16 w-full">
      <h2 className="text-[38px] leading-none text-white">insights and breakdowns</h2>

      <div className="mt-8 grid grid-cols-2 gap-4">
        <article className="min-h-[168px] rounded-lg border border-white/10 bg-[#1B1B1B]/82 px-4 py-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_14px_30px_rgba(0,0,0,0.22)] backdrop-blur-md">
          <div className="flex items-center gap-3">
            <SparkleIcon />
            <h3 className="text-[28px] leading-none text-white">Float&apos;s Overview</h3>
          </div>
          <p className="mt-4 line-clamp-4 font-[var(--font-jakarta)] text-[15px] font-light leading-[1.28] text-white/82">
            {overviewText}
          </p>
        </article>

        <article className="min-h-[168px] rounded-lg border border-white/10 bg-[#1B1B1B]/82 px-4 py-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_14px_30px_rgba(0,0,0,0.22)] backdrop-blur-md">
          <h3 className="text-[28px] leading-none text-white">Suggestions</h3>
          <p className="mt-8 line-clamp-4 font-[var(--font-jakarta)] text-[15px] font-light leading-[1.28] text-white/82">
            {suggestionText}
          </p>
        </article>
      </div>

      <CompletedWeekChart weeklyTasks={weeklyTasks} />

      <div className="mt-5 flex flex-col gap-5">
        <WeeklyMetricBar
          label="last week's average stress"
          value={averageStress}
          gradientClassName="bg-gradient-to-r from-green-400/60 via-lime-400/60 to-rose-400/60"
        />
        <WeeklyMetricBar
          label="last week's average energy"
          value={averageEnergy}
          gradientClassName="bg-gradient-to-r from-rose-400/60 via-orange-400/60 to-green-400/60"
        />
      </div>

      <div className="flex flex-col items-center pb-6 pt-28">
        <EnergyStressShape
          energyScore={todayEnergy}
          stressScore={todayStress}
          className="h-14 w-16"
          label={
            todayEnergy && todayStress
              ? `Energy ${todayEnergy} and stress ${todayStress}`
              : "No check-in logged"
          }
        />
        <p className="mt-8 font-[var(--font-jakarta)] text-[19px] font-light leading-none text-white">call your mom!</p>
      </div>
    </section>
  );
}

function CompletedWeekChart({ weeklyTasks }: { weeklyTasks: TaskDay[] }) {
  const chartDays = weeklyTasks.map((day) => ({
    date: day.date,
    tasks: day.tasksCompleted ?? day.completed,
    events: day.eventsCompleted ?? Math.max(0, day.total - day.completed),
  }));
  const maxValue = Math.max(20, ...chartDays.map((day) => day.tasks + day.events));

  return (
    <article className="mt-5 rounded-lg border border-white/10 bg-[#1B1B1B]/82 px-4 pb-6 pt-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_14px_30px_rgba(0,0,0,0.22)] backdrop-blur-md">
      <h3 className="text-[28px] leading-none text-white">completed tasks this week</h3>

      <div className="mt-8 grid grid-cols-[28px_1fr] gap-x-2">
        <div className="flex h-[188px] flex-col justify-between pb-0 pt-0 font-[var(--font-jakarta)] text-[18px] font-light leading-none text-white/35">
          <span>20</span>
          <span>15</span>
          <span>10</span>
          <span>5</span>
        </div>

        <div className="relative h-[188px] border-b border-l border-white/45">
          <div className="absolute inset-x-0 bottom-0 flex h-full items-end">
            {chartDays.map((day) => {
              const tasksHeight = (day.tasks / maxValue) * 100;
              const eventsHeight = (day.events / maxValue) * 100;

              return (
                <div key={day.date} className="flex h-full flex-1 items-end px-[1px]">
                  <div className="flex h-full w-full flex-col justify-end overflow-hidden rounded-t-md">
                    <div
                      className="border border-[#932BA4] bg-[#7A1F8D]/55 shadow-[inset_0_0_16px_rgba(188,54,205,0.18)]"
                      style={{ height: `${eventsHeight}%` }}
                    />
                    <div
                      className="border border-[#226D78] bg-[#174C55]/74 shadow-[inset_0_0_18px_rgba(76,184,202,0.12)]"
                      style={{ height: `${tasksHeight}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-8 font-[var(--font-jakarta)] text-[18px] font-light text-white/82">
        <div className="flex items-center gap-3">
          <span className="h-3.5 w-3.5 rounded-full bg-[#3AA9C0]" />
          tasks
        </div>
        <div className="flex items-center gap-3">
          <span className="h-3.5 w-3.5 rounded-full bg-[#C02ED2]" />
          events
        </div>
      </div>
    </article>
  );
}

function WeeklyMetricBar({
  label,
  value,
  gradientClassName,
}: {
  label: string;
  value: number;
  gradientClassName: string;
}) {
  const percent = ((Math.max(1, Math.min(7, value)) - 1) / 6) * 100;

  return (
    <section className="rounded-lg border border-white/10 bg-[#1B1B1B]/82 px-4 pb-5 pt-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_14px_30px_rgba(0,0,0,0.22)] backdrop-blur-md">
      <div className="relative h-8">
        <div className={`absolute left-0 top-[6px] h-4 w-full rounded-full p-[2px] shadow-[0_0_12px_rgba(255,255,255,0.16)] ${gradientClassName}`}>
          <div className={`h-full w-full rounded-full opacity-70 ${gradientClassName}`} />
        </div>
        <div
          className="pointer-events-none absolute top-0 h-7 w-4 rounded bg-neutral-200"
          style={{ left: `calc(${percent}% - 8px)` }}
        />
      </div>
      <h3 className="mt-7 text-[28px] leading-none text-white">{label}</h3>
    </section>
  );
}

function SparkleIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-8 w-8 shrink-0 text-white"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M14 3L17.2 11.8L26 15L17.2 18.2L14 27L10.8 18.2L2 15L10.8 11.8L14 3Z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path d="M24 3V9M21 6H27M27 12V16M25 14H29" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
