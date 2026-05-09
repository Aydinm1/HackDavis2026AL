"use client";

import { useState, useRef, useEffect } from "react";

type ActionStatus = "proposed" | "executed" | "failed" | "cancelled";

type AiAction = {
  id: string;
  actionType: "CREATE_TASK" | "CREATE_EVENT" | "UPDATE_TASK" | "GENERATE_SCHEDULE";
  status: ActionStatus;
  requiresConfirmation: boolean;
  inputPayload: Record<string, unknown>;
  resultPayload?: Record<string, unknown> | null;
  errorMessage?: string | null;
};

type ChatEntry = {
  role: "user" | "assistant";
  content: string;
  actions?: AiAction[];
};

const ACTION_COLORS: Record<string, string> = {
  CREATE_TASK: "bg-violet-100 text-violet-800 border-violet-200",
  CREATE_EVENT: "bg-blue-100 text-blue-800 border-blue-200",
  UPDATE_TASK: "bg-amber-100 text-amber-800 border-amber-200",
  GENERATE_SCHEDULE: "bg-emerald-100 text-emerald-800 border-emerald-200",
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

function ActionCard({ action }: { action: AiAction }) {
  const p = action.inputPayload;
  const colorClass = ACTION_COLORS[action.actionType] ?? "bg-zinc-100 text-zinc-700 border-zinc-200";
  const statusClass = STATUS_COLORS[action.status] ?? "bg-zinc-100 text-zinc-500";

  return (
    <div className={`rounded-lg border p-3 space-y-2 ${colorClass}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold tracking-wide">{action.actionType}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusClass}`}>
          {action.status}
        </span>
      </div>

      <div className="space-y-1 bg-white/60 rounded p-2">
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
        <PayloadRow label="ambiguous" value={p.ambiguous} />
        {action.requiresConfirmation && (
          <div className="text-xs text-amber-600 font-medium pt-1">⚠ Requires confirmation</div>
        )}
        {action.errorMessage && (
          <div className="text-xs text-red-600 font-medium pt-1">✗ {action.errorMessage}</div>
        )}
        {action.status === "executed" && action.resultPayload && (
          <div className="text-xs text-green-700 font-medium pt-1">✓ Saved to DB</div>
        )}
      </div>
    </div>
  );
}

function Message({ entry }: { entry: ChatEntry }) {
  const isUser = entry.role === "user";
  return (
    <div className={`flex flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-violet-600 text-white rounded-br-sm"
            : "bg-zinc-100 text-zinc-800 rounded-bl-sm"
        }`}
      >
        {entry.content}
      </div>

      {entry.actions && entry.actions.length > 0 && (
        <div className="w-full max-w-sm space-y-2">
          {entry.actions.map((action) => (
            <ActionCard key={action.id} action={action} />
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

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed, threadId }),
      });

      const json = await res.json() as { data?: { thread: { id: string }; assistantMessage: { content: string }; actions: AiAction[] }; error?: string };

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

  return (
    <div className="flex h-screen flex-col bg-zinc-50 font-sans">
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
            onClick={() => { setThreadId(undefined); setMessages([]); }}
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
          </div>
        )}

        {messages.map((entry, i) => (
          <Message key={i} entry={entry} />
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

      {/* Input */}
      <div className="border-t border-zinc-200 bg-white px-4 py-3">
        <div className="flex items-end gap-2 max-w-3xl mx-auto">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Describe a task, event, or say 'plan my day'…"
            rows={1}
            disabled={loading}
            className="flex-1 resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-800 placeholder-zinc-400 outline-none focus:border-violet-400 focus:bg-white transition-colors disabled:opacity-50 min-h-[42px] max-h-32"
            style={{ lineHeight: "1.5" }}
          />
          <button
            onClick={() => void send(input)}
            disabled={loading || !input.trim()}
            className="shrink-0 h-[42px] w-[42px] rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-zinc-200 text-white disabled:text-zinc-400 flex items-center justify-center transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1.5 1.5l13 6.5-13 6.5V9.5l9-1.5-9-1.5V1.5z" />
            </svg>
          </button>
        </div>
        <p className="text-center text-xs text-zinc-300 mt-2">Enter to send · Shift+Enter for newline</p>
      </div>
    </div>
  );
}
