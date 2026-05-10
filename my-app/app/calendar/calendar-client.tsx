"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import {
  CreateSheet,
  buildPayload,
  defaultFormState,
  type TaskFormState,
} from "@/app/todolist/tasks-client";

export type WeekDay = {
  letter: string;
  date: string;
  day: number;
};

export type CalendarItemViewModel = {
  id: string;
  kind: "event" | "block";
  title: string;
  startTime: string;
  endTime: string;
  priority: number | null;
  cognitiveLoad: number | null;
};

type Level = "high" | "medium" | "low";

function priorityLevel(priority: number | null): Level | null {
  if (priority == null) return null;
  if (priority <= 2) return "high";
  if (priority === 3) return "medium";
  return "low";
}

function difficultyLevel(load: number | null): Level | null {
  if (load == null) return null;
  if (load <= 2) return "low";
  if (load <= 5) return "medium";
  return "high";
}

const dotColor: Record<Level, string> = {
  high: "bg-[#DD2020]",
  medium: "bg-[#FF9500]",
  low: "bg-[#029C05]",
};

const textColor: Record<Level, string> = {
  high: "text-[#DD2020]",
  medium: "text-[#FF9500]",
  low: "text-[#029C05]",
};

const levelLabel: Record<Level, string> = { high: "High", medium: "Medium", low: "Low" };

function Indicator({ level, suffix }: { level: Level | null; suffix: string }) {
  if (!level) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${textColor[level]}`}
      style={{
        fontFamily: '"Plus Jakarta Sans"',
        fontSize: "12px",
        fontStyle: "normal",
        fontWeight: 300,
        lineHeight: "normal",
      }}
    >
      <span className={`h-2 w-2 rounded-full ${dotColor[level]}`} />
      {levelLabel[level]} {suffix}
    </span>
  );
}

function formatTimeShort(date: string) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" })
    .format(new Date(date))
    .toLowerCase()
    .replace(/\s/g, "");
}

function formatHourLabel(hour: number) {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:00`;
}

function formatGapHours(minutes: number) {
  const hrs = minutes / 60;
  const rounded = Math.round(hrs * 2) / 2;
  return rounded.toString();
}

function EventCard({ item }: { item: CalendarItemViewModel }) {
  const pLevel = priorityLevel(item.priority);
  const dLevel = difficultyLevel(item.cognitiveLoad);
  return (
    <div className="rounded-2xl border border-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold text-[#F5F5F5]">{item.title}</p>
        <div className="caption shrink-0 text-[10px] text-[#A0A0A0]">
          {formatTimeShort(item.startTime)} - {formatTimeShort(item.endTime)}
        </div>
      </div>
      {(pLevel || dLevel) && (
        <div className="mt-3 flex flex-wrap items-center gap-5">
          <Indicator level={pLevel} suffix="Priority" />
          <Indicator level={dLevel} suffix="Difficulty" />
        </div>
      )}
    </div>
  );
}

