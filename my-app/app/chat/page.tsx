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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
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
        className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors text-lg"
      >
        ×
      </button>
    </div>
  );
}

type ActionStatus = "proposed" | "executed" | "failed" | "cancelled";

type AiAction = {
  id: string;
  actionType: "CREATE_TASK" | "CREATE_EVENT" | "UPDATE_TASK" | "GENERATE_SCHEDULE" | "DAILY_CHECKIN" | "ADJUST_TODAY";
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
};

type ActionResult = {
  data?: AiAction;
  error?: string;
};

const ACTION_COLORS: Record<string, string> = {
  CREATE_TASK: "bg-violet-100 text-violet-800 border-violet-200",
  CREATE_EVENT: "bg-blue-100 text-blue-800 border-blue-200",
  UPDATE_TASK: "bg-amber-100 text-amber-800 border-amber-200",
  GENERATE_SCHEDULE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  DAILY_CHECKIN: "bg-cyan-100 text-cyan-800 border-cyan-200",
  ADJUST_TODAY: "bg-teal-100 text-teal-800 border-teal-200",
};

const ACTION_LABELS: Record<string, string> = {
  CREATE_TASK: "Create task",
  CREATE_EVENT: "Create event",
  UPDATE_TASK: "Update task",
  GENERATE_SCHEDULE: "Generate schedule",
  DAILY_CHECKIN: "Daily check-in",
  ADJUST_TODAY: "Adjust today",
};

type AdjustmentAction = "keep" | "shorten" | "move" | "skip" | "replace_with_lower_load_task";

const ADJUSTMENT_BADGE_COLORS: Record<AdjustmentAction, string> = {
  keep: "bg-green-100 text-green-800 border-green-200",
  shorten: "bg-amber-100 text-amber-800 border-amber-200",
  move: "bg-blue-100 text-blue-800 border-blue-200",
  skip: "bg-red-100 text-red-800 border-red-200",
  replace_with_lower_load_task: "bg-violet-100 text-violet-800 border-violet-200",
};

const ADJUSTMENT_BADGE_LABELS: Record<AdjustmentAction, string> = {
  keep: "Keep",
  shorten: "Shorten",
  move: "Move",
  skip: "Skip",
  replace_with_lower_load_task: "Replace",
};

const STATUS_COLORS: Record<string, string> = {
  executed: "bg-green-100 text-green-700",
  proposed: "bg-yellow-100 text-yellow-700",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-zinc-100 text-zinc-500",
};

function PayloadRow({ label, value }: { label: string; value: unknown }) {
  if (value === undefined || value === null || value === "") return null;
  const display =
    typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
  return (
    <div className="flex gap-2 text-xs">
      <span className="shrink-0 font-medium text-zinc-500 w-28">{label}</span>
      <span className="text-zinc-800 font-mono break-all">{display}</span>
    </div>
  );
}

function extractFollowUpAction(action: AiAction) {
  const proposedScheduleAction = action.resultPayload?.proposedScheduleAction;
  if (
    typeof proposedScheduleAction === "object" &&
    proposedScheduleAction !== null &&
    !Array.isArray(proposedScheduleAction)
  ) {
    return proposedScheduleAction as AiAction;
  }

  return null;
}

