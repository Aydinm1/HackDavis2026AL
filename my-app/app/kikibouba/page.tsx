import { KikiboubaClient, type KikiboubaInitialState } from "@/app/kikibouba/kikibouba-client";
import { getCurrentUserId } from "@/lib/auth";
import { listCheckinLogs } from "@/lib/services/checkins";

export const dynamic = "force-dynamic";

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

export default async function KikiboubaPage() {
  const start = startOfToday();
  const end = new Date(start.getTime() + 24 * 60 * 60_000);
  const logs = await listCheckinLogs(getCurrentUserId(), { start, end });
  const latestLog = logs.at(-1);
  const initialState: KikiboubaInitialState = latestLog
    ? {
        energyScore: latestLog.energyScore,
        stressScore: latestLog.stressScore,
        loggedAt: latestLog.loggedAt.toISOString(),
      }
    : {
        energyScore: 4,
        stressScore: 4,
        loggedAt: null,
      };

  return <KikiboubaClient initialState={initialState} />;
}
