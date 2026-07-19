import { query } from "./db";

export interface DailyTss {
  date: string; // YYYY-MM-DD
  tss: number;
}

// Série diária de TSS, sem buracos — dias sem atividade entram como 0. É
// isto que CTL/ATL precisam: uma série contínua, não só os dias em que
// houve treino.
export async function getDailyTssSeries(userId: string, fromDate: string, toDate: string): Promise<DailyTss[]> {
  const rows = await query<{ date: string; tss: string }>(
    `SELECT to_char(date_trunc('day', started_at), 'YYYY-MM-DD') AS date,
            COALESCE(SUM(tss), 0) AS tss
     FROM activities
     WHERE user_id = $1
       AND started_at >= $2::date
       AND started_at < $3::date + interval '1 day'
     GROUP BY 1
     ORDER BY 1`,
    [userId, fromDate, toDate]
  );
  return fillGaps(rows, fromDate, toDate);
}

function fillGaps(rows: { date: string; tss: string }[], from: string, to: string): DailyTss[] {
  const byDate = new Map(rows.map((r) => [r.date, Number(r.tss)]));
  const out: DailyTss[] = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cursor <= end) {
    const iso = cursor.toISOString().slice(0, 10);
    out.push({ date: iso, tss: byDate.get(iso) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}
