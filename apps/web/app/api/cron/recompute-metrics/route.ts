import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cron-auth";
import { query } from "@/lib/db";
import { recomputeDailyMetrics } from "@/lib/daily-metrics";

// Corre uma vez por dia, para TODOS os utilizadores — não só quem
// sincronizou algo recentemente.
//
// Porquê é preciso mesmo com o recompute já disparado a cada sync: CTL/ATL
// decaem em dias de descanso, sem nenhuma atividade nova a chegar. Sem este
// job, um utilizador que não sincronize nada num dia fica sem linha em
// daily_metrics para esse dia — o gráfico de tendências mostra um buraco
// até à próxima sincronização, em vez do decaimento real da carga.
export async function GET(req: NextRequest) {
  const denied = requireCronSecret(req);
  if (denied) return denied;

  const users = await query<{ id: string }>(`SELECT id FROM users`);
  let processed = 0;
  const failures: string[] = [];

  for (const user of users) {
    try {
      await recomputeDailyMetrics(user.id);
      processed += 1;
    } catch (err) {
      failures.push(`${user.id}: ${String(err)}`);
    }
  }

  return NextResponse.json({ ok: true, processed, failed: failures.length, failures });
}
