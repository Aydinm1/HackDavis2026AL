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
  const title = typeof p.title === "string" ? p.title : "(untitled)";
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

  return (
    <div className="rounded-2xl border border-white/5 bg-[#101010] p-4">
      <div className="flex items-start justify-between gap-3">
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
        <div className="mt-3 flex flex-wrap items-center gap-5">
          <Indicator level={pLevel} suffix="Priority" />
          <Indicator level={dLevel} suffix="Difficulty" />
        </div>
      )}
      {action.errorMessage && (
        <p className="mt-3 text-xs text-red-400">{action.errorMessage}</p>
      )}
      {(canConfirm || canCancel) && (
        <div className="mt-3 flex justify-end gap-2">
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
        <p className="mt-2 text-[10px] uppercase tracking-wide text-emerald-500">Saved</p>
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
          className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
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
        if (!message.actions?.some((existingAction) => existingAction.id === action.id)) {
          return message;
        }
        return {
          ...message,
          actions: message.actions.map((existingAction) =>
            existingAction.id === action.id ? action : existingAction,
          ),
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

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
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
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          {loadingHistory && (
            <p className="py-6 text-center text-sm text-[#A0A0A0]">Loading conversation…</p>
          )}
          {messages.map((entry, i) => (
            <Message
              key={i}
              entry={entry}
              onConfirm={(actionId) => void updateAction(actionId, "confirm")}
              onCancel={(actionId) => void updateAction(actionId, "cancel")}
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
              onChange={(e) => setInput(e.target.value)}
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
                  <path d="M5 12h14" />
                  <path d="M13 5l7 7-7 7" />
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
