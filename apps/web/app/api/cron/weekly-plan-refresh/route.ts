import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cron-auth";
import { query } from "@/lib/db";
import { generateWeeklyPlan } from "@/lib/claude";

// Corre semanalmente (domingo à noite, ver vercel.json) para todos os
// utilizadores com um objetivo futuro definido — gera o plano da semana
// seguinte automaticamente, em vez de depender de alguém carregar no botão
// "Gerar plano de treinos".
//
// Só considera utilizadores com objetivo: gerar planos sem objetivo não
// está decidido ainda (ver TODO em lib/plan.ts sobre plano de "base"
// implícito) — sem isso resolvido, correr isto para todos geraria plano
// para gente que nunca pediu um.
export async function GET(req: NextRequest) {
  const denied = requireCronSecret(req);
  if (denied) return denied;

  const usersWithActiveGoal = await query<{ user_id: string }>(
    `SELECT DISTINCT user_id FROM goals WHERE event_date IS NULL OR event_date >= CURRENT_DATE`
  );

  let processed = 0;
  const failures: string[] = [];

  for (const row of usersWithActiveGoal) {
    try {
      await generateWeeklyPlan(row.user_id);
      processed += 1;
    } catch (err) {
      failures.push(`${row.user_id}: ${String(err)}`);
    }
  }

  return NextResponse.json({ ok: true, processed, failed: failures.length, failures });
}
