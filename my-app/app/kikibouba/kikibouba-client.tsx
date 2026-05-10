"use client";

import { type CSSProperties, useState } from "react";

export type KikiboubaInitialState = {
  energyScore: number;
  stressScore: number;
  loggedAt: string | null;
};

type ShapeDefinition = {
  label: string;
  className: string;
  assetUrl?: string;
};

const stressShapes: Record<number, ShapeDefinition> = {
  1: { label: "stress shape 1", className: "", assetUrl: "/kikibouba/shapes/stress-1.svg" },
  2: { label: "stress shape 2", className: "", assetUrl: "/kikibouba/shapes/stress-2.svg" },
  3: { label: "stress shape 3", className: "", assetUrl: "/kikibouba/shapes/stress-3.svg" },
  4: { label: "stress shape 4", className: "", assetUrl: "/kikibouba/shapes/stress-4.svg" },
  5: { label: "stress shape 5", className: "", assetUrl: "/kikibouba/shapes/stress-5.svg" },
  6: {
    label: "stress shape 6",
    className: "",
    assetUrl: "/kikibouba/shapes/stress-6.svg",
  },
  7: {
    label: "stress shape 7",
    className: "",
    assetUrl: "/kikibouba/shapes/stress-7.svg",
  },
};

const energyGradients: Record<number, string> = {
  1: "linear-gradient(62deg, #F1A19D 28.5%, #D25A54 64.28%, #921D17 117.91%)",
  2: "linear-gradient(45deg, #E4B886 8.9%, #F69221 53.82%, #A86416 85.88%)",
  3: "linear-gradient(110deg, #EADA98 5.97%, #F0D14F 47.45%, #CCA608 88.94%)",
  4: "linear-gradient(231deg, #ADE09B 21.19%, #6BC94A 67.47%, #348717 113.75%)",
  5: "linear-gradient(153deg, #87C9CA 29.99%, #45C5C7 57.12%, #069699 82.95%)",
  6: "linear-gradient(180deg, #AAB6D8 0%, #748EDA 50%, #405592 100%)",
  7: "linear-gradient(180deg, #D7A5DD 0%, #CA65D6 50%, #9F1AAF 100%)",
};

function scoreLabel(type: "energy" | "stress", score: number) {
  if (type === "energy") {
    if (score <= 2) return "low energy";
    if (score >= 6) return "high energy";
    return "steady energy";
  }

  if (score <= 2) return "low stress";
  if (score >= 6) return "high stress";
  return "moderate stress";
}

