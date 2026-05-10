"use client";

import { useState } from "react";
import { EnergyStressShape } from "@/app/_components/energy-stress-shape";

interface HistoryEntry {
  date: string;
  energy: number;
  stress: number;
  hasCheckin?: boolean;
}

interface PastEnergyHistoryProps {
  history: HistoryEntry[];
  month: HistoryEntry[];
}

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function dayOfMonth(date: string) {
  return new Date(`${date}T12:00:00`).getDate();
}

function monthLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function monthDayLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export default function PastEnergyHistory({ history, month }: PastEnergyHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const monthEntries = month.length > 0 ? month : history;
  const firstDayOffset = (new Date(`${monthEntries[0]?.date ?? history[0]?.date}T12:00:00`).getDay() + 6) % 7;

  return (
    <div className="mt-5 w-full rounded-lg border border-white/10 bg-[#1B1B1B]/82 px-[26px] pb-5 pt-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_14px_30px_rgba(0,0,0,0.26)] backdrop-blur-md">
      <div className="flex items-center justify-between">
        <h2 className="text-[38px] leading-none text-white">your past energy</h2>
        <button
          type="button"
          aria-label={isExpanded ? "Collapse month energy calendar" : "Expand month energy calendar"}
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((current) => !current)}
          className="flex h-10 w-10 items-center justify-center text-white/90 transition-opacity hover:opacity-70"
        >
          <span
            className="block h-3.5 w-3.5 rotate-45 border-b-2 border-r-2 border-current"
          />
        </button>
      </div>

      {isExpanded ? (
        <div className="mt-3">
          <div className="flex items-center justify-between font-[var(--font-jakarta)] text-white/75">
            <button type="button" className="flex items-center gap-1.5 text-[15px] font-light">
              {monthLabel(monthEntries[0]?.date ?? history[0]?.date)}
            <span className="block h-2 w-2 rotate-45 border-r border-t border-white/75" />
            </button>
            <div className="flex gap-4">
              <button type="button" aria-label="Previous month" className="h-6 w-6">
                <span className="mx-auto block h-2.5 w-2.5 -rotate-[135deg] border-r border-t border-white/85" />
              </button>
              <button type="button" aria-label="Next month" className="h-6 w-6">
                <span className="mx-auto block h-2.5 w-2.5 rotate-45 border-r border-t border-white/85" />
              </button>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-7 gap-5">
            {DAYS.map((day) => (
              <span
                key={day}
                className="font-[var(--font-jakarta)] leading-none text-white/70"
              >
                {day}
              </span>
            ))}
            {Array.from({ length: firstDayOffset }).map((_, index) => (
              <span key={`blank-${index}`} aria-hidden="true" />
            ))}
            {monthEntries.map((entry) => (
              <div key={entry.date} className="flex min-h-[73px] min-w-0 flex-col items-center">
                <EnergyStressShape
                  energyScore={entry.energy}
                  stressScore={entry.stress}
                  className="h-[39px] w-[39px]"
                  label={`${monthDayLabel(entry.date)} energy ${entry.energy} and stress ${entry.stress}`}
                />
                <span className="mt-2 font-[var(--font-jakarta)] text-[22px] font-light leading-none text-white/75">
                  {dayOfMonth(entry.date)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-7 gap-5">
          {history.map((entry) => {
            const dayOfWeek = (new Date(`${entry.date}T12:00:00`).getDay() + 6) % 7;
            return (
              <div key={entry.date} className="flex min-w-0 flex-col items-center">
                <span className="font-[var(--font-jakarta)] text-[15px] font-light leading-none text-white/70">
                  {DAYS[dayOfWeek]}
                </span>
                <EnergyStressShape
                  energyScore={entry.energy}
                  stressScore={entry.stress}
                  className="mt-8 h-[34px] w-[34px]"
                  label={`${DAYS[dayOfWeek]} energy ${entry.energy} and stress ${entry.stress}`}
                />
                <span className="mt-3 font-[var(--font-jakarta)] text-[19px] font-light leading-none text-white/70">
                  {dayOfMonth(entry.date)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