function ActionCard({
  action,
  onConfirm,
  onCancel,
  isPending,
}: {
  action: AiAction;
  onConfirm: (actionId: string, inputPayload?: Record<string, unknown>) => void;
  onCancel: (actionId: string) => void;
  isPending: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftPayload, setDraftPayload] = useState(() => JSON.stringify(action.inputPayload, null, 2));
  const [draftError, setDraftError] = useState<string | null>(null);
  const p = action.inputPayload;
  const colorClass = ACTION_COLORS[action.actionType] ?? "bg-zinc-100 text-zinc-700 border-zinc-200";
  const actionLabel = ACTION_LABELS[action.actionType] ?? action.actionType;
  const statusClass = STATUS_COLORS[action.status] ?? "bg-zinc-100 text-zinc-500";
  const canConfirm = action.status === "proposed";
  const canCancel = action.status === "proposed";
  const followUpAction = extractFollowUpAction(action);

  function parseDraftPayload() {
    try {
      const parsed: unknown = JSON.parse(draftPayload);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        setDraftError("Payload must be a JSON object.");
        return null;
      }

      setDraftError(null);
      return parsed as Record<string, unknown>;
    } catch {
      setDraftError("Payload must be valid JSON.");
      return null;
    }
  }

  function confirmWithDraft() {
    if (!isEditing) {
      onConfirm(action.id);
      return;
    }

    const parsed = parseDraftPayload();
    if (!parsed) return;
    onConfirm(action.id, parsed);
  }

  return (
    <div className={`rounded-lg border p-3 space-y-2 ${colorClass}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold tracking-wide">{actionLabel}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusClass}`}>
          {action.status}
        </span>
      </div>

      <div className="space-y-1 bg-white/60 rounded p-2">
        {action.actionType === "ADJUST_TODAY" && action.status === "executed" && action.resultPayload ? (
          <div className="space-y-2">
            {typeof action.resultPayload.summary === "string" && (
              <p className="text-xs text-zinc-600">{action.resultPayload.summary}</p>
            )}
            {Array.isArray(action.resultPayload.suggestedAdjustments) &&
              (action.resultPayload.suggestedAdjustments as Record<string, unknown>[]).map((adj, i) => {
                const adjAction = adj.action as AdjustmentAction;
                const badgeClass = ADJUSTMENT_BADGE_COLORS[adjAction] ?? "bg-zinc-100 text-zinc-700 border-zinc-200";
                const label = ADJUSTMENT_BADGE_LABELS[adjAction] ?? String(adj.action);
                return (
                  <div key={String(adj.scheduledBlockId ?? i)} className="rounded-md border border-zinc-200 bg-white p-2">
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-xs font-medium text-zinc-900">{String(adj.title ?? "")}</span>
                      <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-xs font-semibold ${badgeClass}`}>
                        {label}
                      </span>
                    </div>
                    {typeof adj.reason === "string" && (
                      <p className="mt-0.5 text-xs text-zinc-500">{adj.reason}</p>
                    )}
                    {adjAction === "shorten" && typeof adj.suggestedDurationMinutes === "number" && (
                      <p className="mt-0.5 text-xs text-amber-700">
                        {adj.suggestedDurationMinutes} min suggested (currently {String(adj.currentDurationMinutes)} min)
                      </p>
                    )}
                    {adjAction === "replace_with_lower_load_task" &&
                      typeof adj.replacementTask === "object" &&
                      adj.replacementTask !== null && (
                        <p className="mt-0.5 text-xs text-violet-700">
                          Replace with: {String((adj.replacementTask as Record<string, unknown>).title ?? "")}
                        </p>
                      )}
                  </div>
                );
              })}
          </div>
        ) : isEditing ? (
          <div className="space-y-2">
            <textarea
              value={draftPayload}
              onChange={(event) => {
                setDraftPayload(event.target.value);
                setDraftError(null);
              }}
              rows={10}
              className="w-full resize-y rounded-md border border-white/80 bg-white p-2 font-mono text-xs text-zinc-800 outline-none focus:border-zinc-400"
            />
            {draftError && <div className="text-xs font-medium text-red-600">{draftError}</div>}
          </div>
        ) : (
          <>
            <PayloadRow label="title" value={p.title} />
            <PayloadRow label="dueAt" value={p.dueAt} />
            <PayloadRow label="startTime" value={p.startTime} />
            <PayloadRow label="endTime" value={p.endTime} />
            <PayloadRow label="priority" value={p.priority} />
            <PayloadRow label="cognitiveLoad" value={p.cognitiveLoad} />
            <PayloadRow label="type" value={p.type} />
            <PayloadRow label="workType" value={p.workType} />
            <PayloadRow label="timeframe" value={p.timeframe} />
            <PayloadRow label="description" value={p.description} />
            <PayloadRow label="operation" value={p.operation} />
            <PayloadRow label="isAllDay" value={p.isAllDay} />
            <PayloadRow label="estimatedMinutes" value={p.estimatedMinutes} />
            <PayloadRow label="energyScore" value={p.energyScore} />
            <PayloadRow label="stressScore" value={p.stressScore} />
            <PayloadRow label="capacity" value={p.availableCapacityMinutes} />
            <PayloadRow label="checkinDate" value={p.checkinDate} />
            <PayloadRow label="trigger" value={p.trigger} />
            <PayloadRow label="ambiguous" value={p.ambiguous} />
          </>
        )}
        {action.requiresConfirmation && (
          <div className="text-xs text-amber-600 font-medium pt-1">⚠ Requires confirmation</div>
        )}
        {action.errorMessage && (
          <div className="text-xs text-red-600 font-medium pt-1">✗ {action.errorMessage}</div>
        )}
        {action.status === "executed" && action.resultPayload && (
          <div className="text-xs text-green-700 font-medium pt-1">✓ Saved to DB</div>
        )}
        {followUpAction && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">
            Schedule impact detected. A revised schedule proposal action is ready below.
          </div>
        )}
      </div>

      {(canConfirm || canCancel) && (
        <div className="flex justify-end gap-2">
          {canConfirm && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setIsEditing((current) => !current);
                setDraftPayload(JSON.stringify(action.inputPayload, null, 2));
                setDraftError(null);
              }}
              className="rounded-md border border-white/70 bg-white/70 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-white disabled:opacity-50"
            >
              {isEditing ? "Close edit" : "Edit"}
            </button>
          )}
          {canCancel && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => onCancel(action.id)}
              className="rounded-md border border-white/70 bg-white/70 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-white disabled:opacity-50"
            >
              Cancel
            </button>
          )}
          {canConfirm && (
            <button
              type="button"
              disabled={isPending}
              onClick={confirmWithDraft}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {isPending ? "Working..." : "Confirm"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Message({
  entry,
  onConfirm,
  onCancel,
  pendingActionIds,
  onImageClick,
}: {
  entry: ChatEntry;
  onConfirm: (actionId: string, inputPayload?: Record<string, unknown>) => void;
  onCancel: (actionId: string) => void;
  pendingActionIds: Set<string>;
  onImageClick: (src: string) => void;
}) {
  const isUser = entry.role === "user";
  const imageUrls = entry.imageDataUrls ?? (entry.imageDataUrl ? [entry.imageDataUrl] : []);
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
              className="h-40 max-w-[240px] rounded-2xl rounded-br-sm border border-zinc-200 object-cover cursor-zoom-in"
              onClick={() => onImageClick(url)}
            />
          ))}
        </div>
      )}
      {entry.content && (
        <div
          className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? "bg-violet-600 text-white rounded-br-sm"
              : "bg-zinc-100 text-zinc-800 rounded-bl-sm"
          }`}
        >
          {entry.content}
        </div>
      )}

      {entry.actions && entry.actions.length > 0 && (
        <div className="w-full max-w-sm space-y-2">
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

const EXAMPLE_PROMPTS = [
  "I need to study for my bio exam before Friday, it'll probably take 3 hours",
  "Add dentist appointment on 2026-05-15 at 10am",
  "Complete my chemistry lab report",
  "Plan my day",
  "What's the weather like?",
];

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
  aiActions: DbAiAction[];
};

function dbMessageToChatEntry(msg: DbMessage): ChatEntry | null {
  if (msg.role !== "user" && msg.role !== "assistant") return null;
  const actions: AiAction[] = msg.aiActions.map((a) => ({
    id: a.id,
    actionType: a.actionType as AiAction["actionType"],
    status: a.status as ActionStatus,
    requiresConfirmation: a.requiresConfirmation,
    inputPayload: (typeof a.inputPayload === "object" && a.inputPayload !== null && !Array.isArray(a.inputPayload)
      ? a.inputPayload
      : {}) as Record<string, unknown>,
    resultPayload: (typeof a.resultPayload === "object" && a.resultPayload !== null && !Array.isArray(a.resultPayload)
      ? a.resultPayload
      : null) as Record<string, unknown> | null,
    errorMessage: a.errorMessage,
  }));
  return {
    role: msg.role as "user" | "assistant",
    content: msg.content,
    actions: actions.length > 0 ? actions : undefined,
  };
}

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
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const historyIndexRef = useRef<number>(-1);
  const savedInputRef = useRef<string>("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load most recent thread on mount
  useEffect(() => {
    async function loadHistory() {
      try {
        const threadsRes = await fetch("/api/chat/threads");
        const threadsJson = await threadsRes.json() as { data?: { id: string }[] };
        const threads = threadsJson.data ?? [];
        if (threads.length === 0) return;

        const mostRecent = threads[0];
        const msgsRes = await fetch(`/api/chat/threads/${mostRecent.id}/messages`);
        const msgsJson = await msgsRes.json() as { data?: DbMessage[] };
        const dbMessages = msgsJson.data ?? [];

        const entries = dbMessages.flatMap((m) => {
          const entry = dbMessageToChatEntry(m);
          return entry ? [entry] : [];
        });

        setThreadId(mostRecent.id);
        setMessages(entries);
      } catch {
        // silently ignore — user just starts a fresh thread
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
        ? data.parsedItems.map((p) => p.assistantSummary).filter(Boolean).join(" ") ||
          `Found ${data.parsedItems.length} action(s).`
        : "No actions detected.";

    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: summary, actions: data.proposedActions },
    ]);
  }, []);

  function replaceActionInMessages(action: AiAction) {
    const followUpAction = extractFollowUpAction(action);

    setMessages((prev) =>
      prev.map((message) => {
        if (!message.actions?.some((existingAction) => existingAction.id === action.id)) {
          return message;
        }

        const nextActions = message.actions.map((existingAction) =>
          existingAction.id === action.id ? action : existingAction,
        );

        if (followUpAction && !nextActions.some((existingAction) => existingAction.id === followUpAction.id)) {
          nextActions.push(followUpAction);
        }

        return {
          ...message,
          actions: nextActions,
        };
      }),
    );
  }

  async function updateAction(
    actionId: string,
    operation: "confirm" | "cancel",
    inputPayload?: Record<string, unknown>,
  ) {
    if (pendingActionIds.has(actionId)) return;

    setPendingActionIds((prev) => new Set(prev).add(actionId));

    try {
      const res = await fetch(`/api/ai-actions/${actionId}/${operation}`, {
        method: "POST",
        headers: inputPayload ? { "Content-Type": "application/json" } : undefined,
        body: inputPayload ? JSON.stringify({ inputPayload }) : undefined,
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
      const json = await res.json() as { data?: UploadResponseData; error?: string };
      if (!res.ok || !json.data) {
        setMessages((prev) => [...prev, { role: "assistant", content: json.error ?? "Voice upload failed." }]);
        return;
      }
      const { transcript, ...rest } = json.data;
      // Replace the placeholder with the real transcript
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
      setMessages((prev) => [...prev, { role: "assistant", content: "Network error during voice upload." }]);
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

    setInput("");
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
        // Images (+ optional text) go together as one multimodal Gemini call
        const res = await fetch("/api/uploads/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            images: imagesToSend.map((i) => ({ imageData: i.base64, mimeType: i.mimeType })),
            textMessage: trimmed || undefined,
          }),
        });
        const json = await res.json() as { data?: UploadResponseData; error?: string };
        if (!res.ok || !json.data) {
          setMessages((prev) => [...prev, { role: "assistant", content: json.error ?? "Image upload failed." }]);
          return;
        }
        handleUploadResult(json.data);
      } else if (trimmed) {
        // Text-only goes to the chat endpoint
        const res = await fetch("/api/chat/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: trimmed, threadId }),
        });
        const json = await res.json() as { data?: { thread: { id: string }; assistantMessage: { content: string }; actions: AiAction[] }; error?: string };
        if (!res.ok || !json.data) {
          setMessages((prev) => [...prev, { role: "assistant", content: json.error ?? "Something went wrong." }]);
          return;
        }
        const { thread, assistantMessage, actions } = json.data;
        setThreadId(thread.id);
        setMessages((prev) => {
          const existingIds = new Set(prev.flatMap((m) => m.actions?.map((a) => a.id) ?? []));
          const existingUpdates = actions.filter((a) => existingIds.has(a.id));
          const brandNewActions = actions.filter((a) => !existingIds.has(a.id));

          const updated = existingUpdates.length > 0
            ? prev.map((msg) => ({
                ...msg,
                actions: msg.actions?.map((ea) => existingUpdates.find((u) => u.id === ea.id) ?? ea),
              }))
            : prev;

          return [
            ...updated,
            {
              role: "assistant" as const,
              content: assistantMessage.content,
              actions: brandNewActions.length > 0 ? brandNewActions : undefined,
            },
          ];
        });
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

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      historyIndexRef.current = -1;
      void send(input);
      return;
    }

    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const ta = textareaRef.current;
      if (!ta) return;

      const sentMessages = messages.filter((m) => m.role === "user" && m.content).map((m) => m.content);
      if (sentMessages.length === 0) return;

      // Only hijack up arrow when cursor is on the first line
      if (e.key === "ArrowUp") {
        const atTop = ta.selectionStart === 0 || !ta.value.includes("\n");
        if (!atTop) return;

        e.preventDefault();
        if (historyIndexRef.current === -1) savedInputRef.current = input;
        const nextIndex = Math.min(historyIndexRef.current + 1, sentMessages.length - 1);
        historyIndexRef.current = nextIndex;
        setInput(sentMessages[sentMessages.length - 1 - nextIndex]);
      } else {
        // ArrowDown — only active while browsing history
        if (historyIndexRef.current === -1) return;
        const atBottom = ta.selectionStart === ta.value.length || !ta.value.includes("\n");
        if (!atBottom) return;

        e.preventDefault();
        const nextIndex = historyIndexRef.current - 1;
        if (nextIndex < 0) {
          historyIndexRef.current = -1;
          setInput(savedInputRef.current);
        } else {
          historyIndexRef.current = nextIndex;
          setInput(sentMessages[sentMessages.length - 1 - nextIndex]);
        }
      }
    }
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-50 font-sans">
      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-white text-sm font-bold">
          AI
        </div>
        <div>
          <p className="font-semibold text-zinc-900 text-sm">Gemini Chat Parser — Test Page</p>
          <p className="text-xs text-zinc-400">
            {threadId ? `Thread: ${threadId.slice(0, 8)}…` : "New thread"}
          </p>
        </div>
        {threadId && (
          <button
            onClick={() => { setThreadId(undefined); setMessages([]); setLoadingHistory(false); }}
            className="ml-auto text-xs text-zinc-400 hover:text-zinc-700 px-3 py-1 rounded-md border border-zinc-200 hover:border-zinc-300 transition-colors"
          >
            New thread
          </button>
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            {loadingHistory ? (
              <p className="text-zinc-300 text-sm">Loading conversation…</p>
            ) : (
              <>
                <div>
                  <p className="text-zinc-400 text-sm mb-1">Try describing a task or event in plain English.</p>
                  <p className="text-zinc-300 text-xs">Parsed AI actions will appear below each response.</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                  {EXAMPLE_PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => void send(p)}
                      className="text-xs bg-white border border-zinc-200 hover:border-violet-300 hover:text-violet-700 text-zinc-600 px-3 py-1.5 rounded-full transition-colors"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {messages.map((entry, i) => (
          <Message
            key={i}
            entry={entry}
            onConfirm={(actionId, inputPayload) => void updateAction(actionId, "confirm", inputPayload)}
            onCancel={(actionId) => void updateAction(actionId, "cancel")}
            pendingActionIds={pendingActionIds}
            onImageClick={setLightboxSrc}
          />
        ))}

        {loading && (
          <div className="flex items-start gap-2">
            <div className="bg-zinc-100 rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-zinc-400">
              <span className="inline-flex gap-1">
                <span className="animate-bounce" style={{ animationDelay: "0ms" }}>·</span>
                <span className="animate-bounce" style={{ animationDelay: "150ms" }}>·</span>
                <span className="animate-bounce" style={{ animationDelay: "300ms" }}>·</span>
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Hidden file input for image uploads */}
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

      {/* Input */}
      <div className="border-t border-zinc-200 bg-white px-4 pt-3 pb-3">
        {/* Pending image previews */}
        {pendingImages.length > 0 && (
          <div className="flex flex-wrap gap-2 max-w-3xl mx-auto mb-2">
            {pendingImages.map((img, i) => (
              <div key={i} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.dataUrl}
                  alt={`Image ${i + 1}`}
                  className="h-16 w-16 rounded-xl object-cover border border-zinc-200 cursor-zoom-in"
                  onClick={() => setLightboxSrc(img.dataUrl)}
                />
                <button
                  type="button"
                  onClick={() => setPendingImages((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2 max-w-3xl mx-auto">
          {/* Image button */}
          <button
            onClick={() => imageInputRef.current?.click()}
            disabled={loading || isRecording}
            title="Upload image"
            className="shrink-0 h-[42px] w-[42px] rounded-xl border border-zinc-200 hover:border-violet-300 disabled:opacity-40 text-zinc-500 hover:text-violet-600 flex items-center justify-center transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1" y="3" width="14" height="10" rx="1.5" />
              <circle cx="5.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
              <path d="M1 11l3.5-3.5 2.5 2.5 2-2 4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Mic button */}
          <button
            onClick={isRecording ? stopRecording : () => void startRecording()}
            disabled={loading && !isRecording}
            title={isRecording ? "Stop recording" : "Record voice"}
            className={`shrink-0 h-[42px] w-[42px] rounded-xl border flex items-center justify-center transition-colors ${
              isRecording
                ? "bg-red-500 border-red-500 text-white hover:bg-red-600"
                : "border-zinc-200 hover:border-violet-300 text-zinc-500 hover:text-violet-600 disabled:opacity-40"
            }`}
          >
            {isRecording ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="3" y="3" width="10" height="10" rx="1.5" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="5.5" y="1" width="5" height="8" rx="2.5" />
                <path d="M2 8a6 6 0 0012 0" strokeLinecap="round" />
                <line x1="8" y1="14" x2="8" y2="11" strokeLinecap="round" />
              </svg>
            )}
          </button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Describe a task, event, or say 'plan my day'…"
            rows={1}
            disabled={loading || isRecording}
            className="flex-1 resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-800 placeholder-zinc-400 outline-none focus:border-violet-400 focus:bg-white transition-colors disabled:opacity-50 min-h-[42px] max-h-32"
            style={{ lineHeight: "1.5" }}
          />
          <button
            onClick={() => void send(input)}
            disabled={loading || isRecording || (!input.trim() && pendingImages.length === 0)}
            className="shrink-0 h-[42px] w-[42px] rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-zinc-200 text-white disabled:text-zinc-400 flex items-center justify-center transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1.5 1.5l13 6.5-13 6.5V9.5l9-1.5-9-1.5V1.5z" />
            </svg>
          </button>
        </div>
        <p className="text-center text-xs text-zinc-300 mt-2">
          {isRecording ? "Recording… click stop when done" : "Enter to send · Shift+Enter for newline"}
        </p>
      </div>
    </div>
  );
}
