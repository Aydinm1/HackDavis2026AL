"use client";

import { EnergyStressShape } from "@/app/_components/energy-stress-shape";

interface EnergyCircleProps {
  energy: number | null;
  stress: number | null;
  onAddCheckin: () => void;
}

export default function EnergyCircle({ energy, stress, onAddCheckin }: EnergyCircleProps) {
  const displayEnergy = energy ?? 3;
  const displayStress = stress ?? 6;

  return (
    <div className="flex w-full flex-col items-center">
      <div className="relative flex h-[330px] w-full items-center justify-center">
        <EnergyStressShape
          energyScore={displayEnergy}
          stressScore={displayStress}
          className="h-[255px] w-[255px] drop-shadow-[0_12px_18px_rgba(0,0,0,0.28)]"
          label={energy && stress ? `Energy ${energy} and stress ${stress}` : "No check-in logged"}
        />

        <button
          type="button"
          onClick={onAddCheckin}
          aria-label="Log energy and stress"
          className="absolute right-0 top-0 flex h-12 w-12 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_8px_18px_rgba(0,0,0,0.28)] backdrop-blur-md transition-colors hover:bg-white/15"
        >
          <span className="relative h-5 w-5 before:absolute before:left-1/2 before:top-0 before:h-5 before:w-[2px] before:-translate-x-1/2 before:bg-white/90 after:absolute after:left-0 after:top-1/2 after:h-[2px] after:w-5 after:-translate-y-1/2 after:bg-white/90" />
        </button>
      </div>

      <h1 className="-mt-2 text-center text-[44px] leading-none text-white">today&apos;s energy</h1>
    </div>
  );
}
