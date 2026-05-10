"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type CalendarItemViewModel = {
  id: string;
  kind: "event" | "block";
  title: string;
  subtitle: string;
  startTime: string;
  endTime: string;
  status: string;
  taskTitle: string | null;
  reason: string | null;
};

function formatTime(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

function formatDay(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

function minutesBetween(startTime: string, endTime: string) {
  return Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60_000);
}

function eventKindClass(kind: "event" | "block", status?: string) {
  if (kind === "event") return "border-blue-200 bg-blue-50";
  if (status === "accepted") return "border-emerald-200 bg-emerald-50";
  if (status === "completed") return "border-zinc-200 bg-zinc-100";
  if (status === "skipped") return "border-amber-200 bg-amber-50";
  return "border-violet-200 bg-violet-50";
}

export function CalendarClient({ initialItems }: { initialItems: CalendarItemViewModel[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [busyEventId, setBusyEventId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const groupedItems = useMemo(
    () =>
      items.reduce<Record<string, CalendarItemViewModel[]>>((groups, item) => {
        const key = new Date(item.startTime).toISOString().slice(0, 10);
        groups[key] ??= [];
        groups[key].push(item);
        return groups;
      }, {}),
    [items],
  );

  async function deleteEvent(item: CalendarItemViewModel) {
    if (!window.confirm(`Delete "${item.title}"? This marks it cancelled for the MVP.`)) {
      return;
    }

    setError(null);
    setBusyEventId(item.id);
    try {
      const response = await fetch(`/api/calendar/events/${item.id}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Failed to delete event.");
      setItems((current) => current.filter((candidate) => candidate.id !== item.id || candidate.kind !== "event"));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to delete event.");
    } finally {
      setBusyEventId(null);
    }
  }

  return (
    <section className="grid gap-5">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

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
                {item.kind === "event" && (
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => deleteEvent(item)}
                      disabled={busyEventId === item.id}
                      className="rounded-md border border-red-200 bg-white/80 px-3 py-2 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:text-zinc-400"
                    >
                      {busyEventId === item.id ? "Deleting..." : "Delete event"}
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}
