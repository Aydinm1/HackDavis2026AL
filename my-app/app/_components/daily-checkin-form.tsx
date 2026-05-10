"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type DailyCheckinFormState = {
  planningCycleId: string | null;
  energyScore: number;
  stressScore: number;
  availableCapacityMinutes: number | null;
  userNote: string | null;
};

export function DailyCheckinForm({
  date,
  initialCheckin,
}: {
  date: string;
  initialCheckin: DailyCheckinFormState | null;
}) {
  const router = useRouter();
  const [energyScore, setEnergyScore] = useState(String(initialCheckin?.energyScore ?? 4));
  const [stressScore, setStressScore] = useState(String(initialCheckin?.stressScore ?? 4));
  const [availableCapacityMinutes, setAvailableCapacityMinutes] = useState(
    initialCheckin?.availableCapacityMinutes ? String(initialCheckin.availableCapacityMinutes) : "",
  );
  const [userNote, setUserNote] = useState(initialCheckin?.userNote ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitCheckin() {
    setError(null);
    const capacity = availableCapacityMinutes.trim() ? Number(availableCapacityMinutes) : null;

    if (capacity !== null && (!Number.isInteger(capacity) || capacity < 0)) {
      setError("Capacity must be a whole number of minutes.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/checkins/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planningCycleId: initialCheckin?.planningCycleId ?? undefined,
          checkinDate: date,
          energyScore: Number(energyScore),
          stressScore: Number(stressScore),
          availableCapacityMinutes: capacity,
          userNote: userNote.trim() || null,
          adjustToday: true,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Failed to save check-in.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to save check-in.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mt-4 grid gap-3 border-t border-zinc-100 pt-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          <span className="flex items-center justify-between gap-3">
            Energy
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">{energyScore}/7</span>
          </span>
          <input
            type="range"
            min="1"
            max="7"
            step="1"
            value={energyScore}
            onChange={(event) => setEnergyScore(event.target.value)}
            className="h-2 w-full accent-violet-600"
          />
          <span className="flex justify-between text-xs font-normal text-zinc-500">
            <span>drained</span>
            <span>energized</span>
          </span>
        </label>
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          <span className="flex items-center justify-between gap-3">
            Stress
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">{stressScore}/7</span>
          </span>
          <input
            type="range"
            min="1"
            max="7"
            step="1"
            value={stressScore}
            onChange={(event) => setStressScore(event.target.value)}
            className="h-2 w-full accent-violet-600"
          />
          <span className="flex justify-between text-xs font-normal text-zinc-500">
            <span>calm</span>
            <span>overloaded</span>
          </span>
        </label>
      </div>
      <label className="grid gap-1 text-sm font-medium text-zinc-700">
        Available capacity minutes
        <input
          type="number"
          min="0"
          value={availableCapacityMinutes}
          onChange={(event) => setAvailableCapacityMinutes(event.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-normal text-zinc-950 outline-none focus:border-violet-500"
          placeholder="120"
        />
      </label>
      <label className="grid gap-1 text-sm font-medium text-zinc-700">
        Note
        <textarea
          value={userNote}
          onChange={(event) => setUserNote(event.target.value)}
          className="min-h-20 rounded-md border border-zinc-300 px-3 py-2 text-sm font-normal text-zinc-950 outline-none focus:border-violet-500"
          placeholder="What should the planner know about today?"
        />
      </label>
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <button
        type="button"
        onClick={submitCheckin}
        disabled={isSaving}
        className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
      >
        {isSaving ? "Saving..." : "Save check-in"}
      </button>
    </div>
  );
}
