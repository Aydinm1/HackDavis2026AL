"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

export type TaskViewModel = {
  id: string;
  planningCycleId: string | null;
  title: string;
  description: string | null;
  type: string;
  workType: string;
  timeframe: string;
  status: string;
  dueAt: string | null;
  priority: number;
  cognitiveLoad: number;
  estimatedMinutes: number | null;
  actualMinutes: number | null;
  canSplit: boolean;
  taskBreakdowns: {
    id: string;
    title: string;
    sequenceOrder: number;
    estimatedMinutes: number | null;
    cognitiveLoad: number;
    status: string;
  }[];
  scheduledBlocks: {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    status: string;
    taskBreakdownTitle: string | null;
  }[];
};

type TaskBreakdownResponse = {
  data?: {
    breakdowns: TaskViewModel["taskBreakdowns"];
    replacedExisting: boolean;
    targetBlockMinutes: number;
    message: string;
  };
  error?: string;
};

export type TaskFormState = {
  title: string;
  description: string;
  type: string;
  workType: string;
  timeframe: string;
  dueAt: string;
  priority: string;
  cognitiveLoad: string;
  estimatedMinutes: string;
  canSplit: boolean;
};

export const defaultFormState: TaskFormState = {
  title: "",
  description: "",
  type: "school",
  workType: "study",
  timeframe: "weekly",
  dueAt: "",
  priority: "3",
  cognitiveLoad: "4",
  estimatedMinutes: "45",
  canSplit: true,
};

function formatDate(date: string | null) {
  if (!date) return "No due date";

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

function formatBlockWindow(startTime: string, endTime: string) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const day = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(start);
  const startLabel = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(start);
  const endLabel = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(end);

  return `${day}, ${startLabel} - ${endLabel}`;
}