export function CalendarClient({
  initialItems,
  selectedDate,
  weekDays,
  monthLabel,
  selectedDayName,
}: {
  initialItems: CalendarItemViewModel[];
  selectedDate: string;
  weekDays: WeekDay[];
  monthLabel: string;
  selectedDayName: string;
}) {
  const router = useRouter();
  const [items] = useState(initialItems);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<TaskFormState>(defaultFormState);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime)),
    [items],
  );

  const { hours, gapsByHour } = useMemo(() => {
    if (sortedItems.length === 0) {
      return {
        hours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
        gapsByHour: new Map<number, number>(),
      };
    }
    const startH = Math.min(
      ...sortedItems.map((it) => new Date(it.startTime).getHours()),
    );
    const endH = Math.max(
      ...sortedItems.map((it) => new Date(it.endTime).getHours()),
    );
    const hourList: number[] = [];
    for (let h = startH; h <= endH; h++) hourList.push(h);

    const gMap = new Map<number, number>();
    for (let i = 0; i < sortedItems.length - 1; i++) {
      const a = sortedItems[i];
      const b = sortedItems[i + 1];
      const gapMin = (Date.parse(b.startTime) - Date.parse(a.endTime)) / 60_000;
      if (gapMin >= 60) {
        const midMs = (Date.parse(a.endTime) + Date.parse(b.startTime)) / 2;
        gMap.set(new Date(midMs).getHours(), gapMin);
      }
    }
    return { hours: hourList, gapsByHour: gMap };
  }, [sortedItems]);

  function openCreateForm() {
    setError(null);
    setForm(defaultFormState);
    setIsCreating(true);
  }

  function closeForm() {
    setIsCreating(false);
    setForm(defaultFormState);
  }

  async function submitCreate() {
    setError(null);
    const payload = buildPayload(form);
    if (!payload.title) {
      setError("Title is required.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Failed to create task.");
      closeForm();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to create task.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#101010] px-5 py-8 pb-28 font-sans text-[#F5F5F5]">
      <div className="flex w-full flex-col gap-6">
        <header className="flex items-start justify-between">
          <div>
            <h1
              className="font-normal italic"
              style={{
                fontFamily: '"Cormorant Garamond"',
                fontSize: "48px",
                lineHeight: "normal",
              }}
            >
              {selectedDayName}
            </h1>
            <p className="mt-1 text-sm text-[#A0A0A0]">{monthLabel} ›</p>
          </div>
          <button
            type="button"
            onClick={openCreateForm}
            aria-label="Create"
            className="inline-flex items-center justify-center rounded-full p-2.5 text-[#D9D9D9] backdrop-blur-md transition-colors duration-300 ease-out hover:text-white"
            style={{
              backgroundColor: "rgba(110, 110, 110, 0.20)",
              boxShadow:
                "inset 0 0 0 1px rgba(0, 0, 0, 0.6), inset 1px 1px 0px 0px rgba(185, 185, 185), inset -1px -1px 0px 0px rgb(185, 185, 185)",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </header>

        <nav className="grid grid-cols-7 gap-1 text-center">
          {weekDays.map(({ letter, date, day }) => {
            const isActive = date === selectedDate;
            return (
              <Link
                key={date}
                href={`?day=${date}`}
                className="flex flex-col items-center gap-1.5 py-1"
              >
                <span className="text-[11px] uppercase tracking-wide text-[#A0A0A0]">
                  {letter}
                </span>
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-md text-base ${
                    isActive ? "bg-[#1f2520] text-[#F5F5F5]" : "text-[#A0A0A0]"
                  }`}
                  style={
                    isActive
                      ? {
                          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
                        }
                      : undefined
                  }
                >
                  {day}
                </span>
              </Link>
            );
          })}
        </nav>

        {error && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
            {error}
          </div>
        )}

        <section className="flex flex-col gap-5">
          {hours.map((h) => {
            const eventsAtHour = sortedItems.filter(
              (it) => new Date(it.startTime).getHours() === h,
            );
            const gapMinutes = gapsByHour.get(h);
            return (
              <div key={h} className="grid grid-cols-[60px_1fr] gap-3">
                <div className="pt-3 text-sm text-[#A0A0A0]">{formatHourLabel(h)}</div>
                <div className="flex flex-col gap-4">
                  {eventsAtHour.map((it) => (
                    <EventCard key={`${it.kind}-${it.id}`} item={it} />
                  ))}
                  {gapMinutes !== undefined && (
                    <p className="py-3 text-center text-sm text-[#A0A0A0]">
                      You have a {formatGapHours(gapMinutes)} hr gap, take a breather!
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      </div>

      <AnimatePresence>
        {isCreating && (
          <CreateSheet
            form={form}
            setForm={setForm}
            onSubmit={submitCreate}
            onCancel={closeForm}
            busy={busy}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
