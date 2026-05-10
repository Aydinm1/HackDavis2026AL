export type TodayBlockViewModel = {
  id: string;
  title: string;
  subtitle: string;
  startTime: string;
  endTime: string;
  status: string;
  schedulingReason: string | null;
  priority: number | null;
  cognitiveLoad: number | null;
  dueAt: string | null;
};

function formatTime(date: string) {
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

type Level = "high" | "medium" | "low";

// priority: 1-5 (1 = highest)
function priorityLevel(priority: number | null): Level | null {
  if (priority == null) return null;
  if (priority <= 2) return "high";
  if (priority === 3) return "medium";
  return "low";
}

// cognitiveLoad: 1-7 (1 = easiest)
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

export function TodayBlocksClient({ initialBlocks }: { initialBlocks: TodayBlockViewModel[] }) {
  return (
    <div className="mt-3 grid gap-3">
      {initialBlocks.length > 0 ? (
        initialBlocks.map((block) => {
          const pLevel = priorityLevel(block.priority);
          const dLevel = difficultyLevel(block.cognitiveLoad);
          return (
            <div key={block.id} className="rounded-2xl border border-white/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[#F5F5F5]">{block.title}</p>
                  {block.dueAt && (
                    <p className="caption mt-1 text-[14px] text-[#A0A0A0]">{formatDueDate(block.dueAt)}</p>
                  )}
                </div>
                <div className="caption shrink-0 text-[10px] text-[#A0A0A0]">
                  {formatTime(block.startTime)} - {formatTime(block.endTime)}
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
        })
      ) : (
        <p className="text-sm text-[#A0A0A0]">No scheduled work blocks for this date.</p>
      )}
    </div>
  );
}
