import { getCurrentUserId } from "@/lib/auth";
import { listTasks } from "@/lib/services/tasks";
import { TasksClient, type TaskViewModel } from "./tasks-client";

export const dynamic = "force-dynamic";

export default async function ToDoList() {
  const tasks = await listTasks(getCurrentUserId());
  const taskViewModels = tasks.map(
    (task): TaskViewModel => ({
      id: task.id,
      planningCycleId: task.planningCycleId,
      title: task.title,
      description: task.description,
      type: task.type,
      workType: task.workType,
      timeframe: task.timeframe,
      status: task.status,
      dueAt: task.dueAt?.toISOString() ?? null,
      priority: task.priority,
      cognitiveLoad: task.cognitiveLoad,
      estimatedMinutes: task.estimatedMinutes,
      actualMinutes: task.actualMinutes,
      canSplit: task.canSplit,
      taskBreakdowns: task.taskBreakdowns.map((step) => ({
        id: step.id,
        title: step.title,
        sequenceOrder: step.sequenceOrder,
        estimatedMinutes: step.estimatedMinutes,
        cognitiveLoad: step.cognitiveLoad,
        status: step.status,
      })),
      scheduledBlocks: task.scheduledBlocks.map((block) => ({
        id: block.id,
        title: block.title,
        startTime: block.startTime.toISOString(),
        endTime: block.endTime.toISOString(),
        status: block.status,
        taskBreakdownTitle: block.taskBreakdown?.title ?? null,
      })),
    }),
  );

  return (
    <main className="min-h-screen bg-[#101010] px-5 py-8 pb-28 font-sans text-zinc-950">
      <TasksClient initialTasks={taskViewModels} />
    </main>
  );
}
