import { TodayDashboard, type TodayDashboardProps } from "@/app/_components/today-dashboard";

export const dynamic = "force-dynamic";

export default function DailyView(props: TodayDashboardProps) {
  return <TodayDashboard {...props} />;
}
