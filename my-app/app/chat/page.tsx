"use client";

import { useState, useRef, useEffect, useCallback } from "react";

function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Full screen preview"
        className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        onClick={onClose}
        className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 text-lg"
      >
        ×
      </button>
    </div>
  );
}

type ActionStatus = "proposed" | "executed" | "failed" | "cancelled";

type AiAction = {
  id: string;
  actionType:
    | "CREATE_TASK"
    | "CREATE_EVENT"
    | "UPDATE_TASK"
    | "UPDATE_EVENT"
    | "GENERATE_SCHEDULE"
    | "DAILY_CHECKIN"
    | "ADJUST_TODAY";
  status: ActionStatus;
  requiresConfirmation: boolean;
  inputPayload: Record<string, unknown>;
  resultPayload?: Record<string, unknown> | null;
  errorMessage?: string | null;
};

type PendingImage = {
  dataUrl: string;
  base64: string;
  mimeType: string;
};

type ChatEntry = {
  role: "user" | "assistant";
  content: string;
  actions?: AiAction[];
  imageDataUrl?: string;
  imageDataUrls?: string[];
  metadata?: Record<string, unknown> | null;
};

type ActionResult = {
  data?: AiAction;
  error?: string;
};

type Level = "high" | "medium" | "low";

function priorityLevel(priority: unknown): Level | null {
  if (typeof priority !== "number") return null;
  if (priority <= 2) return "high";
  if (priority === 3) return "medium";
  return "low";
}

