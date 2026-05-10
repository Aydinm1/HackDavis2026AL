"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type TodayBlockViewModel = {
  id: string;
  title: string;
  subtitle: string;
  startTime: string;
  endTime: string;
  status: string;
  schedulingReason: string | null;
};

type RescheduleSuggestion = {
  startTime: string;
  endTime: string;
  reason: string;
} | null;

function formatTime(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

function minutesBetween(startTime: string, endTime: string) {
  return Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60_000);
}

function statusClass(status: string) {
  if (status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "accepted") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "skipped") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-violet-200 bg-violet-50 text-violet-700";
}

export function TodayBlocksClient({ initialBlocks }: { initialBlocks: TodayBlockViewModel[] }) {
  const router = useRouter();
  const [blocks, setBlocks] = useState(initialBlocks);
  const [busyBlockId, setBusyBlockId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rescheduleSuggestion, setRescheduleSuggestion] = useState<{
    title: string;
    suggestion: RescheduleSuggestion;
  } | null>(null);

  async function updateBlock(block: TodayBlockViewModel, operation: "complete" | "skip") {
    setError(null);
    setRescheduleSuggestion(null);
    setBusyBlockId(block.id);

    try {
      const response = await fetch(`/api/scheduled-blocks/${block.id}/${operation}`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? `Failed to ${operation} scheduled block.`);
      setBlocks((current) =>
        current.map((candidate) =>
          candidate.id === block.id ? { ...candidate, status: body.data.scheduledBlock.status } : candidate,
        ),
      );
      if (operation === "skip") {
        setRescheduleSuggestion({
          title: block.title,
          suggestion: body.data.suggestion ?? null,
        });
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Failed to ${operation} scheduled block.`);
    } finally {
      setBusyBlockId(null);
    }
  }

  return (
    <div className="mt-3 grid gap-3">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </div>
      )}
      {rescheduleSuggestion && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {rescheduleSuggestion.suggestion ? (
            <>
              Suggested next slot for {rescheduleSuggestion.title}: {formatTime(rescheduleSuggestion.suggestion.startTime)} -{" "}
              {formatTime(rescheduleSuggestion.suggestion.endTime)}.
            </>
          ) : (
            <>No same-day reschedule slot was found for {rescheduleSuggestion.title}.</>
          )}
        </div>
      )}
      {blocks.length > 0 ? (
        blocks.map((block) => (
          <div key={block.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-zinc-950">{block.title}</h3>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(block.status)}`}>
                    {block.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-600">{block.subtitle}</p>
              </div>
              <div className="shrink-0 text-sm font-medium text-zinc-800 sm:text-right">
                {formatTime(block.startTime)} - {formatTime(block.endTime)}
                <div className="text-xs font-normal text-zinc-500">{minutesBetween(block.startTime, block.endTime)} min</div>
              </div>
            </div>
            {block.schedulingReason && (
              <p className="mt-3 rounded-md bg-white px-3 py-2 text-xs text-zinc-600">{block.schedulingReason}</p>
            )}
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => updateBlock(block, "complete")}
                disabled={busyBlockId === block.id || block.status === "completed" || block.status === "skipped"}
                className="rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:text-zinc-400"
              >
                {busyBlockId === block.id ? "Saving..." : "Complete"}
              </button>
              <button
                type="button"
                onClick={() => updateBlock(block, "skip")}
                disabled={busyBlockId === block.id || block.status === "completed" || block.status === "skipped"}
                className="rounded-md border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-amber-700 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:text-zinc-400"
              >
                {busyBlockId === block.id ? "Saving..." : "Skip"}
              </button>
            </div>
          </div>
        ))
      ) : (
        <p className="text-sm text-zinc-500">No scheduled work blocks for this date.</p>
      )}
    </div>
  );
}
