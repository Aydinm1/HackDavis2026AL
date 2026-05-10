"use client";

interface MetricsSlidersProps {
  averageEnergy: number;
  averageStress: number;
}

export default function MetricsSliders({ averageEnergy, averageStress }: MetricsSlidersProps) {
  // Normalize 1-7 scale to 0-100 for visual representation
  const energyPercent = ((averageEnergy - 1) / 6) * 100;
  const stressPercent = ((averageStress - 1) / 6) * 100;

  const getEnergyColor = (value: number): string => {
    if (value <= 2) return "from-red-500 to-red-600";
    if (value <= 4) return "from-orange-500 to-orange-600";
    return "from-green-500 to-green-600";
  };

  const getStressColor = (value: number): string => {
    if (value <= 2) return "from-green-500 to-green-600";
    if (value <= 4) return "from-yellow-500 to-yellow-600";
    return "from-red-500 to-red-600";
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Last week's average stress */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center text-sm">
          <span className="text-white/60 font-light italic">last week&apos;s average stress</span>
          <span className="text-white text-sm">{averageStress.toFixed(1)}/7</span>
        </div>
        <div className="relative w-full h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${getStressColor(averageStress)} transition-all`}
            style={{ width: `${stressPercent}%` }}
          />
          <div
            className="absolute top-1/2 w-4 h-4 bg-white rounded-full -translate-y-1/2 shadow-lg"
            style={{ left: `calc(${stressPercent}% - 8px)` }}
          />
        </div>
      </div>

      {/* Last week's average energy */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center text-sm">
          <span className="text-white/60 font-light italic">last week&apos;s average energy</span>
          <span className="text-white text-sm">{averageEnergy.toFixed(1)}/7</span>
        </div>
        <div className="relative w-full h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${getEnergyColor(averageEnergy)} transition-all`}
            style={{ width: `${energyPercent}%` }}
          />
          <div
            className="absolute top-1/2 w-4 h-4 bg-white rounded-full -translate-y-1/2 shadow-lg"
            style={{ left: `calc(${energyPercent}% - 8px)` }}
          />
        </div>
      </div>
    </div>
  );
}
