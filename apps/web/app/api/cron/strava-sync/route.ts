import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cron-auth";
import { query } from "@/lib/db";
import { syncStravaForUser } from "@/lib/strava";

// Sync incremental (sem 'range' — só desde a última vez, ver
// lib/strava.ts) para todos os utilizadores com Strava ligado. Não
// substitui o botão manual nas Definições, complementa-o: garante que os
// dados ficam frescos mesmo que ninguém abra a app durante uns dias.
export async function GET(req: NextRequest) {
  const denied = requireCronSecret(req);
  if (denied) return denied;

  const accounts = await query<{ user_id: string }>(
    `SELECT user_id FROM connected_accounts WHERE provider = 'strava' AND status = 'connected'`
  );

  let processed = 0;
  const failures: string[] = [];

  for (const account of accounts) {
    try {
      await syncStravaForUser(account.user_id);
      processed += 1;
    } catch (err) {
      // syncStravaForUser já marca connected_accounts.status='error' no
      // caso de falha de token — aqui só registamos para o resumo do job,
      // não repetimos essa lógica.
      failures.push(`${account.user_id}: ${String(err)}`);
    }
  }

  return NextResponse.json({ ok: true, processed, failed: failures.length, failures });
}
