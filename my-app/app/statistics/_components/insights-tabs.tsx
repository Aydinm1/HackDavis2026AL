"use client";

interface Insight {
  type: string;
  title: string;
  reason: string;
}

interface InsightsTabsProps {
  activeTab: "overview" | "suggestions";
  setActiveTab: (tab: "overview" | "suggestions") => void;
  insights: Insight[];
}

const insightIcons = {
  work_now: "⚡",
  schedule_task: "📋",
  move_block: "↔️",
  shorten_block: "⏱️",
  skip_or_defer: "⏸️",
  protect_break: "☕",
  recovery_window: "🌙",
  regenerate_schedule: "🔄",
};

export default function InsightsTabs({ activeTab, setActiveTab, insights }: InsightsTabsProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Tab buttons */}
      <div className="flex gap-4 border-b border-white/10">
        <button
          onClick={() => setActiveTab("overview")}
          className={`pb-2 px-1 text-sm font-light ${
            activeTab === "overview" ? "text-white border-b-2 border-white" : "text-white/40"
          }`}
        >
          Flow&apos;s overview
        </button>
        <button
          onClick={() => setActiveTab("suggestions")}
          className={`pb-2 px-1 text-sm font-light ${
            activeTab === "suggestions" ? "text-white border-b-2 border-white" : "text-white/40"
          }`}
        >
          Suggestions
        </button>
      </div>

      {/* Tab content */}
      <div className="flex flex-col gap-4">
        {activeTab === "overview" && (
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: "💨", label: "Flow's overview", desc: "You're in a good groove. Keep the momentum!" },
              { icon: "💡", label: "Suggestions", desc: "Consider taking a break soon if you can." },
              { icon: "📅", label: "Schedule", desc: "4 events scheduled today" },
              { icon: "🎯", label: "Focus time", desc: "5h of focused work available" },
            ].map((item, idx) => (
              <div
                key={idx}
                className="p-3 rounded bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
              >
                <div className="text-lg mb-1">{item.icon}</div>
                <div className="text-xs text-white/40">{item.label}</div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "suggestions" && (
          <div className="flex flex-col gap-3">
            {insights && insights.length > 0 ? (
              insights.map((insight, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg flex-shrink-0">
                      {insightIcons[insight.type as keyof typeof insightIcons] || "💡"}
                    </span>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-white">{insight.title}</div>
                      <div className="text-xs text-white/40 mt-1">{insight.reason}</div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-white/40 text-sm py-4">No suggestions at this time.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
