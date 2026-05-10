"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ResetCheckinButton({
  date,
  children,
}: {
  date: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isResetting, setIsResetting] = useState(false);

  async function resetCheckin() {
    if (isResetting) return;
    setIsResetting(true);

    try {
      await fetch("/api/checkins/reset-day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      router.refresh();
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={resetCheckin}
      disabled={isResetting}
      aria-label="Reset today's check-in"
      title="Reset today's check-in"
      className="absolute top-3 right-0 inline-flex gap-[18px] rounded-full border border-white/10 bg-[rgba(110,110,110,0.20)] px-[12px] py-[11px] disabled:opacity-50"
    >
      {children}
    </button>
  );
}
