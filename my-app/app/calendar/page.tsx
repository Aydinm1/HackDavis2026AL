import { getCurrentUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSchedule } from "@/lib/services/scheduledBlocks";
import { CalendarClient, type CalendarItemViewModel, type WeekDay } from "./calendar-client";

export const dynamic = "force-dynamic";

type CalendarPageProps = {
  searchParams?: Promise<{ day?: string }>;
};

const WEEK_DAYS: WeekDay[] = [
  { letter: "M", date: "2026-05-11", day: 11 },
  { letter: "T", date: "2026-05-12", day: 12 },
  { letter: "W", date: "2026-05-13", day: 13 },
  { letter: "T", date: "2026-05-14", day: 14 },
  { letter: "F", date: "2026-05-15", day: 15 },
  { letter: "S", date: "2026-05-16", day: 16 },
  { letter: "S", date: "2026-05-17", day: 17 },
];

const demoRange = {
  start: new Date("2026-05-11T00:00:00-07:00"),
  end: new Date("2026-05-18T00:00:00-07:00"),
};

function toLocalDateKey(isoString: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(isoString));
}

export default async function Calendar({ searchParams }: CalendarPageProps) {
  const params = await searchParams;
  const selectedDate = params?.day || WEEK_DAYS[0].date;
  const selectedStart = new Date(`${selectedDate}T00:00:00-07:00`);
  const selectedEnd = new Date(selectedStart.getTime() + 24 * 60 * 60_000);
  const userId = getCurrentUserId();

  const [schedule, latestCheckinLog, dailyCheckin] = await Promise.all([
    getSchedule(userId, demoRange),
    prisma.checkinLog.findFirst({
      where: {
        userId,
        loggedAt: {
          gte: selectedStart,
          lt: selectedEnd,
        },
      },
      orderBy: { loggedAt: "desc" },
    }),
    prisma.dailyCheckin.findUnique({
      where: {
        userId_checkinDate: {
          userId,
          checkinDate: selectedStart,
        },
      },
    }),
  ]);

  const items: CalendarItemViewModel[] = [
    ...schedule.calendarEvents
      .filter((event) => event.status !== "cancelled")
      .map((event) => ({
        id: event.id,
        kind: "event" as const,
        title: event.title,
        startTime: event.startTime.toISOString(),
        endTime: event.endTime.toISOString(),
        priority: null,
        cognitiveLoad: null,
      })),
    ...schedule.scheduledBlocks
      .filter((block) => block.status !== "cancelled" && block.status !== "skipped" && block.task?.status !== "cancelled")
      .map((block) => ({
        id: block.id,
        taskId: block.taskId,
        kind: "block" as const,
        title: block.title,
        startTime: block.startTime.toISOString(),
        endTime: block.endTime.toISOString(),
        priority: block.task?.priority ?? null,
        cognitiveLoad:
          block.task?.cognitiveLoad ?? block.taskBreakdown?.cognitiveLoad ?? null,
      })),
  ].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const dailyItems = items.filter((item) => toLocalDateKey(item.startTime) === selectedDate);

  const dateObj = new Date(`${selectedDate}T00:00:00`);
  const selectedDayName = new Intl.DateTimeFormat("en-US", { weekday: "long" })
    .format(dateObj)
    .toLowerCase();
  const monthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(dateObj);

  return (
    <CalendarClient
      initialItems={dailyItems}
      selectedDate={selectedDate}
      weekDays={WEEK_DAYS}
      monthLabel={monthLabel}
      selectedDayName={selectedDayName}
      checkin={{
        energyScore: latestCheckinLog?.energyScore ?? dailyCheckin?.energyScore ?? null,
        stressScore: latestCheckinLog?.stressScore ?? dailyCheckin?.stressScore ?? null,
      }}
    />
  );
}
