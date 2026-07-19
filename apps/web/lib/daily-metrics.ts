import { query } from "./db";
import { getDailyTssSeries } from "./load";
import { computeCtlAtlTsb, computeReadiness } from "./readiness";

interface RecomputeOptions {
  // Limita o recompute a partir desta data, em vez de desde a primeira
  // atividade de sempre. Usado quando o sync foi pedido para uma janela
  // específica (ex. "última semana") — não faz sentido reprocessar anos de
  // histórico só porque chegaram 3 atividades novas da última semana.
  fromDate?: string;
}

// Recalcula daily_metrics de um utilizador.
//
// CTL/ATL são cumulativos — não dá para recalcular só "o dia que mudou" no
// vazio, precisa sempre de um ponto de partida (seed) com o estado
// acumulado até ao dia anterior. Em vez de guardar checkpoints numa tabela
// à parte, reaproveitamos o que já está calculado: se já existir uma linha
// em daily_metrics para o dia antes de `fromDate`, usamos o ctl/atl dela
// como seed e só recalculamos a partir daí. Se não existir (primeiro sync
// de sempre, ou fromDate omitido), cai para o comportamento antigo:
// recomputa tudo desde a primeira atividade.
export async function recomputeDailyMetrics(userId: string, options: RecomputeOptions = {}): Promise<void> {
  const [firstActivity] = await query<{ min_date: string | null }>(
    `SELECT to_char(MIN(started_at), 'YYYY-MM-DD') AS min_date FROM activities WHERE user_id = $1`,
    [userId]
  );
  if (!firstActivity?.min_date) return; // sem atividades ainda, nada a calcular

  const today = new Date().toISOString().slice(0, 10);

  let seriesStart = firstActivity.min_date;
  let seed: { ctl: number; atl: number } | undefined;

  if (options.fromDate && options.fromDate > firstActivity.min_date) {
    const dayBefore = addDays(options.fromDate, -1);
    const [checkpoint] = await query<{ ctl: string; atl: string }>(
      `SELECT ctl, atl FROM daily_metrics WHERE user_id = $1 AND date = $2`,
      [userId, dayBefore]
    );
    if (checkpoint) {
      seriesStart = options.fromDate;
      seed = { ctl: Number(checkpoint.ctl), atl: Number(checkpoint.atl) };
    }
    // sem checkpoint disponível: mantém seriesStart = primeira atividade,
    // é a única forma correta de arrancar sem um ponto de partida conhecido
  }

  const tssSeries = await getDailyTssSeries(userId, seriesStart, today);
  const loadSeries = computeCtlAtlTsb(tssSeries, seed);

  const [settings] = await query<{ readiness_weight_sleep: number; readiness_weight_recovery: number }>(
    `SELECT readiness_weight_sleep, readiness_weight_recovery FROM athlete_settings WHERE user_id = $1`,
    [userId]
  );
  const weights = {
    sleep: settings?.readiness_weight_sleep ?? 45,
    recovery: settings?.readiness_weight_recovery ?? 55,
  };

  for (const point of loadSeries) {
    const [sleep] = await query<{ id: string; sleep_score: number | null }>(
      `SELECT id, sleep_score FROM sleep_sessions WHERE user_id = $1 AND date = $2`,
      [userId, point.date]
    );
    const [recovery] = await query<{ id: string; body_battery_end: number | null; body_battery_start: number | null }>(
      `SELECT id, body_battery_end, body_battery_start FROM recovery_metrics WHERE user_id = $1 AND date = $2`,
      [userId, point.date]
    );
    const [activity] = await query<{ id: string }>(
      `SELECT id FROM activities WHERE user_id = $1 AND started_at::date = $2::date
       ORDER BY duration_s DESC LIMIT 1`,
      [userId, point.date]
    );

    const recoveryScore = recovery?.body_battery_end ?? recovery?.body_battery_start ?? null;
    const readiness = computeReadiness({
      sleepScore: sleep?.sleep_score ?? null,
      recoveryScore,
      weights,
    });

    await query(
      `INSERT INTO daily_metrics
         (user_id, date, sleep_session_id, recovery_metrics_id, completed_activity_id, readiness_score, ctl, atl, tsb, computed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
       ON CONFLICT (user_id, date) DO UPDATE
         SET sleep_session_id = EXCLUDED.sleep_session_id,
             recovery_metrics_id = EXCLUDED.recovery_metrics_id,
             completed_activity_id = EXCLUDED.completed_activity_id,
             readiness_score = EXCLUDED.readiness_score,
             ctl = EXCLUDED.ctl,
             atl = EXCLUDED.atl,
             tsb = EXCLUDED.tsb,
             computed_at = now()`,
      [
        userId,
        point.date,
        sleep?.id ?? null,
        recovery?.id ?? null,
        activity?.id ?? null,
        readiness,
        point.ctl,
        point.atl,
        point.tsb,
      ]
    );
  }
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
