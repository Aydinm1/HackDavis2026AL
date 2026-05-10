"use client";

interface TaskDay {
  date: string;
  completed: number;
  total: number;
}

interface TaskCompletionChartProps {
  weeklyTasks: TaskDay[];
}

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export default function TaskCompletionChart({ weeklyTasks }: TaskCompletionChartProps) {
  const maxTasks = Math.max(...weeklyTasks.map((d) => d.total), 1);

  return (
    <div className="flex flex-col gap-4">
      {/* Legend */}
      <div className="flex gap-4 text-xs text-white/40">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-600" />
          <span>tasks</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-teal-600" />
          <span>events</span>
        </div>
      </div>

      {/* Chart */}
      <div className="flex items-end gap-3 h-32 px-2">
        {weeklyTasks.map((day) => {
          const dayOfWeek = new Date(day.date).getDay();

          return (
            <div key={day.date} className="flex flex-col items-center gap-2 flex-1">
              {/* Bar stack */}
              <div className="flex flex-col w-full h-24 bg-white/5 rounded relative overflow-hidden">
                {/* Tasks (blue) */}
                <div
                  className="w-full bg-blue-600 transition-all"
                  style={{ height: `${(day.completed / maxTasks) * 100}%` }}
                />
                {/* Events (teal) */}
                <div
                  className="w-full bg-teal-600 transition-all"
                  style={{ height: `${((day.total - day.completed) / maxTasks) * 100}%` }}
                />
              </div>
              {/* Label */}
              <span className="text-xs text-white/40">{DAYS[dayOfWeek]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
