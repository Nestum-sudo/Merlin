import { getDashboardData } from "@/lib/dashboard-data";
import { query } from "@/lib/db";
import DashboardView from "@/components/dashboard/DashboardView";

// TODO: substituir por auth real (ver secção "Autenticação" no README).
// Por agora, assume o primeiro utilizador da base de dados — suficiente
// para desenvolvimento local a solo, não para nada com mais que um
// utilizador.
async function getCurrentUserId(): Promise<string | null> {
  const [row] = await query<{ id: string }>(`SELECT id FROM users ORDER BY created_at ASC LIMIT 1`);
  return row?.id ?? null;
}

export default async function DashboardPage() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return <p style={{ padding: 24 }}>Sem utilizador — corre o onboarding primeiro.</p>;
  }

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