function formatForInput(date: string | null) {
  if (!date) return "";
  const parsed = new Date(date);
  const offset = parsed.getTimezoneOffset();
  const local = new Date(parsed.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function difficultyLabel(value: number) {
  if (value <= 2) return "Light";
  if (value <= 4) return "Moderate";
  if (value === 5) return "Hard";
  return "Deep work";
}

type Level = "high" | "medium" | "low";

function difficultyLevel(load: number | null): Level | null {
  if (load == null) return null;
  if (load <= 2) return "low";
  if (load <= 5) return "medium";
  return "high";
}

function priorityLevel(priority: number | null): Level | null {
  if (priority == null) return null;
  if (priority <= 2) return "high";
  if (priority === 3) return "medium";
  return "low";
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

const levelLabel: Record<Level, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

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

function formatTimeOnly(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })
    .format(new Date(date))
    .toLowerCase()
    .replace(/\s/g, "");
}

function ordinalSuffix(day: number) {
  if (day >= 11 && day <= 13) return "th";
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

function formatDueDate(date: string) {
  const d = new Date(date);
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(d);
  const month = new Intl.DateTimeFormat("en-US", { month: "long" }).format(d);
  const day = d.getDate();
  return `${weekday}, ${month} ${day}${ordinalSuffix(day)}, ${d.getFullYear()}`;
}

function formatDueDateButton(value: string) {
  if (!value) return "Set due date";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Set due date";
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" })
    .format(d)
    .toLowerCase()
    .replace(/\s/g, "");
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return `Today, ${time}`;
  if (sameDay(d, tomorrow)) return `Tomorrow, ${time}`;
  const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
  return `${date}, ${time}`;
}

function statusClass(status: string) {
  if (status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "scheduled") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "cancelled") return "border-zinc-200 bg-zinc-100 text-zinc-500";
  return "border-violet-200 bg-violet-50 text-violet-700";
}

function formStateFromTask(task: TaskViewModel): TaskFormState {
  return {
    title: task.title,
    description: task.description ?? "",
    type: task.type,
    workType: task.workType,
    timeframe: task.timeframe,
    dueAt: formatForInput(task.dueAt),
    priority: String(task.priority),
    cognitiveLoad: String(task.cognitiveLoad),
    estimatedMinutes: task.estimatedMinutes ? String(task.estimatedMinutes) : "",
    canSplit: task.canSplit,
  };
}

export function buildPayload(form: TaskFormState) {
  return {
    title: form.title.trim(),
    description: form.description.trim() || null,
    type: form.type,
    workType: form.workType,
    timeframe: form.timeframe,
    dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
    priority: Number(form.priority),
    cognitiveLoad: Number(form.cognitiveLoad),
    estimatedMinutes: form.estimatedMinutes ? Number(form.estimatedMinutes) : null,
    canSplit: form.canSplit,
    createdBy: "user",
  };
}

function TaskForm({
  form,
  setForm,
  onSubmit,
  onCancel,
  submitLabel,
  busy,
}: {
  form: TaskFormState;
  setForm: (form: TaskFormState) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
  busy: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium text-zinc-700 sm:col-span-2">
          Title
          <input
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-normal text-zinc-950 outline-none focus:border-violet-500"
            placeholder="Chem midterm study"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-zinc-700 sm:col-span-2">
          Description
          <textarea
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            className="min-h-20 rounded-md border border-zinc-300 px-3 py-2 text-sm font-normal text-zinc-950 outline-none focus:border-violet-500"
            placeholder="What needs to happen?"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-zinc-700">
          Due date
          <input
            type="datetime-local"
            value={form.dueAt}
            onChange={(event) => setForm({ ...form, dueAt: event.target.value })}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-normal text-zinc-950 outline-none focus:border-violet-500"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-zinc-700">
          Estimated minutes
          <input
            type="number"
            min="1"
            value={form.estimatedMinutes}
            onChange={(event) => setForm({ ...form, estimatedMinutes: event.target.value })}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-normal text-zinc-950 outline-none focus:border-violet-500"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-zinc-700">
          Priority
          <select
            value={form.priority}
            onChange={(event) => setForm({ ...form, priority: event.target.value })}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-normal text-zinc-950 outline-none focus:border-violet-500"
          >
            <option value="1">1 - highest</option>
            <option value="2">2 - high</option>
            <option value="3">3 - normal</option>
            <option value="4">4 - low</option>
            <option value="5">5 - lowest</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium text-zinc-700">
          Difficulty
          <select
            value={form.cognitiveLoad}
            onChange={(event) => setForm({ ...form, cognitiveLoad: event.target.value })}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-normal text-zinc-950 outline-none focus:border-violet-500"
          >
            {[1, 2, 3, 4, 5, 6, 7].map((value) => (
              <option key={value} value={value}>
                {value}/7
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium text-zinc-700">
          Type
          <select
            value={form.type}
            onChange={(event) => setForm({ ...form, type: event.target.value })}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-normal text-zinc-950 outline-none focus:border-violet-500"
          >
            <option value="school">school</option>
            <option value="work">work</option>
            <option value="personal">personal</option>
            <option value="admin">admin</option>
            <option value="health">health</option>
            <option value="social">social</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium text-zinc-700">
          Work type
          <select
            value={form.workType}
            onChange={(event) => setForm({ ...form, workType: event.target.value })}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-normal text-zinc-950 outline-none focus:border-violet-500"
          >
            <option value="study">study</option>
            <option value="writing">writing</option>
            <option value="project">project</option>
            <option value="reading">reading</option>
            <option value="admin">admin</option>
            <option value="errand">errand</option>
            <option value="creative">creative</option>
            <option value="personal">personal</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium text-zinc-700">
          Timeframe
          <select
            value={form.timeframe}
            onChange={(event) => setForm({ ...form, timeframe: event.target.value })}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-normal text-zinc-950 outline-none focus:border-violet-500"
          >
            <option value="daily">daily</option>
            <option value="weekly">weekly</option>
            <option value="monthly">monthly</option>
            <option value="quarterly">quarterly</option>
            <option value="yearly">yearly</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
          <input
            type="checkbox"
            checked={form.canSplit}
            onChange={(event) => setForm({ ...form, canSplit: event.target.checked })}
            className="h-4 w-4 rounded border-zinc-300"
          />
          Can split into smaller blocks
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={busy}
          className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {busy ? "Saving..." : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 disabled:cursor-not-allowed disabled:text-zinc-400"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

const priorityToNumber: Record<Level, string> = { high: "1", medium: "3", low: "5" };
const numberToPriority = (value: string): Level => {
  const n = Number(value);
  if (n <= 2) return "high";
  if (n === 3) return "medium";
  return "low";
};
const difficultyToNumber: Record<Level, string> = { high: "6", medium: "4", low: "2" };
const numberToDifficulty = (value: string): Level => {
  const n = Number(value);
  if (n <= 2) return "low";
  if (n <= 5) return "medium";
  return "high";
};

function LevelDropdown({
  value,
  onChange,
  suffix,
}: {
  value: Level;
  onChange: (level: Level) => void;
  suffix: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 text-xs ${textColor[value]}`}
      >
        <span className={`h-2 w-2 rounded-full ${dotColor[value]}`} />
        {levelLabel[value]} {suffix}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-zinc-400">
          <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg bg-zinc-900 p-1 shadow-lg ring-1 ring-white/10"
          >
            {(["high", "medium", "low"] as Level[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => {
                  onChange(l);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded px-3 py-2 text-xs ${textColor[l]} hover:bg-white/5`}
              >
                <span className={`h-2 w-2 rounded-full ${dotColor[l]}`} />
                {levelLabel[l]} {suffix}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function buildDayOptions() {
  const items: { value: string; label: string }[] = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < 60; i++) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    const value = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    let label: string;
    if (i === 0) label = "Today";
    else if (i === 1) label = "Tomorrow";
    else
      label = new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(d);
    items.push({ value, label });
  }
  return items;
}

const HOUR12_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}));

const MINUTE_OPTIONS = ["00", "15", "30", "45"].map((m) => ({ value: m, label: m }));

const AMPM_OPTIONS = [
  { value: "AM", label: "AM" },
  { value: "PM", label: "PM" },
];

function roundMinuteToStep(minute: number) {
  const snapped = Math.round(minute / 15) * 15;
  return pad2(snapped >= 60 ? 0 : snapped);
}

function to24Hour(hour12: string, ampm: string) {
  const h = Number(hour12);
  if (ampm === "AM") return pad2(h === 12 ? 0 : h);
  return pad2(h === 12 ? 12 : h + 12);
}

function parseDateTimeLocal(value: string) {
  let day: string;
  let h24: number;
  let mins: number;
  if (value) {
    const [datePart, timePart = "00:00"] = value.split("T");
    const [hh, mm] = timePart.split(":");
    day = datePart;
    h24 = Number(hh) || 0;
    mins = Number(mm) || 0;
  } else {
    const now = new Date();
    day = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    h24 = now.getHours();
    mins = now.getMinutes();
  }
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return {
    day,
    hour12: String(h12),
    ampm,
    minute: roundMinuteToStep(mins),
  };
}

function WheelColumn({
  items,
  value,
  onChange,
}: {
  items: { value: string; label: string }[];
  value: string;
  onChange: (next: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ITEM_HEIGHT = 36;
  const SPACER = ITEM_HEIGHT * 2;

  useEffect(() => {
    const idx = items.findIndex((item) => item.value === value);
    if (idx >= 0 && ref.current) {
      ref.current.scrollTop = idx * ITEM_HEIGHT;
    }
  }, [value, items]);

  const handleScroll = () => {
    if (!ref.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!ref.current) return;
      const idx = Math.round(ref.current.scrollTop / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(items.length - 1, idx));
      const next = items[clamped]?.value;
      if (next && next !== value) onChange(next);
    }, 130);
  };

  return (
    <div
      ref={ref}
      onScroll={handleScroll}
      className="no-scrollbar h-[180px] flex-1 snap-y snap-mandatory overflow-y-scroll"
      style={{ scrollbarWidth: "none" }}
    >
      <div style={{ height: SPACER }} />
      {items.map((item) => (
        <div
          key={item.value}
          style={{ height: ITEM_HEIGHT }}
          className={`flex snap-center items-center justify-center text-sm transition-colors ${
            item.value === value ? "text-[#F5F5F5]" : "text-zinc-500"
          }`}
        >
          {item.label}
        </div>
      ))}
      <div style={{ height: SPACER }} />
    </div>
  );
}

function DateTimeWheel({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const dayItems = useMemo(() => buildDayOptions(), []);
  const { day, hour12, ampm, minute } = parseDateTimeLocal(value);

  const update = (next: { day?: string; hour12?: string; ampm?: string; minute?: string }) => {
    const d = next.day ?? day;
    const h12 = next.hour12 ?? hour12;
    const ap = next.ampm ?? ampm;
    const m = next.minute ?? minute;
    onChange(`${d}T${to24Hour(h12, ap)}:${m}`);
  };

  return (
    <div className="relative mt-3 rounded-2xl bg-black/40 px-2 py-2">
      <div className="pointer-events-none absolute inset-x-3 top-1/2 z-10 h-9 -translate-y-1/2 rounded-md border-y border-white/15" />
      <div className="relative flex">
        <WheelColumn items={dayItems} value={day} onChange={(d) => update({ day: d })} />
        <WheelColumn items={HOUR12_OPTIONS} value={hour12} onChange={(h) => update({ hour12: h })} />
        <WheelColumn items={MINUTE_OPTIONS} value={minute} onChange={(m) => update({ minute: m })} />
        <WheelColumn items={AMPM_OPTIONS} value={ampm} onChange={(a) => update({ ampm: a })} />
      </div>
    </div>
  );
}

export function CreateSheet({
  form,
  setForm,
  onSubmit,
  onCancel,
  onDelete,
  busy,
}: {
  form: TaskFormState;
  setForm: (form: TaskFormState) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  busy: boolean;
}) {
  const [eventOrTask, setEventOrTask] = useState<"event" | "task">("task");
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous === "hidden" ? "" : previous;
    };
  }, [onCancel]);

  const priorityValue = numberToPriority(form.priority);
  const difficultyValue = numberToDifficulty(form.cognitiveLoad);

  const dateLabel = form.dueAt ? formatDueDateButton(form.dueAt) : "Set due date";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onCancel}
        className="absolute inset-0 cursor-default bg-black/60"
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 320 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.5 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 120 || info.velocity.y > 600) onCancel();
        }}
        className="relative z-10 flex h-[75vh] w-full max-w-md flex-col rounded-t-3xl bg-[#1a1f1a] px-5 pt-3 pb-8 shadow-2xl"
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/30" />

        <div className="flex items-center gap-3 rounded-2xl bg-black/40 px-4 py-3">
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Title"
            className="flex-1 bg-transparent text-[#F5F5F5] outline-none placeholder:text-zinc-500"
          />
          <button
            type="button"
            className="flex shrink-0 items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-xs text-[#A0A0A0]"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z M19 11a7 7 0 0 1-14 0 M12 18v3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Speak
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-[#F5F5F5]">Date</span>
          <button
            type="button"
            onClick={() => {
              if (!form.dueAt) {
                const now = new Date();
                const initial = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(
                  now.getDate(),
                )}T${pad2(now.getHours())}:${roundMinuteToStep(now.getMinutes())}`;
                setForm({ ...form, dueAt: initial });
              }
              setShowDatePicker((v) => !v);
            }}
            className="text-sm text-[#F5F5F5]"
          >
            {dateLabel}
          </button>
        </div>
        {showDatePicker && (
          <DateTimeWheel
            value={form.dueAt}
            onChange={(next) => setForm({ ...form, dueAt: next })}
          />
        )}

        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-[#F5F5F5]">Type</span>
          <div className="inline-flex gap-2">
            {(["event", "task"] as const).map((option) => {
              const active = eventOrTask === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setEventOrTask(option)}
                  className={`rounded-full px-4 py-1.5 text-xs capitalize transition-colors ${
                    active
                      ? "border border-cyan-400 text-cyan-400"
                      : "border border-white/10 text-[#A0A0A0]"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-[#F5F5F5]">Priority Level</span>
          <LevelDropdown
            value={priorityValue}
            onChange={(l) => setForm({ ...form, priority: priorityToNumber[l] })}
            suffix="Priority"
          />
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-[#F5F5F5]">Difficulty Level</span>
          <LevelDropdown
            value={difficultyValue}
            onChange={(l) => setForm({ ...form, cognitiveLoad: difficultyToNumber[l] })}
            suffix="Difficulty"
          />
        </div>

        <button
          type="button"
          onClick={onSubmit}
          disabled={busy || !form.title.trim()}
          className="mt-auto w-full rounded-full border border-white/20 px-4 py-3 text-sm text-[#F5F5F5] disabled:opacity-50"
        >
          {busy ? "Saving..." : "Confirm"}
        </button>
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="mt-2 w-full rounded-full border border-red-500/40 px-4 py-3 text-sm text-red-500 disabled:opacity-50"
          >
            {busy ? "Deleting..." : "Delete"}
          </button>
        ) : (
          <button
            type="button"
            onClick={onCancel}
            className="mt-2 w-full rounded-full border border-red-500/40 px-4 py-3 text-sm text-red-500"
          >
            Cancel
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}

export function TasksClient({ initialTasks }: { initialTasks: TaskViewModel[] }) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [isCreating, setIsCreating] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultFormState);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [swipedTaskId, setSwipedTaskId] = useState<string | null>(null);
  const [breakdownBusyTaskId, setBreakdownBusyTaskId] = useState<string | null>(null);
  const [breakdownMessageByTaskId, setBreakdownMessageByTaskId] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const activeTasks = useMemo(() => tasks.filter((task) => task.status !== "cancelled"), [tasks]);
  const completedCount = useMemo(() => tasks.filter((task) => task.status === "completed").length, [tasks]);
  const totalEstimatedMinutes = useMemo(
    () => activeTasks.reduce((total, task) => total + (task.estimatedMinutes ?? 0), 0),
    [activeTasks],
  );

  function openCreateForm() {
    setError(null);
    setEditingTaskId(null);
    setForm(defaultFormState);
    setIsCreating(true);
  }

  function openEditForm(task: TaskViewModel) {
    setError(null);
    setIsCreating(false);
    setEditingTaskId(task.id);
    setForm(formStateFromTask(task));
  }

  function closeForm() {
    setIsCreating(false);
    setEditingTaskId(null);
    setForm(defaultFormState);
    setError(null);
  }

  async function submitCreate() {
    setError(null);
    const payload = buildPayload(form);
    if (!payload.title) {
      setError("Title is required.");
      return;
    }

    setBusyTaskId("new");
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Failed to create task.");
      setTasks((current) => [body.data, ...current]);
      closeForm();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to create task.");
    } finally {
      setBusyTaskId(null);
    }
  }

  async function submitEdit(taskId: string) {
    setError(null);
    const payload = buildPayload(form);
    if (!payload.title) {
      setError("Title is required.");
      return;
    }

    setBusyTaskId(taskId);
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Failed to update task.");
      setTasks((current) => current.map((task) => (task.id === taskId ? body.data : task)));
      closeForm();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to update task.");
    } finally {
      setBusyTaskId(null);
    }
  }

  async function deleteTask(taskId: string): Promise<boolean> {
    setError(null);
    const task = tasks.find((candidate) => candidate.id === taskId);
    if (!task || !window.confirm(`Delete "${task.title}"?`)) {
      return false;
    }

    setBusyTaskId(taskId);
    try {
      const response = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Failed to delete task.");
      setTasks((current) => current.filter((candidate) => candidate.id !== taskId));
      router.refresh();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to delete task.");
      return false;
    } finally {
      setBusyTaskId(null);
    }
  }

  async function completeTask(taskId: string) {
    setError(null);
    setBusyTaskId(taskId);
    try {
      const response = await fetch(`/api/tasks/${taskId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Failed to complete task.");
      setTasks((current) => current.filter((candidate) => candidate.id !== taskId));
      setSwipedTaskId(null);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to complete task.");
    } finally {
      setBusyTaskId(null);
    }
  }

  async function generateBreakdown(taskId: string, replaceExisting: boolean) {
    setError(null);
    setBreakdownBusyTaskId(taskId);
    try {
      const response = await fetch(`/api/tasks/${taskId}/breakdown`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replaceExisting }),
      });
      const body = (await response.json()) as TaskBreakdownResponse;
      if (!response.ok || !body.data) {
        throw new Error(body.error ?? "Failed to break down task.");
      }

      setTasks((current) =>
        current.map((task) =>
          task.id === taskId
            ? {
                ...task,
                taskBreakdowns: body.data?.breakdowns ?? task.taskBreakdowns,
                scheduledBlocks: task.scheduledBlocks.map((block, index) => {
                  const breakdown = body.data?.breakdowns[index];
                  return breakdown
                    ? {
                        ...block,
                        title: breakdown.title,
                        taskBreakdownTitle: breakdown.title,
                      }
                    : block;
                }),
              }
            : task,
        ),
      );
      setBreakdownMessageByTaskId((current) => ({
        ...current,
        [taskId]: body.data?.message ?? "Breakdown updated.",
      }));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to break down task.");
    } finally {
      setBreakdownBusyTaskId(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex items-center justify-between p-5 shadow-sm">
        <h1 className="">your to-dos</h1>
        <div
          className="inline-flex items-center rounded-full px-1 py-0.5 backdrop-blur-md"
          style={{
            backgroundColor: "rgba(110, 110, 110, 0.20)",
            boxShadow:
              "inset 0 0 0 1px rgba(0, 0, 0, 0.6), inset 1px 1px 0px 0px rgba(185, 185, 185), inset -1px -1px 0px 0px rgb(185, 185, 185)",
          }}
        >
          <button
            type="button"
            aria-label="Filters"
            className="inline-flex items-center justify-center rounded-full p-2 text-[#D9D9D9] transition-colors duration-300 ease-out hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6.00002 9.84375V3.75C6.00002 3.55109 5.92101 3.36032 5.78035 3.21967C5.6397 3.07902 5.44894 3 5.25002 3C5.05111 3 4.86035 3.07902 4.71969 3.21967C4.57904 3.36032 4.50002 3.55109 4.50002 3.75V9.84375C3.85471 10.009 3.28274 10.3843 2.87429 10.9105C2.46584 11.4367 2.24414 12.0839 2.24414 12.75C2.24414 13.4161 2.46584 14.0633 2.87429 14.5895C3.28274 15.1157 3.85471 15.491 4.50002 15.6562V20.25C4.50002 20.4489 4.57904 20.6397 4.71969 20.7803C4.86035 20.921 5.05111 21 5.25002 21C5.44894 21 5.6397 20.921 5.78035 20.7803C5.92101 20.6397 6.00002 20.4489 6.00002 20.25V15.6562C6.64533 15.491 7.2173 15.1157 7.62575 14.5895C8.0342 14.0633 8.25591 13.4161 8.25591 12.75C8.25591 12.0839 8.0342 11.4367 7.62575 10.9105C7.2173 10.3843 6.64533 10.009 6.00002 9.84375ZM5.25002 14.25C4.95335 14.25 4.66334 14.162 4.41667 13.9972C4.16999 13.8324 3.97774 13.5981 3.8642 13.324C3.75067 13.0499 3.72097 12.7483 3.77885 12.4574C3.83672 12.1664 3.97958 11.8991 4.18936 11.6893C4.39914 11.4796 4.66642 11.3367 4.95739 11.2788C5.24836 11.2209 5.54996 11.2506 5.82405 11.3642C6.09814 11.4777 6.33241 11.67 6.49723 11.9166C6.66205 12.1633 6.75002 12.4533 6.75002 12.75C6.75002 13.1478 6.59199 13.5294 6.31068 13.8107C6.02938 14.092 5.64785 14.25 5.25002 14.25ZM12.75 5.34375V3.75C12.75 3.55109 12.671 3.36032 12.5304 3.21967C12.3897 3.07902 12.1989 3 12 3C11.8011 3 11.6103 3.07902 11.4697 3.21967C11.329 3.36032 11.25 3.55109 11.25 3.75V5.34375C10.6047 5.50898 10.0327 5.88428 9.62429 6.41048C9.21584 6.93669 8.99414 7.58387 8.99414 8.25C8.99414 8.91613 9.21584 9.56331 9.62429 10.0895C10.0327 10.6157 10.6047 10.991 11.25 11.1562V20.25C11.25 20.4489 11.329 20.6397 11.4697 20.7803C11.6103 20.921 11.8011 21 12 21C12.1989 21 12.3897 20.921 12.5304 20.7803C12.671 20.6397 12.75 20.4489 12.75 20.25V11.1562C13.3953 10.991 13.9673 10.6157 14.3758 10.0895C14.7842 9.56331 15.0059 8.91613 15.0059 8.25C15.0059 7.58387 14.7842 6.93669 14.3758 6.41048C13.9673 5.88428 13.3953 5.50898 12.75 5.34375ZM12 9.75C11.7034 9.75 11.4133 9.66203 11.1667 9.4972C10.92 9.33238 10.7277 9.09811 10.6142 8.82403C10.5007 8.54994 10.471 8.24834 10.5288 7.95736C10.5867 7.66639 10.7296 7.39912 10.9394 7.18934C11.1491 6.97956 11.4164 6.8367 11.7074 6.77882C11.9984 6.72094 12.3 6.75065 12.574 6.86418C12.8481 6.97771 13.0824 7.16997 13.2472 7.41665C13.412 7.66332 13.5 7.95333 13.5 8.25C13.5 8.64782 13.342 9.02936 13.0607 9.31066C12.7794 9.59196 12.3978 9.75 12 9.75ZM21.75 15.75C21.7494 15.0849 21.5282 14.4388 21.121 13.9129C20.7139 13.387 20.1438 13.011 19.5 12.8438V3.75C19.5 3.55109 19.421 3.36032 19.2804 3.21967C19.1397 3.07902 18.9489 3 18.75 3C18.5511 3 18.3603 3.07902 18.2197 3.21967C18.079 3.36032 18 3.55109 18 3.75V12.8438C17.3547 13.009 16.7827 13.3843 16.3743 13.9105C15.9658 14.4367 15.7441 15.0839 15.7441 15.75C15.7441 16.4161 15.9658 17.0633 16.3743 17.5895C16.7827 18.1157 17.3547 18.491 18 18.6562V20.25C18 20.4489 18.079 20.6397 18.2197 20.7803C18.3603 20.921 18.5511 21 18.75 21C18.9489 21 19.1397 20.921 19.2804 20.7803C19.421 20.6397 19.5 20.4489 19.5 20.25V18.6562C20.1438 18.489 20.7139 18.113 21.121 17.5871C21.5282 17.0612 21.7494 16.4151 21.75 15.75ZM18.75 17.25C18.4534 17.25 18.1633 17.162 17.9167 16.9972C17.67 16.8324 17.4777 16.5981 17.3642 16.324C17.2507 16.0499 17.221 15.7483 17.2788 15.4574C17.3367 15.1664 17.4796 14.8991 17.6894 14.6893C17.8991 14.4796 18.1664 14.3367 18.4574 14.2788C18.7484 14.2209 19.05 14.2506 19.324 14.3642C19.5981 14.4777 19.8324 14.67 19.9972 14.9166C20.162 15.1633 20.25 15.4533 20.25 15.75C20.25 16.1478 20.092 16.5294 19.8107 16.8107C19.5294 17.092 19.1478 17.25 18.75 17.25Z" fill="#D9D9D9"/>
            </svg>
          </button>
          <button
            type="button"
            onClick={openCreateForm}
            aria-label="Create Task"
            className="inline-flex items-center justify-center rounded-full p-2 text-[#D9D9D9] transition-colors duration-300 ease-out hover:text-white"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
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
        </div>
      </header>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <AnimatePresence>
        {(isCreating || editingTaskId) && (
          <CreateSheet
            form={form}
            setForm={setForm}
            onSubmit={isCreating ? submitCreate : () => submitEdit(editingTaskId!)}
            onCancel={closeForm}
            onDelete={
              editingTaskId
                ? async () => {
                    if (await deleteTask(editingTaskId)) closeForm();
                  }
                : undefined
            }
            busy={busyTaskId === (isCreating ? "new" : editingTaskId)}
          />
        )}
      </AnimatePresence>

      <section className="grid gap-3">
        <AnimatePresence initial={false}>
        {tasks.map((task) => {
          const pLevel = priorityLevel(task.priority);
          const dLevel = difficultyLevel(task.cognitiveLoad);
          const isSwiped = swipedTaskId === task.id;
          const ACTION_WIDTH = 160;
          return (
            <motion.div
              key={task.id}
              layout
              exit={{ x: "-100%", opacity: 0 }}
              transition={{ type: "spring", damping: 32, stiffness: 320 }}
              className="relative overflow-hidden rounded-2xl"
            >
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center gap-3 pr-2">
                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSwipedTaskId(null);
                      openEditForm(task);
                    }}
                    className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-700/70 text-[#F5F5F5] backdrop-blur-md"
                    aria-label="Edit task"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                  </button>
                  <span className="text-[10px] text-[#A0A0A0]">Edit</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => completeTask(task.id)}
                    disabled={busyTaskId === task.id}
                    className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-700/70 text-[#F5F5F5] backdrop-blur-md disabled:opacity-50"
                    aria-label="Mark complete"
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
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </button>
                  <span className="text-[10px] text-[#A0A0A0]">Complete</span>
                </div>
              </div>
              <motion.button
                type="button"
                drag="x"
                dragConstraints={{ left: -ACTION_WIDTH, right: 0 }}
                dragElastic={0.08}
                animate={{ x: isSwiped ? -ACTION_WIDTH : 0 }}
                transition={{ type: "spring", damping: 35, stiffness: 400 }}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -50 || info.velocity.x < -300) {
                    setSwipedTaskId(task.id);
                  } else if (info.offset.x > 50 || info.velocity.x > 300) {
                    setSwipedTaskId(null);
                  } else {
                    setSwipedTaskId(isSwiped ? task.id : null);
                  }
                }}
                onClick={() => {
                  if (isSwiped) {
                    setSwipedTaskId(null);
                  } else {
                    openEditForm(task);
                  }
                }}
                className="relative block w-full touch-pan-y overflow-hidden rounded-2xl border border-[#3D95A9]/20 bg-[#101010] p-4 text-left transition-colors hover:bg-white/5"
              >
                <div
                  className="pointer-events-none absolute -right-16 -top-20 h-72 w-72"
                  style={{
                    borderRadius: "288.813px",
                    background:
                      "linear-gradient(199deg, rgba(61, 149, 169, 0.20) 32.23%, rgba(61, 149, 169, 0.00) 101.41%)",
                    filter: "blur(55px)",
                  }}
                />
                <div className="relative z-10 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#F5F5F5]">{task.title}</p>
                    {task.dueAt && (
                      <p className="caption mt-1 text-[14px] text-[#A0A0A0]">
                        {formatDueDate(task.dueAt)}
                      </p>
                    )}
                  </div>
                  {task.dueAt && (
                    <div className="caption shrink-0 text-[10px] text-[#A0A0A0]">
                      {formatTimeOnly(task.dueAt)}
                    </div>
                  )}
                </div>
                {(pLevel || dLevel) && (
                  <div className="relative z-10 mt-3 flex flex-wrap items-center gap-5">
                    <Indicator level={pLevel} suffix="Priority" />
                    <Indicator level={dLevel} suffix="Difficulty" />
                  </div>
                )}
              </motion.button>
            </motion.div>
          );
        })}
        </AnimatePresence>
      </section>
    </div>
  );
}
