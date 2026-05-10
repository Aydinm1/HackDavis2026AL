import { getCurrentUserId } from "@/lib/auth";
import { listTasks } from "@/lib/services/tasks";

export const dynamic = "force-dynamic";

function formatDate(date: Date | null) {
  if (!date) return "No due date";

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
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

export default async function ToDoList() {
  const tasks = await listTasks(getCurrentUserId());
  const activeTasks = tasks.filter((task) => task.status !== "cancelled");
  const completedCount = tasks.filter((task) => task.status === "completed").length;
  const totalEstimatedMinutes = activeTasks.reduce((total, task) => total + (task.estimatedMinutes ?? 0), 0);

  return (
    <main className="min-h-screen bg-zinc-50 px-5 py-8 pb-28 font-sans text-zinc-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Seeded demo data</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950">Tasks</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Current user tasks loaded from Prisma, including scheduling and breakdown context.
            </p>
          </div>
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
        </header>

        <section className="grid gap-3">
          {tasks.map((task) => (
            <article key={task.id} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
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
                    {difficultyLabel(task.cognitiveLoad)} · {task.cognitiveLoad}/7
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

              {task.taskBreakdowns.length > 0 && (
                <div className="mt-4 border-t border-zinc-100 pt-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Breakdown</h3>
                  <ol className="mt-2 grid gap-2">
                    {task.taskBreakdowns.map((step) => (
                      <li key={step.id} className="flex items-center justify-between gap-3 rounded-md bg-zinc-50 px-3 py-2 text-sm">
                        <span>{step.sequenceOrder}. {step.title}</span>
                        <span className="shrink-0 text-xs text-zinc-500">{step.estimatedMinutes ?? 30} min</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