function formatSavedAt(value: string | null) {
  if (!value) return "Not logged yet";

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function shapeMaskStyle(shape: ShapeDefinition): CSSProperties {
  if (!shape.assetUrl) {
    return {};
  }

  return {
    maskImage: `url("${shape.assetUrl}")`,
    WebkitMaskImage: `url("${shape.assetUrl}")`,
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
    maskPosition: "center",
    WebkitMaskPosition: "center",
    maskSize: "contain",
    WebkitMaskSize: "contain",
  };
}

function activeShapeStyle(shape: ShapeDefinition, gradient: string): CSSProperties {
  return {
    ...shapeMaskStyle(shape),
    background: gradient,
  };
}

export function KikiboubaClient({ initialState }: { initialState: KikiboubaInitialState }) {
  const [energyScore, setEnergyScore] = useState(initialState.energyScore);
  const [stressScore, setStressScore] = useState(initialState.stressScore);
  const [motionKey, setMotionKey] = useState(0);
  const [savedAt, setSavedAt] = useState(initialState.loggedAt);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeShape = stressShapes[stressScore];
  const activeGradient = energyGradients[energyScore];

  function handleEnergyChange(value: number) {
    setEnergyScore(value);
    setMotionKey((current) => current + 1);
  }

  function handleStressChange(value: number) {
    setStressScore(value);
    setMotionKey((current) => current + 1);
  }

  async function saveCheckin() {
    setIsSaving(true);
    setError(null);
    setMessage(null);
    const loggedAt = new Date();

    try {
      const response = await fetch("/api/checkins/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loggedAt: loggedAt.toISOString(),
          energyScore,
          stressScore,
          adjustToday: true,
          source: "manual",
          userNote: "Kikibouba test page check-in.",
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Failed to save check-in.");

      const nextSavedAt = body.data?.checkinLog?.loggedAt ?? loggedAt.toISOString();
      setSavedAt(nextSavedAt);
      setMessage("Saved stress and energy to the database.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to save check-in.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f5f0] px-5 py-8 pb-28 font-sans text-zinc-950">
      <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="flex flex-col gap-5">
          <header>
            <p className="caption uppercase tracking-normal text-zinc-500">Test page</p>
            <h1 className="mt-2 text-zinc-950">Kikibouba</h1>
          </header>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-zinc-950">Stress and energy</h2>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600">
                Last saved: {formatSavedAt(savedAt)}
              </span>
            </div>

            <div className="mt-5 grid gap-5">
              <label className="grid gap-2 text-sm font-medium text-zinc-700">
                <span className="flex items-center justify-between gap-3">
                  Energy
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                    {energyScore}/7
                  </span>
                </span>
                <input
                  type="range"
                  min="1"
                  max="7"
                  step="1"
                  value={energyScore}
                  onChange={(event) => handleEnergyChange(Number(event.target.value))}
                  className="h-2 w-full accent-emerald-600"
                />
                <span className="flex justify-between text-xs font-normal text-zinc-500">
                  <span>drained</span>
                  <span>energized</span>
                </span>
              </label>

              <label className="grid gap-2 text-sm font-medium text-zinc-700">
                <span className="flex items-center justify-between gap-3">
                  Stress
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                    {stressScore}/7
                  </span>
                </span>
                <input
                  type="range"
                  min="1"
                  max="7"
                  step="1"
                  value={stressScore}
                  onChange={(event) => handleStressChange(Number(event.target.value))}
                  className="h-2 w-full accent-zinc-950"
                />
                <span className="flex justify-between text-xs font-normal text-zinc-500">
                  <span>calm</span>
                  <span>overloaded</span>
                </span>
              </label>
            </div>

            <button
              type="button"
              onClick={saveCheckin}
              disabled={isSaving}
              className="mt-5 w-full rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
            >
              {isSaving ? "Saving..." : "Save to DB"}
            </button>

            {message && <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
            {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex min-h-[420px] flex-col items-center justify-center gap-8">
            <div
              aria-label={`Kikibouba preview: ${activeShape.label}, ${scoreLabel("energy", energyScore)}`}
              className="relative h-72 w-72 overflow-visible"
            >
              <div
                key={`shape-stage-${motionKey}`}
                className={`kikibouba-stage-shape absolute inset-0 motion-reduce:animate-none ${activeShape.className}`}
                style={activeShapeStyle(activeShape, activeGradient)}
              />
            </div>

            <div className="grid w-full max-w-md grid-cols-2 gap-3">
              <div className="rounded-md bg-zinc-50 px-3 py-2">
                <div className="text-xs text-zinc-500">Shape source</div>
                <div className="mt-1 text-sm font-semibold text-zinc-950">
                  Stress {stressScore}/7
                </div>
                <div className="mt-1 text-xs text-zinc-500">{activeShape.label}</div>
              </div>
              <div className="rounded-md bg-zinc-50 px-3 py-2">
                <div className="text-xs text-zinc-500">Color source</div>
                <div className="mt-1 text-sm font-semibold text-zinc-950">
                  Energy {energyScore}/7
                </div>
                <div className="mt-1 text-xs text-zinc-500">{scoreLabel("energy", energyScore)}</div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200">
                  <div className="h-full" style={{ background: activeGradient }} />
                </div>
              </div>
            </div>

            <div className="w-full rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
              All seven stress shapes and energy gradients are wired.
            </div>
          </div>
        </section>
      </div>
      <style>{`
        .kikibouba-stage-shape {
          animation: kikibouba-stage-settle 420ms cubic-bezier(0.22, 1, 0.36, 1);
          transform-origin: center;
        }

        @keyframes kikibouba-stage-settle {
          0% {
            transform: scale(0.94) rotate(-1.5deg);
          }
          100% {
            transform: scale(1) rotate(0deg);
          }
        }
      `}</style>
    </main>
  );
}
