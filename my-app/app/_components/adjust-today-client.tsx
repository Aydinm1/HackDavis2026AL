"use client";

import { useState } from "react";

type AdjustmentAction = "keep" | "shorten" | "move" | "skip" | "replace_with_lower_load_task";

type SuggestedAdjustment = {
  action: AdjustmentAction;
  scheduledBlockId: string;
  title: string;
  currentDurationMinutes: number;
  suggestedDurationMinutes: number | null;
  reason: string;
  replacementTask?: { title: string } | null;
};

type AdjustTodayResult = {
  summary: string;
  suggestedAdjustments: SuggestedAdjustment[];
};

const BADGE_COLORS: Record<AdjustmentAction, string> = {
  keep: "bg-green-100 text-green-800 border-green-200",
  shorten: "bg-amber-100 text-amber-800 border-amber-200",
  move: "bg-blue-100 text-blue-800 border-blue-200",
  skip: "bg-red-100 text-red-800 border-red-200",
  replace_with_lower_load_task: "bg-violet-100 text-violet-800 border-violet-200",
};

const BADGE_LABELS: Record<AdjustmentAction, string> = {
  keep: "Keep",
  shorten: "Shorten",
  move: "Move",
  skip: "Skip",
  replace_with_lower_load_task: "Replace",
};

export function AdjustTodayClient() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AdjustTodayResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/schedule/adjust-today", { method: "POST" });
      const json = (await res.json()) as { data?: AdjustTodayResult; error?: string };
      if (!res.ok || !json.data) {
        setError(json.error ?? "Failed to get adjustments.");
        return;
      }
      setResult(json.data);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={loading}
        className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
      >
        {loading ? "Analyzing…" : "Adjust Today"}
      </button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {result && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-zinc-600">{result.summary}</p>
          {result.suggestedAdjustments.map((adj) => {
            const badgeClass = BADGE_COLORS[adj.action] ?? "bg-zinc-100 text-zinc-700 border-zinc-200";
            const label = BADGE_LABELS[adj.action] ?? adj.action;
            return (
              <div key={adj.scheduledBlockId} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-zinc-950">{adj.title}</span>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${badgeClass}`}>
                    {label}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">{adj.reason}</p>
                {adj.action === "shorten" && adj.suggestedDurationMinutes !== null && (
                  <p className="mt-1 text-xs text-amber-700">
                    Suggested: {adj.suggestedDurationMinutes} min (currently {adj.currentDurationMinutes} min)
                  </p>
                )}
                {adj.action === "replace_with_lower_load_task" && adj.replacementTask && (
                  <p className="mt-1 text-xs text-violet-700">Replace with: {adj.replacementTask.title}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
