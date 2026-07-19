import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard-data";
import { query } from "@/lib/db";
import DashboardView from "@/components/dashboard/DashboardView";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.userId) {
    redirect("/onboarding");
  }
  const userId = session.userId;

  const [data, settings] = await Promise.all([
    getDashboardData(userId),
    query<{ readiness_weight_sleep: number; readiness_weight_recovery: number }>(
      `SELECT readiness_weight_sleep, readiness_weight_recovery FROM athlete_settings WHERE user_id = $1`,
      [userId]
    ).then((rows) => rows[0]),
  ]);

  const athleteWeights = {
    sleep: settings?.readiness_weight_sleep ?? 45,
    recovery: settings?.readiness_weight_recovery ?? 55,
  };

  return <DashboardView userId={userId} data={data} athleteWeights={athleteWeights} />;
}
