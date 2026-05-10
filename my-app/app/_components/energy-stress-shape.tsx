"use client";

import type { CSSProperties } from "react";

export const energyGradients: Record<number, string> = {
  1: "linear-gradient(62deg, #F1A19D 28.5%, #D25A54 64.28%, #921D17 117.91%)",
  2: "linear-gradient(45deg, #E4B886 8.9%, #F69221 53.82%, #A86416 85.88%)",
  3: "linear-gradient(110deg, #EADA98 5.97%, #F0D14F 47.45%, #CCA608 88.94%)",
  4: "linear-gradient(231deg, #ADE09B 21.19%, #6BC94A 67.47%, #348717 113.75%)",
  5: "linear-gradient(153deg, #87C9CA 29.99%, #45C5C7 57.12%, #069699 82.95%)",
  6: "linear-gradient(180deg, #AAB6D8 0%, #748EDA 50%, #405592 100%)",
  7: "linear-gradient(180deg, #D7A5DD 0%, #CA65D6 50%, #9F1AAF 100%)",
};

function clampScore(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return Math.max(1, Math.min(7, Math.round(value)));
}

export function energyStressShapeStyle({
  energyScore,
  stressScore,
}: {
  energyScore: number | null | undefined;
  stressScore: number | null | undefined;
}): CSSProperties {
  const energy = clampScore(energyScore) ?? 4;
  const stress = clampScore(stressScore) ?? 4;

  return {
    background: energyGradients[energy],
    maskImage: `url(/kikibouba/shapes/stress-${stress}.svg)`,
    WebkitMaskImage: `url(/kikibouba/shapes/stress-${stress}.svg)`,
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
    maskPosition: "center",
    WebkitMaskPosition: "center",
    maskSize: "contain",
    WebkitMaskSize: "contain",
  };
}

export function EnergyStressShape({
  energyScore,
  stressScore,
  className = "",
  label,
}: {
  energyScore: number | null | undefined;
  stressScore: number | null | undefined;
  className?: string;
  label?: string;
}) {
  return (
    <div
      aria-label={label}
      role={label ? "img" : undefined}
      className={className}
      style={energyStressShapeStyle({ energyScore, stressScore })}
    />
  );
}
