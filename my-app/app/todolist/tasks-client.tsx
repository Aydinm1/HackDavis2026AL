"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
    startTime: string;
    endTime: string;
    status: string;
  }[];
};

type TaskFormState = {
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

const defaultFormState: TaskFormState = {
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

function buildPayload(form: TaskFormState) {
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

export function TasksClient({ initialTasks }: { initialTasks: TaskViewModel[] }) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [isCreating, setIsCreating] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultFormState);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
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

  async function deleteTask(taskId: string) {
    setError(null);
    const task = tasks.find((candidate) => candidate.id === taskId);
    if (!task || !window.confirm(`Delete "${task.title}"? This marks it cancelled for the MVP.`)) {
      return;
    }

    setBusyTaskId(taskId);
    try {
      const response = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Failed to delete task.");
      setTasks((current) => current.map((candidate) => (candidate.id === taskId ? body.data : candidate)));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to delete task.");
    } finally {
      setBusyTaskId(null);
    }
  }

  async function completeTask(taskId: string) {
    setError(null);
    const task = tasks.find((candidate) => candidate.id === taskId);
    if (!task) return;

    const actualMinutesText = window.prompt(
      `Actual minutes for "${task.title}"? Leave blank to skip.`,
      task.estimatedMinutes ? String(task.estimatedMinutes) : "",
    );
    if (actualMinutesText === null) return;

    const trimmed = actualMinutesText.trim();
    const actualMinutes = trimmed ? Number(trimmed) : undefined;
    if (actualMinutes !== undefined && (!Number.isInteger(actualMinutes) || actualMinutes < 0)) {
      setError("Actual minutes must be a whole number.");
      return;
    }

    setBusyTaskId(taskId);
    try {
      const response = await fetch(`/api/tasks/${taskId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(actualMinutes === undefined ? {} : { actualMinutes }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Failed to complete task.");
      setTasks((current) => current.map((candidate) => (candidate.id === taskId ? body.data : candidate)));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to complete task.");
    } finally {
      setBusyTaskId(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Seeded demo data</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950">Tasks</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Current user tasks loaded from Prisma, including scheduling and breakdown context.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
              <div className="text-lg font-semibold">{activeTasks.length}</div>
              <div className="text-xs text-zinc-500">active</div>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
              <div className="text-lg font-semibold">{completedCount}</div>
              <div className="text-xs text-zinc-500">done</div>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
              <div className="text-lg font-semibold">{Math.round(totalEstimatedMinutes / 60)}h</div>
              <div className="text-xs text-zinc-500">estimated</div>
            </div>
          </div>
          <button
            type="button"
            onClick={openCreateForm}
            className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white"
          >
            Create Task
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {isCreating && (
        <TaskForm
          form={form}
          setForm={setForm}
          onSubmit={submitCreate}
          onCancel={closeForm}
          submitLabel="Create task"
          busy={busyTaskId === "new"}
        />
      )}

      <section className="grid gap-3">
        {tasks.map((task) => (
          <article key={task.id} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            {editingTaskId === task.id ? (
              <TaskForm
                form={form}
                setForm={setForm}
                onSubmit={() => submitEdit(task.id)}
                onCancel={closeForm}
                submitLabel="Save changes"
                busy={busyTaskId === task.id}
              />
            ) : (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-zinc-950">{task.title}</h2>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(task.status)}`}>
                        {task.status}
                      </span>
                    </div>
                    {task.description && <p className="mt-1 max-w-2xl text-sm text-zinc-600">{task.description}</p>}
                  </div>
                  <div className="text-left text-sm text-zinc-500 sm:text-right">
                    <div className="font-medium text-zinc-800">{formatDate(task.dueAt)}</div>
                    <div>{task.estimatedMinutes ?? 45} min estimated</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 text-sm sm:grid-cols-4">
                  <div className="rounded-md bg-zinc-50 px-3 py-2">
                    <div className="text-xs text-zinc-500">Priority</div>
                    <div className="font-medium">{task.priority}/5</div>
                  </div>
                  <div className="rounded-md bg-zinc-50 px-3 py-2">
                    <div className="text-xs text-zinc-500">Difficulty</div>
                    <div className="font-medium">
                      {difficultyLabel(task.cognitiveLoad)} - {task.cognitiveLoad}/7
                    </div>
                  </div>
                  <div className="rounded-md bg-zinc-50 px-3 py-2">
                    <div className="text-xs text-zinc-500">Work type</div>
                    <div className="font-medium">{task.workType}</div>
                  </div>
                  <div className="rounded-md bg-zinc-50 px-3 py-2">
                    <div className="text-xs text-zinc-500">Blocks</div>
                    <div className="font-medium">{task.scheduledBlocks.length}</div>
                  </div>
                </div>

                {task.scheduledBlocks.length > 0 && (
                  <div className="mt-4 border-t border-zinc-100 pt-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Scheduled blocks</h3>
                    <div className="mt-2 grid gap-2">
                      {task.scheduledBlocks.map((block) => (
                        <div
                          key={block.id}
                          className="flex flex-col gap-1 rounded-md bg-blue-50 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span className="font-medium text-zinc-800">{formatBlockWindow(block.startTime, block.endTime)}</span>
                          <span className="text-xs font-medium text-blue-700">{block.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => completeTask(task.id)}
                    disabled={busyTaskId === task.id || task.status === "completed" || task.status === "cancelled"}
                    className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-50 disabled:text-zinc-400"
                  >
                    {busyTaskId === task.id ? "Saving..." : "Complete"}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditForm(task)}
                    disabled={busyTaskId === task.id}
                    className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 disabled:cursor-not-allowed disabled:text-zinc-400"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteTask(task.id)}
                    disabled={busyTaskId === task.id || task.status === "cancelled"}
                    className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-50 disabled:text-zinc-400"
                  >
                    {busyTaskId === task.id ? "Deleting..." : "Delete"}
                  </button>
                </div>

                {task.taskBreakdowns.length > 0 && (
                  <div className="mt-4 border-t border-zinc-100 pt-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Breakdown</h3>
                    <ol className="mt-2 grid gap-2">
                      {task.taskBreakdowns.map((step) => (
                        <li
                          key={step.id}
                          className="flex items-center justify-between gap-3 rounded-md bg-zinc-50 px-3 py-2 text-sm"
                        >
                          <span>
                            {step.sequenceOrder}. {step.title}
                          </span>
                          <span className="shrink-0 text-xs text-zinc-500">{step.estimatedMinutes ?? 30} min</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
