"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EnergyStressShape } from "@/app/_components/energy-stress-shape";

function defaultLoggedAt(date: string) {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${date}T${hours}:${minutes}:00`;
}

function SliderCard({
  title,
  lowLabel,
  highLabel,
  value,
  onChange,
  gradientClassName,
}: {
  title: string;
  lowLabel: string;
  highLabel: string;
  value: number;
  onChange: (value: number) => void;
  gradientClassName: string;
}) {
  const percent = ((value - 1) / 6) * 100;

  return (
    <section className="w-full rounded-lg border border-neutral-500/20 bg-neutral-500/5 px-4 py-3">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <div className="h-px w-6 bg-neutral-100" />
          <h2 className="text-xl font-normal text-neutral-100">log your {title} level</h2>
        </div>
        <div className="flex flex-col gap-2">
          <div className="relative h-6">
            <div className={`absolute left-0 top-[6px] h-4 w-full rounded-full p-[2px] shadow-[0_0_12px_rgba(255,255,255,0.16)] ${gradientClassName}`}>
              <div className={`h-full w-full rounded-full opacity-70 ${gradientClassName}`} />
            </div>
            <input
              type="range"
              min="1"
              max="7"
              step="1"
              value={value}
              onChange={(event) => onChange(Number(event.target.value))}
              aria-label={`Log your ${title} level`}
              className="absolute inset-0 z-10 h-6 w-full cursor-pointer opacity-0"
            />
            <div
              className="pointer-events-none absolute top-0 h-6 w-3.5 rounded bg-neutral-200"
              style={{ left: `calc(${percent}% - 7px)` }}
            />
          </div>
          <div className="flex justify-between text-xs font-light text-neutral-100">
            <span>{lowLabel}</span>
            <span>{highLabel}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function DailyOnboardingCheckin({
  date,
  planningCycleId,
  userName = "leon",
}: {
  date: string;
  planningCycleId: string | null;
  userName?: string;
}) {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(true);
  const [stressScore, setStressScore] = useState(1);
  const [energyScore, setEnergyScore] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isVisible) return;

    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, [isVisible]);

  if (!isVisible) return null;

  async function submitCheckin() {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/checkins/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planningCycleId: planningCycleId ?? undefined,
          loggedAt: defaultLoggedAt(date),
          energyScore,
          stressScore,
          adjustToday: true,
          source: "manual",
        }),
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to save check-in.");
      }

      setIsVisible(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to save check-in.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] overflow-hidden bg-stone-950 text-neutral-100">
      <main className="mx-auto flex h-dvh max-h-dvh w-full max-w-[430px] flex-col justify-between gap-8 overflow-hidden px-5 pb-8 pt-20">
        <div className="flex flex-col gap-10">
          <h1 className="max-w-[340px] text-4xl font-normal leading-tight text-neutral-100">
            hi {userName}, how are you doing?
          </h1>

          <div className="flex flex-col items-center gap-8">
            <EnergyStressShape
              energyScore={energyScore}
              stressScore={stressScore}
              className="h-48 w-[276px]"
              label={`Energy ${energyScore} and stress ${stressScore}`}
            />

            <div className="flex w-full flex-col gap-3">
              <SliderCard
                title="stress"
                lowLabel="low stress"
                highLabel="high stress"
                value={stressScore}
                onChange={setStressScore}
                gradientClassName="bg-gradient-to-r from-green-400/60 via-lime-400/60 to-rose-400/60"
              />
              <SliderCard
                title="energy"
                lowLabel="low energy"
                highLabel="high energy"
                value={energyScore}
                onChange={setEnergyScore}
                gradientClassName="bg-gradient-to-r from-rose-400/60 via-orange-400/60 to-fuchsia-400/60"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-rose-300">{error}</p>}
          <div className="flex w-full gap-3">
            <button
              type="button"
              onClick={() => setIsVisible(false)}
              disabled={isSaving}
              className="h-12 flex-1 rounded-full border border-red-600 bg-neutral-200/20 px-4 py-2.5 text-base text-rose-400 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitCheckin}
              disabled={isSaving}
              className="h-12 flex-1 rounded-full border border-neutral-200/20 bg-neutral-200/20 px-4 py-2.5 text-base text-neutral-100 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Confirm"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
