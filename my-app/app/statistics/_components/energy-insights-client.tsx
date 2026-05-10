"use client";

import { useState, useEffect } from "react";
import EnergyCircle from "./energy-circle";
import PastEnergyHistory from "./past-energy-history";
import WeeklyAiInsights from "./weekly-ai-insights";

const energyGradients: Record<number, string> = {
  1: "linear-gradient(62deg, #F1A19D 28.5%, #D25A54 64.28%, #921D17 117.91%)",
  2: "linear-gradient(45deg, #E4B886 8.9%, #F69221 53.82%, #A86416 85.88%)",
  3: "linear-gradient(110deg, #EADA98 5.97%, #F0D14F 47.45%, #CCA608 88.94%)",
  4: "linear-gradient(231deg, #ADE09B 21.19%, #6BC94A 67.47%, #348717 113.75%)",
  5: "linear-gradient(153deg, #87C9CA 29.99%, #45C5C7 57.12%, #069699 82.95%)",
  6: "linear-gradient(180deg, #AAB6D8 0%, #748EDA 50%, #405592 100%)",
  7: "linear-gradient(180deg, #D7A5DD 0%, #CA65D6 50%, #9F1AAF 100%)",
};

export interface EnergyData {
  todayEnergy: number | null;
  todayStress: number | null;
  pastWeek: Array<{ date: string; energy: number; stress: number }>;
  month: Array<{ date: string; energy: number; stress: number; hasCheckin: boolean }>;
  averageEnergy: number;
  averageStress: number;
  weeklyTasks: Array<{
    date: string;
    completed: number;
    total: number;
    tasksCompleted?: number;
    eventsCompleted?: number;
  }>;
  insights: Array<{
    type: string;
    title: string;
    reason: string;
  }>;
}

export default function EnergyInsightsClient() {
  const [data, setData] = useState<EnergyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCheckinOpen, setIsCheckinOpen] = useState(false);
  const [energyScore, setEnergyScore] = useState(4);
  const [stressScore, setStressScore] = useState(4);
  const [userNote, setUserNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function loadEnergyData() {
    const response = await fetch("/api/statistics/energy-insights");
    if (!response.ok) {
      throw new Error("Failed to fetch energy insights.");
    }

    const result = await response.json();
    return result.data as EnergyData;
  }

  useEffect(() => {
    let isActive = true;

    loadEnergyData()
      .then((nextData) => {
        if (isActive) {
          setData(nextData);
        }
      })
      .catch((error) => {
        console.error("Failed to fetch energy insights:", error);
      })
      .finally(() => {
        if (isActive) {
          setLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  async function submitCheckin() {
    setIsSaving(true);
    setSaveError(null);

    try {
      const response = await fetch("/api/checkins/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loggedAt: new Date().toISOString(),
          energyScore,
          stressScore,
          userNote: userNote.trim() || null,
          source: "manual",
          adjustToday: true,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Failed to save check-in.");
      }

      setIsCheckinOpen(false);
      setUserNote("");
      setData(await loadEnergyData());
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save check-in.");
    } finally {
      setIsSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#111]">
        <div className="font-[var(--font-jakarta)] text-sm text-white/70">Loading...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#111]">
        <div className="font-[var(--font-jakarta)] text-sm text-white/70">No data available</div>
      </div>
    );
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[430px] overflow-hidden bg-[#111] text-white">
      <div className="relative flex min-h-dvh flex-col px-8 pb-8 pt-8">
        <section className="flex flex-1 flex-col items-center">
          <EnergyCircle
            energy={data.todayEnergy}
            stress={data.todayStress}
            onAddCheckin={() => setIsCheckinOpen(true)}
          />

          <PastEnergyHistory history={data.pastWeek} month={data.month} />
          <WeeklyAiInsights
            insights={data.insights}
            weeklyTasks={data.weeklyTasks}
            averageEnergy={data.averageEnergy}
            averageStress={data.averageStress}
            todayEnergy={data.todayEnergy}
            todayStress={data.todayStress}
          />
        </section>
      </div>

      {isCheckinOpen && (
        <div className="fixed inset-0 z-[70] flex items-end bg-black/70 px-4 pb-6 backdrop-blur-sm sm:items-center sm:justify-center">
          <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#101010] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-white">log your energy</h2>
                <p className="mt-1 text-sm text-white/50">Add a fresh energy and stress check-in.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCheckinOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20"
                aria-label="Close check-in form"
              >
                ×
              </button>
            </div>

            <div className="mt-6 space-y-5">
<label className="grid gap-2 text-sm text-white/70">
  <span className="flex items-center justify-between">
    Energy
    <span className="text-white">{energyScore}/7</span>
  </span>
  <input
    type="range"
    min="1"
    max="7"
    step="1"
    value={energyScore}
    onChange={(event) => setEnergyScore(Number(event.target.value))}
    className="slider-rect-thumb h-2 w-full cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-md"
    style={{
      background: "linear-gradient(90deg, rgba(95, 182, 96, 0.65) 0%, rgba(135, 183, 95, 0.65) 8%, rgba(175, 184, 93, 0.65) 24%, rgba(255, 186, 90, 0.65) 48%, rgba(255, 128, 128, 0.65) 85%)",
      border: "1px solid #ffffff3a",
      WebkitAppearance: "none",
    }}
  />
  <style>{`
    .slider-rect-thumb::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 14px;
      height: 26px;
      border-radius: 4px;
      background: #E3E3E3;
      box-shadow: 0 1px 4px rgba(0,0,0,0.4);
      cursor: pointer;
    }
    .slider-rect-thumb::-moz-range-thumb {
      width: 14px;
      height: 26px;
      border-radius: 4px;
      background: #E3E3E3;
      box-shadow: 0 1px 4px rgba(0,0,0,0.4);
      cursor: pointer;
      border: none;
    }
  `}</style>
  <span className="flex justify-between text-xs text-white/35">
    <span>drained</span>
    <span>energized</span>
  </span>
</label>

<label className="grid gap-2 text-sm text-white/70">
  <span className="flex items-center justify-between">
    Stress
    <span className="text-white">{stressScore}/7</span>
  </span>
  <input
    type="range"
    min="1"
    max="7"
    step="1"
    value={stressScore}
    onChange={(event) => setStressScore(Number(event.target.value))}
    className="slider-rect-thumb h-2 w-full cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-md"
    style={{
      background: "linear-gradient(90deg, rgba(255, 128, 128, 0.65) 0%, rgba(231, 170, 85, 0.65) 15.93%, rgba(247, 233, 125, 0.65) 33.83%, rgba(119, 226, 120, 0.65) 54.45%, rgba(84, 186, 209, 0.65) 75.06%, rgba(219, 136, 225, 0.65) 100%)",
      border: "1px solid #b4b4b452",
      WebkitAppearance: "none",
    }}
  />
  <span className="flex justify-between text-xs text-white/35">
    <span>calm</span>
    <span>overloaded</span>
  </span>
</label>

              <label className="grid gap-2 text-sm text-white/70">
                Notes
                <textarea
                  value={userNote}
                  onChange={(event) => setUserNote(event.target.value)}
                  rows={3}
                  placeholder="Optional context"
                  className="resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/30"
                />
              </label>

              {saveError && <p className="text-sm text-red-300">{saveError}</p>}

              <button
                type="button"
                onClick={submitCheckin}
                disabled={isSaving}
                className="w-full rounded-full bg-white px-4 py-3 text-sm font-medium text-black transition-opacity disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save check-in"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