function difficultyLevel(load: unknown): Level | null {
  if (typeof load !== "number") return null;
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

function formatTimeShort(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" })
    .format(d)
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

function formatLongDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(d);
  const month = new Intl.DateTimeFormat("en-US", { month: "long" }).format(d);
  const day = d.getDate();
  return `${weekday}, ${month} ${day}${ordinalSuffix(day)}, ${d.getFullYear()}`;
}

function formatDateTime(value: unknown) {
  if (typeof value !== "string") return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function actionTheme(actionType: AiAction["actionType"]) {
  if (actionType === "CREATE_EVENT" || actionType === "UPDATE_EVENT") {
    return { rgb: "183, 38, 193", border: "border-[#B726C1]/20" };
  }

  if (
    actionType === "DAILY_CHECKIN" ||
    actionType === "ADJUST_TODAY" ||
    actionType === "GENERATE_SCHEDULE"
  ) {
    return { rgb: "54, 181, 57", border: "border-[#36B539]/20" };
  }

  return { rgb: "61, 149, 169", border: "border-[#3D95A9]/20" };
}

function actionDisplayTitle(action: AiAction) {
  const p = action.inputPayload;
  if (typeof p.title === "string" && p.title.trim()) return p.title.trim();

  switch (action.actionType) {
    case "DAILY_CHECKIN":
      return "Today's check-in";
    case "ADJUST_TODAY":
      return "Daily plan adjustment";
    case "GENERATE_SCHEDULE":
      return p.dryRun === false ? "Save generated schedule" : "Preview schedule proposal";
    case "CREATE_EVENT":
      return "Calendar event";
    case "UPDATE_EVENT":
      return "Calendar update";
    case "UPDATE_TASK":
      return "Task update";
    case "CREATE_TASK":
      return "New task";
  }
}

function ScheduleProposalDetails({ payload }: { payload: Record<string, unknown> }) {
  const rawText = typeof payload.rawText === "string" && payload.rawText.trim() ? payload.rawText.trim() : null;
  const trigger = typeof payload.trigger === "string" ? payload.trigger : null;
  const dryRun = payload.dryRun !== false;
  const scheduleImpact =
    typeof payload.scheduleImpact === "object" && payload.scheduleImpact !== null && !Array.isArray(payload.scheduleImpact)
      ? payload.scheduleImpact as Record<string, unknown>
      : null;
  const impactTitle =
    typeof scheduleImpact?.title === "string" && scheduleImpact.title.trim() ? scheduleImpact.title.trim() : null;
  const impactReason =
    typeof scheduleImpact?.reason === "string" && scheduleImpact.reason.trim() ? scheduleImpact.reason.trim() : null;
  const priority = typeof scheduleImpact?.priority === "number" ? scheduleImpact.priority : null;
  const cognitiveLoad = typeof scheduleImpact?.cognitiveLoad === "number" ? scheduleImpact.cognitiveLoad : null;
  const estimatedMinutes = typeof scheduleImpact?.estimatedMinutes === "number" ? scheduleImpact.estimatedMinutes : null;
  const dueAt = typeof scheduleImpact?.dueAt === "string" ? formatDateTime(scheduleImpact.dueAt) : null;

  return (
    <div className="relative z-10 mt-4 flex flex-col gap-3">
      <p className="caption text-[13px] leading-relaxed text-[#A0A0A0]">
        {dryRun
          ? "This will generate a preview only. Nothing is added to your calendar until you approve the generated blocks."
          : "This will save the generated blocks into your schedule."}
      </p>

      <div className="flex flex-wrap gap-2">
        <span className="rounded-full border border-[#36B539]/35 bg-[#36B539]/10 px-3 py-1 text-xs text-[#C8F5CA]">
          {dryRun ? "Preview first" : "Will save blocks"}
        </span>
        {trigger && (
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-[#D9D9D9]">
            {trigger === "task_added" ? "After new task" : "From chat request"}
          </span>
        )}
      </div>

      {(impactTitle || rawText) && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="caption text-[12px] uppercase tracking-wide text-white/35">Planning around</p>
          <p className="caption mt-1 text-[13px] leading-relaxed text-[#D9D9D9]">{impactTitle ?? rawText}</p>
          {impactReason && <p className="caption mt-2 text-[12px] leading-relaxed text-[#A0A0A0]">{impactReason}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {priority !== null && (
              <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-white/70">
                Priority {priority}/5
              </span>
            )}
            {cognitiveLoad !== null && (
              <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-white/70">
                Difficulty {cognitiveLoad}/7
              </span>
            )}
            {estimatedMinutes !== null && (
              <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-white/70">
                {estimatedMinutes} min
              </span>
            )}
            {dueAt && (
              <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-white/70">
                Due {dueAt}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getRecordArray(value: unknown) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function ScheduleResultDetails({
  resultPayload,
  onConfirm,
  isPending,
}: {
  resultPayload: Record<string, unknown> | null | undefined;
  onConfirm: (actionId: string) => void;
  isPending: boolean;
}) {
  if (!resultPayload) return null;

  const blocks = getRecordArray(resultPayload.scheduledBlocks);
  const unscheduledTasks = getRecordArray(resultPayload.unscheduledTasks);
  const saveScheduleAction = isRecord(resultPayload.saveScheduleAction) ? resultPayload.saveScheduleAction : null;
  const saveActionId = typeof saveScheduleAction?.id === "string" ? saveScheduleAction.id : null;
  const saveActionStatus = typeof saveScheduleAction?.status === "string" ? saveScheduleAction.status : null;
  const dryRun = resultPayload.dryRun !== false;
  const hasBlocks = blocks.length > 0;

  return (
    <div className="relative z-10 mt-4 flex flex-col gap-3">
      <div className="rounded-xl border border-[#36B539]/25 bg-[#36B539]/8 p-3">
        <p className="text-sm font-medium text-[#F5F5F5]">
          {dryRun ? "Generated preview" : "Schedule saved"}
        </p>
        <p className="caption mt-1 text-[12px] leading-relaxed text-[#A0A0A0]">
          {hasBlocks
            ? `${blocks.length} block${blocks.length === 1 ? "" : "s"} proposed for your schedule.`
            : "No blocks were added to the preview. The scheduler could not find enough open time for the available task set."}
          {unscheduledTasks.length > 0
            ? ` ${unscheduledTasks.length} task${unscheduledTasks.length === 1 ? "" : "s"} could not fit.`
            : ""}
        </p>
      </div>

      {hasBlocks && (
        <div className="space-y-2">
          {blocks.slice(0, 5).map((block, index) => {
            const title = typeof block.title === "string" ? block.title : `Block ${index + 1}`;
            const start = typeof block.startTime === "string" ? formatDateTime(block.startTime) : "";
            const startShort = typeof block.startTime === "string" ? formatTimeShort(block.startTime) : null;
            const endShort = typeof block.endTime === "string" ? formatTimeShort(block.endTime) : null;

            return (
              <div key={`${title}-${index}`} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[#F5F5F5]">{title}</p>
                    {start && <p className="caption mt-1 text-[12px] text-[#A0A0A0]">{start}</p>}
                  </div>
                  {(startShort || endShort) && (
                    <span className="caption shrink-0 text-[10px] text-[#A0A0A0]">
                      {startShort}
                      {startShort && endShort ? " - " : null}
                      {endShort}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {blocks.length > 5 && (
            <p className="caption text-[12px] text-[#A0A0A0]">+ {blocks.length - 5} more blocks</p>
          )}
        </div>
      )}

      {!hasBlocks && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-xs uppercase tracking-wide text-white/35">What this means</p>
          <p className="caption mt-1 text-[12px] leading-relaxed text-[#A0A0A0]">
            Nothing has changed yet. Add more availability, reduce task duration, or move a fixed event, then generate again.
          </p>
        </div>
      )}

      {unscheduledTasks.length > 0 && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3">
          <p className="text-xs uppercase tracking-wide text-amber-200/70">Could not fit</p>
          <p className="caption mt-1 text-[12px] text-[#D9D9D9]">
            {unscheduledTasks
              .slice(0, 3)
              .map((task) => (typeof task.title === "string" ? task.title : "Untitled task"))
              .join(", ")}
          </p>
        </div>
      )}

      {hasBlocks && saveActionId && saveActionStatus === "proposed" && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="caption text-[12px] leading-relaxed text-[#A0A0A0]">
            Approve this preview to add these blocks to your schedule.
          </p>
          <button
            type="button"
            disabled={isPending}
            onClick={() => onConfirm(saveActionId)}
            className="shrink-0 rounded-full border border-white/30 px-3 py-1 text-xs text-[#F5F5F5] disabled:opacity-50"
          >
            {isPending ? "..." : "Save schedule"}
          </button>
        </div>
      )}
    </div>
  );
}

function CheckinDetails({ payload }: { payload: Record<string, unknown> }) {
  const energy = typeof payload.energyScore === "number" ? payload.energyScore : null;
  const stress = typeof payload.stressScore === "number" ? payload.stressScore : null;
  const capacity = typeof payload.availableCapacityMinutes === "number" ? payload.availableCapacityMinutes : null;
  const note = typeof payload.userNote === "string" && payload.userNote.trim() ? payload.userNote.trim() : null;

  return (
    <div className="relative z-10 mt-4 flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {energy !== null && (
          <span className="rounded-full border border-[#3D95A9]/35 bg-[#3D95A9]/10 px-3 py-1 text-xs text-[#BFEFF5]">
            Energy {energy}/7
          </span>
        )}
        {stress !== null && (
          <span className="rounded-full border border-[#B726C1]/35 bg-[#B726C1]/10 px-3 py-1 text-xs text-[#F0C5F4]">
            Stress {stress}/7
          </span>
        )}
        {capacity !== null && (
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-[#D9D9D9]">
            {capacity} min available
          </span>
        )}
      </div>
      {note && <p className="caption text-[13px] leading-relaxed text-[#A0A0A0]">{note}</p>}
    </div>
  );
}

function ActionCard({
  action,
  onConfirm,
  onCancel,
  isPending,
}: {
  action: AiAction;
  onConfirm: (actionId: string) => void;
  onCancel: (actionId: string) => void;
  isPending: boolean;
}) {
  const p = action.inputPayload;
  const title = actionDisplayTitle(action);
  const startRaw =
    typeof p.startTime === "string" ? p.startTime : typeof p.dueAt === "string" ? p.dueAt : null;
  const endRaw = typeof p.endTime === "string" ? p.endTime : null;
  const startLabel = startRaw ? formatTimeShort(startRaw) : null;
  const endLabel = endRaw ? formatTimeShort(endRaw) : null;
  const dateLabel = startRaw ? formatLongDate(startRaw) : null;
  const pLevel = priorityLevel(p.priority);
  const dLevel = difficultyLevel(p.cognitiveLoad);
  const canConfirm = action.status === "proposed" && !p.ambiguous;
  const canCancel = action.status === "proposed";
  const theme = actionTheme(action.actionType);

  return (
    <div className={`relative overflow-hidden rounded-2xl border ${theme.border} bg-[#101010] p-4`}>
      <div
        className="pointer-events-none absolute -right-16 -top-20 h-72 w-72"
        style={{
          borderRadius: "288.813px",
          background: `linear-gradient(199deg, rgba(${theme.rgb}, 0.20) 32.23%, rgba(${theme.rgb}, 0.00) 101.41%)`,
          filter: "blur(55px)",
        }}
      />
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-[#F5F5F5]">{title}</p>
          {dateLabel && (
            <p className="caption mt-1 text-[14px] text-[#A0A0A0]">{dateLabel}</p>
          )}
        </div>
        {(startLabel || endLabel) && (
          <div className="caption shrink-0 text-[10px] text-[#A0A0A0]">
            {startLabel}
            {startLabel && endLabel ? " - " : null}
            {endLabel}
          </div>
        )}
      </div>
      {(pLevel || dLevel) && (
        <div className="relative z-10 mt-3 flex flex-wrap items-center gap-5">
          <Indicator level={pLevel} suffix="Priority" />
          <Indicator level={dLevel} suffix="Difficulty" />
        </div>
      )}
      {action.actionType === "DAILY_CHECKIN" && <CheckinDetails payload={p} />}
      {action.actionType === "GENERATE_SCHEDULE" && <ScheduleProposalDetails payload={p} />}
      {action.actionType === "GENERATE_SCHEDULE" && action.status === "executed" && (
        <ScheduleResultDetails
          resultPayload={action.resultPayload}
          onConfirm={onConfirm}
          isPending={isPending}
        />
      )}
      {action.errorMessage && (
        <p className="relative z-10 mt-3 text-xs text-red-400">{action.errorMessage}</p>
      )}
      {(canConfirm || canCancel) && (
        <div className="relative z-10 mt-3 flex justify-end gap-2">
          {canCancel && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => onCancel(action.id)}
              className="rounded-full border border-white/15 px-3 py-1 text-xs text-[#A0A0A0] disabled:opacity-50"
            >
              Cancel
            </button>
          )}
          {canConfirm && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => onConfirm(action.id)}
              className="rounded-full border border-white/30 px-3 py-1 text-xs text-[#F5F5F5] disabled:opacity-50"
            >
              {isPending ? "..." : "Confirm"}
            </button>
          )}
        </div>
      )}
      {action.status === "executed" && (
        <p className="relative z-10 mt-4 text-[10px] uppercase tracking-wide text-emerald-500">
          {action.actionType === "DAILY_CHECKIN"
            ? "Check-in saved"
            : action.actionType === "GENERATE_SCHEDULE" && action.resultPayload?.dryRun !== false
              ? "Preview ready"
              : "Saved"}
        </p>
      )}
    </div>
  );
}

function InlineCheckinForm({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [energyScore, setEnergyScore] = useState(4);
  const [stressScore, setStressScore] = useState(4);
  const [note, setNote] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  function submitCheckin() {
    if (isSubmitted) return;
    const trimmedNote = note.trim();
    setIsSubmitted(true);
    onSubmit(`energy ${energyScore} stress ${stressScore}${trimmedNote ? ` note: ${trimmedNote}` : ""}`);
  }

  return (
    <div className="w-full max-w-sm rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-zinc-900 shadow-sm">
      <div className="space-y-4">
        <label className="grid gap-2 text-xs font-medium text-zinc-700">
          <span className="flex items-center justify-between gap-3">
            Energy
            <span className="rounded-full bg-white px-2 py-0.5 text-xs text-zinc-600">{energyScore}/7</span>
          </span>
          <input
            type="range"
            min="1"
            max="7"
            step="1"
            value={energyScore}
            disabled={isSubmitted}
            onChange={(event) => setEnergyScore(Number(event.target.value))}
            className="h-2 w-full accent-cyan-700"
          />
          <span className="flex justify-between text-[11px] font-normal text-zinc-500">
            <span>drained</span>
            <span>energized</span>
          </span>
        </label>

        <label className="grid gap-2 text-xs font-medium text-zinc-700">
          <span className="flex items-center justify-between gap-3">
            Stress
            <span className="rounded-full bg-white px-2 py-0.5 text-xs text-zinc-600">{stressScore}/7</span>
          </span>
          <input
            type="range"
            min="1"
            max="7"
            step="1"
            value={stressScore}
            disabled={isSubmitted}
            onChange={(event) => setStressScore(Number(event.target.value))}
            className="h-2 w-full accent-zinc-900"
          />
          <span className="flex justify-between text-[11px] font-normal text-zinc-500">
            <span>calm</span>
            <span>overloaded</span>
          </span>
        </label>

        <label className="grid gap-2 text-xs font-medium text-zinc-700">
          Notes
          <textarea
            value={note}
            disabled={isSubmitted}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            placeholder="Optional context for today's plan"
            className="resize-none rounded-md border border-cyan-100 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-cyan-400"
          />
        </label>

        <button
          type="button"
          onClick={submitCheckin}
          disabled={isSubmitted}
          className="w-full rounded-md bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:bg-zinc-400"
        >
          {isSubmitted ? "Check-in sent" : "Confirm check-in"}
        </button>
      </div>
    </div>
  );
}

function Message({
  entry,
  onConfirm,
  onCancel,
  onCheckinSubmit,
  pendingActionIds,
  onImageClick,
}: {
  entry: ChatEntry;
  onConfirm: (actionId: string) => void;
  onCancel: (actionId: string) => void;
  onCheckinSubmit: (text: string) => void;
  pendingActionIds: Set<string>;
  onImageClick: (src: string) => void;
}) {
  const isUser = entry.role === "user";
  const imageUrls = entry.imageDataUrls ?? (entry.imageDataUrl ? [entry.imageDataUrl] : []);
  const visibleActions = entry.actions?.filter((action) => action.inputPayload.missingBeforeSchedule !== true) ?? [];
  const showCheckinForm =
    !isUser &&
    (entry.metadata?.checkinPrompt === true ||
      entry.actions?.some(
        (action) => action.actionType === "DAILY_CHECKIN" && action.inputPayload.missingBeforeSchedule === true,
      ));
  return (
    <div className={`flex flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}>
      {imageUrls.length > 0 && (
        <div className={`flex flex-wrap gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
          {imageUrls.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={url}
              alt={`Uploaded image ${i + 1}`}
              className="h-40 max-w-[240px] cursor-zoom-in rounded-2xl border border-white/10 object-cover"
              onClick={() => onImageClick(url)}
            />
          ))}
        </div>
      )}
      {entry.content && (
        <div
          className={`max-w-[80%] select-text rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? "rounded-br-sm bg-zinc-700/60 text-[#F5F5F5]"
              : "rounded-bl-sm bg-transparent text-[#F5F5F5]"
          }`}
        >
          {entry.content}
        </div>
      )}

      {entry.actions && entry.actions.length > 0 && (
        <div className="w-full max-w-md space-y-2">
          {entry.actions.map((action) => (
            <ActionCard
              key={action.id}
              action={action}
              onConfirm={onConfirm}
              onCancel={onCancel}
              isPending={pendingActionIds.has(action.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type DbAiAction = {
  id: string;
  actionType: string;
  status: string;
  requiresConfirmation: boolean;
  inputPayload: unknown;
  resultPayload: unknown;
  errorMessage: string | null;
};

type DbMessage = {
  id: string;
  role: string;
  content: string;
  metadata: unknown;
  aiActions: DbAiAction[];
};

function dbMessageToChatEntry(msg: DbMessage): ChatEntry | null {
  if (msg.role !== "user" && msg.role !== "assistant") return null;
  const actions: AiAction[] = msg.aiActions.map((a) => ({
    id: a.id,
    actionType: a.actionType as AiAction["actionType"],
    status: a.status as ActionStatus,
    requiresConfirmation: a.requiresConfirmation,
    inputPayload: (typeof a.inputPayload === "object" &&
    a.inputPayload !== null &&
    !Array.isArray(a.inputPayload)
      ? a.inputPayload
      : {}) as Record<string, unknown>,
    resultPayload: (typeof a.resultPayload === "object" &&
    a.resultPayload !== null &&
    !Array.isArray(a.resultPayload)
      ? a.resultPayload
      : null) as Record<string, unknown> | null,
    errorMessage: a.errorMessage,
  }));
  return {
    role: msg.role as "user" | "assistant",
    content: msg.content,
    metadata: (typeof msg.metadata === "object" && msg.metadata !== null && !Array.isArray(msg.metadata)
      ? msg.metadata
      : null) as Record<string, unknown> | null,
    actions: actions.length > 0 ? actions : undefined,
  };
}

const TEXTAREA_MAX_HEIGHT = 160;

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  const [isRecording, setIsRecording] = useState(false);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [pendingActionIds, setPendingActionIds] = useState<Set<string>>(new Set());
  const [historyCursor, setHistoryCursor] = useState<number | null>(null);
  const [historyDraft, setHistoryDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > TEXTAREA_MAX_HEIGHT ? "auto" : "hidden";
  }, [input]);

  function focusTextareaEnd() {
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      const end = textarea.value.length;
      textarea.setSelectionRange(end, end);
    });
  }

  useEffect(() => {
    async function loadHistory() {
      try {
        const threadsRes = await fetch("/api/chat/threads");
        const threadsJson = (await threadsRes.json()) as { data?: { id: string }[] };
        const threads = threadsJson.data ?? [];
        if (threads.length === 0) return;

        const mostRecent = threads[0];
        const msgsRes = await fetch(`/api/chat/threads/${mostRecent.id}/messages`);
        const msgsJson = (await msgsRes.json()) as { data?: DbMessage[] };
        const dbMessages = msgsJson.data ?? [];

        const entries = dbMessages.flatMap((m) => {
          const entry = dbMessageToChatEntry(m);
          return entry ? [entry] : [];
        });

        setThreadId(mostRecent.id);
        setMessages(entries);
      } catch {
        /* fresh thread */
      } finally {
        setLoadingHistory(false);
      }
    }
    void loadHistory();
  }, []);

  type UploadResponseData = {
    transcript?: string;
    uploadedInput: { id: string };
    parsedItems: { assistantSummary?: string }[];
    proposedActions: AiAction[];
  };

  const handleUploadResult = useCallback((data: UploadResponseData) => {
    const summary =
      data.parsedItems.length > 0
        ? data.parsedItems
            .map((p) => p.assistantSummary)
            .filter(Boolean)
            .join(" ") || `Found ${data.parsedItems.length} action(s).`
        : "No actions detected.";

    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: summary, actions: data.proposedActions },
    ]);
  }, []);

  function replaceActionInMessages(action: AiAction) {
    setMessages((prev) =>
      prev.map((message) => {
        if (!message.actions?.some((existingAction) => {
          const nestedSaveAction = isRecord(existingAction.resultPayload?.saveScheduleAction)
            ? existingAction.resultPayload.saveScheduleAction
            : null;
          return existingAction.id === action.id || nestedSaveAction?.id === action.id;
        })) {
          return message;
        }
        return {
          ...message,
          actions: message.actions.map((existingAction) => {
            if (existingAction.id === action.id) return action;

            const nestedSaveAction = isRecord(existingAction.resultPayload?.saveScheduleAction)
              ? existingAction.resultPayload.saveScheduleAction
              : null;
            if (nestedSaveAction?.id !== action.id) return existingAction;

            return {
              ...existingAction,
              resultPayload: {
                ...(existingAction.resultPayload ?? {}),
                saveScheduleAction: action,
              },
            };
          }),
        };
      }),
    );
  }

  async function updateAction(actionId: string, operation: "confirm" | "cancel") {
    if (pendingActionIds.has(actionId)) return;
    setPendingActionIds((prev) => new Set(prev).add(actionId));
    try {
      const res = await fetch(`/api/ai-actions/${actionId}/${operation}`, {
        method: "POST",
      });
      const json = (await res.json()) as ActionResult;
      if (!res.ok || !json.data) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: json.error ?? `Could not ${operation} that action.`,
          },
        ]);
        return;
      }
      replaceActionInMessages(json.data);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Network error while trying to ${operation} that action.`,
        },
      ]);
    } finally {
      setPendingActionIds((prev) => {
        const next = new Set(prev);
        next.delete(actionId);
        return next;
      });
    }
  }

  function findLatestPendingActionId(operation: "confirm" | "cancel") {
    for (let i = messages.length - 1; i >= 0; i--) {
      const actions = messages[i].actions ?? [];
      for (let j = actions.length - 1; j >= 0; j--) {
        const action = actions[j];
        const nestedSaveAction = isRecord(action.resultPayload?.saveScheduleAction)
          ? action.resultPayload.saveScheduleAction
          : null;
        if (
          operation === "confirm" &&
          nestedSaveAction?.status === "proposed" &&
          typeof nestedSaveAction.id === "string"
        ) {
          return nestedSaveAction.id;
        }

        if (action.status === "proposed" && !action.inputPayload.ambiguous) {
          return action.id;
        }
      }
    }

    return null;
  }

  async function startRecording() {
    if (loading || isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          const base64 = dataUrl.split(",")[1];
          void sendVoice(base64, "audio/webm");
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Microphone access denied or unavailable." },
      ]);
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }

  async function sendVoice(audioData: string, mimeType: string) {
    setLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: "🎤 Transcribing…" }]);
    try {
      const res = await fetch("/api/uploads/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioData, mimeType }),
      });
      const json = (await res.json()) as { data?: UploadResponseData; error?: string };
      if (!res.ok || !json.data) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: json.error ?? "Voice upload failed." },
        ]);
        return;
      }
      const { transcript, ...rest } = json.data;
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "user") {
          updated[updated.length - 1] = {
            ...last,
            content: transcript ?? "🎤 Voice message",
          };
        }
        return updated;
      });
      handleUploadResult(rest);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Network error during voice upload." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function queueImageFile(file: File) {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      setPendingImages((prev) => [...prev, { dataUrl, base64, mimeType: file.type }]);
    };
    reader.readAsDataURL(file);
  }

  async function send(text: string) {
    const trimmed = text.trim();
    const imagesToSend = [...pendingImages];
    if ((!trimmed && imagesToSend.length === 0) || loading) return;

    const typedOperation = /^(confirm|approve|yes|save|looks good|do it)$/i.test(trimmed)
      ? "confirm"
      : /^(cancel|no|nevermind|never mind)$/i.test(trimmed)
        ? "cancel"
        : null;
    const typedActionId = typedOperation && imagesToSend.length === 0
      ? findLatestPendingActionId(typedOperation)
      : null;

    if (typedOperation && typedActionId) {
      setInput("");
      setHistoryCursor(null);
      setHistoryDraft("");
      setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
      await updateAction(typedActionId, typedOperation);
      textareaRef.current?.focus();
      return;
    }

    setInput("");
    setHistoryCursor(null);
    setHistoryDraft("");
    setPendingImages([]);
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: trimmed,
        imageDataUrls: imagesToSend.length > 0 ? imagesToSend.map((i) => i.dataUrl) : undefined,
      },
    ]);
    setLoading(true);

    try {
      if (imagesToSend.length > 0) {
        const res = await fetch("/api/uploads/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            images: imagesToSend.map((i) => ({ imageData: i.base64, mimeType: i.mimeType })),
            textMessage: trimmed || undefined,
          }),
        });
        const json = (await res.json()) as { data?: UploadResponseData; error?: string };
        if (!res.ok || !json.data) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: json.error ?? "Image upload failed." },
          ]);
          return;
        }
        handleUploadResult(json.data);
      } else if (trimmed) {
        const res = await fetch("/api/chat/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: trimmed, threadId }),
        });
        const json = (await res.json()) as {
          data?: {
            thread: { id: string };
            assistantMessage: { content: string };
            actions: AiAction[];
          };
          error?: string;
        };
        if (!res.ok || !json.data) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: json.error ?? "Something went wrong." },
          ]);
          return;
        }
        const { thread, assistantMessage, actions } = json.data;
        setThreadId(thread.id);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: assistantMessage.content, actions },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Network error — is the dev server running?" },
      ]);
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }

  function handleInputChange(value: string) {
    setInput(value);
    setHistoryCursor(null);
    setHistoryDraft("");
  }

  function getUserPromptHistory() {
    return messages
      .filter((message) => message.role === "user" && message.content.trim().length > 0)
      .map((message) => message.content);
  }

  function recallPromptHistory(direction: "older" | "newer") {
    const history = getUserPromptHistory();
    if (history.length === 0) return false;

    if (direction === "older") {
      const nextCursor = historyCursor === null ? history.length - 1 : Math.max(0, historyCursor - 1);
      if (historyCursor === null) {
        setHistoryDraft(input);
      }
      setHistoryCursor(nextCursor);
      setInput(history[nextCursor]);
      focusTextareaEnd();
      return true;
    }

    if (historyCursor === null) return false;

    const nextCursor = historyCursor + 1;
    if (nextCursor >= history.length) {
      setHistoryCursor(null);
      setInput(historyDraft);
      setHistoryDraft("");
      focusTextareaEnd();
      return true;
    }

    setHistoryCursor(nextCursor);
    setInput(history[nextCursor]);
    focusTextareaEnd();
    return true;
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
      return;
    }

    if (e.key === "ArrowUp" && !e.shiftKey && !e.metaKey && !e.altKey && !e.ctrlKey) {
      const atStart = e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0;
      if ((input.length === 0 || atStart || historyCursor !== null) && recallPromptHistory("older")) {
        e.preventDefault();
      }
      return;
    }

    if (e.key === "ArrowDown" && !e.shiftKey && !e.metaKey && !e.altKey && !e.ctrlKey && historyCursor !== null) {
      if (recallPromptHistory("newer")) {
        e.preventDefault();
      }
    }
  }

  const hasContent = input.trim().length > 0 || pendingImages.length > 0;
  const showEmptyState = messages.length === 0 && !loadingHistory;

  return (
    <main className="min-h-screen bg-[#101010] px-5 pb-[180px] pt-8 font-sans text-[#F5F5F5]">
      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

      {showEmptyState ? (
        <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 text-center">
          <div className="h-32 w-32 rounded-2xl bg-zinc-700/40" />
          <p
            className="italic"
            style={{
              fontFamily: '"Cormorant Garamond"',
              fontSize: "28px",
              fontWeight: 400,
              lineHeight: "normal",
            }}
          >
            Got any thoughts for today?
          </p>
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-2xl select-text flex-col gap-4">
          {loadingHistory && (
            <p className="py-6 text-center text-sm text-[#A0A0A0]">Loading conversation…</p>
          )}
          {messages.map((entry, i) => (
            <Message
              key={i}
              entry={entry}
              onConfirm={(actionId) => void updateAction(actionId, "confirm")}
              onCancel={(actionId) => void updateAction(actionId, "cancel")}
              onCheckinSubmit={(text) => void send(text)}
              pendingActionIds={pendingActionIds}
              onImageClick={setLightboxSrc}
            />
          ))}
          {loading && (
            <div className="flex items-start">
              <p className="text-sm italic text-[#A0A0A0]">Thinking…</p>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          files.forEach(queueImageFile);
          e.target.value = "";
        }}
      />

      {/* Input pill — fixed above navbar */}
      <div className="fixed inset-x-0 bottom-[88px] z-30 px-5">
        <div className="mx-auto max-w-2xl">
          {pendingImages.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {pendingImages.map((img, i) => (
                <div key={i} className="group relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.dataUrl}
                    alt={`Image ${i + 1}`}
                    className="h-16 w-16 cursor-zoom-in rounded-xl border border-white/10 object-cover"
                    onClick={() => setLightboxSrc(img.dataUrl)}
                  />
                  <button
                    type="button"
                    onClick={() => setPendingImages((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <div
            className="flex items-end gap-2 rounded-3xl px-3 py-2 backdrop-blur-md"
            style={{
              backgroundColor: "rgba(110, 110, 110, 0.20)",
              boxShadow:
                "inset 0 0 0 1px rgba(0, 0, 0, 0.6), inset 1px 1px 0px 0px rgba(185, 185, 185), inset -1px -1px 0px 0px rgb(185, 185, 185)",
            }}
          >
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={loading || isRecording}
              aria-label="Upload image"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#A0A0A0] transition-colors hover:text-[#F5F5F5] disabled:opacity-40"
            >
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="1" y="3" width="14" height="10" rx="1.5" />
                <circle cx="5.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                <path d="M1 11l3.5-3.5 2.5 2.5 2-2 4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKey}
              placeholder="How are you feeling today?"
              rows={1}
              disabled={loading || isRecording}
              className="flex-1 resize-none bg-transparent px-1 py-2 text-sm text-[#F5F5F5] placeholder:text-[#A0A0A0] outline-none disabled:opacity-50"
              style={{ lineHeight: "1.5", maxHeight: TEXTAREA_MAX_HEIGHT }}
            />
            {hasContent ? (
              <button
                type="button"
                onClick={() => void send(input)}
                disabled={loading || isRecording}
                aria-label="Send"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5] text-[#101010] transition-opacity disabled:opacity-50"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5" />
                  <path d="M5 12l7-7 7 7" />
                </svg>
              </button>
            ) : (
              <button
                type="button"
                onClick={isRecording ? stopRecording : () => void startRecording()}
                disabled={loading && !isRecording}
                aria-label={isRecording ? "Stop recording" : "Speak"}
                className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs transition-colors ${
                  isRecording
                    ? "bg-red-500 text-white"
                    : "bg-white/10 text-[#F5F5F5] hover:bg-white/15"
                }`}
              >
                {isRecording ? (
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <rect x="3" y="3" width="10" height="10" rx="1.5" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="2" width="6" height="12" rx="3" />
                    <path d="M5 11a7 7 0 0 0 14 0" />
                    <line x1="12" y1="18" x2="12" y2="22" />
                  </svg>
                )}
                {isRecording ? "Stop" : "Speak"}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
