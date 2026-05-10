"use client";

import { useState, useEffect } from "react";
import EnergyCircle from "./energy-circle";
import PastEnergyHistory from "./past-energy-history";
import WeeklyAiInsights from "./weekly-ai-insights";

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
                  className="h-2 w-full accent-[#45C5C7]"
                />
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
                  className="h-2 w-full accent-[#B726C1]"
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
