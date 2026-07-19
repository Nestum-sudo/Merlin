import { query } from "./db";

export interface TodayCard {
  date: string;
  readinessScore: number | null;
  sleepScore: number | null;
  recoveryScore: number | null;
  plannedSession: {
    sessionType: string;
    durationMin: number;
    targetZone: string;
    description: string;
  } | null;
  ctl: number | null;
  tsb: number | null;
}

export interface WeekDay {
  date: string;
  dow: string; // 'SEG', 'TER', ...
  kind: string; // tipo de sessão ou 'Descanso'
  readinessPct: number | null;
  meta: string;
  isToday: boolean;
  isDone: boolean; // já passou e teve atividade
  isFuture: boolean;
  activityId: string | null;
}

export interface TrendPoint {
  date: string;
  ctl: number | null;
  atl: number | null;
  tsb: number | null;
  sleepScore: number | null;
}

export interface DashboardData {
  today: TodayCard;
  week: WeekDay[];
  trend: TrendPoint[];
  ctlNow: number | null;
  tsbNow: number | null;
  sleepAvg: number | null;
}

const DOW_LABELS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const todayStr = new Date().toISOString().slice(0, 10);

  const [todayMetrics] = await query<{
    date: string;
    readiness_score: number | null;
    ctl: string | null;
    tsb: string | null;
    sleep_score: number | null;
    body_battery_end: number | null;
    body_battery_start: number | null;
  }>(
    `SELECT dm.date::text, dm.readiness_score, dm.ctl, dm.tsb,
            ss.sleep_score, rm.body_battery_end, rm.body_battery_start
     FROM daily_metrics dm
     LEFT JOIN sleep_sessions ss ON ss.id = dm.sleep_session_id
     LEFT JOIN recovery_metrics rm ON rm.id = dm.recovery_metrics_id
     WHERE dm.user_id = $1 AND dm.date = $2`,
    [userId, todayStr]
  );

  const [plannedToday] = await query<{
    session_type: string;
    duration_min: number;
    target_zone: string;
    description: string;
  }>(
    `SELECT ps.session_type, ps.duration_min, ps.target_zone, ps.description
     FROM planned_sessions ps
     WHERE ps.date = $1
       AND ps.training_plan_id IN (
         SELECT tp.id FROM training_plans tp
         JOIN goals g ON g.id = tp.goal_id
         WHERE g.user_id = $2
         ORDER BY tp.generated_at DESC
       )
     ORDER BY ps.date DESC LIMIT 1`,
    [todayStr, userId]
  );

  const weekRows = await query<{
    date: string;
    session_type: string | null;
    duration_min: number | null;
    readiness_score: number | null;
    activity_id: string | null;
    activity_type: string | null;
    activity_duration_min: number | null;
  }>(
    `SELECT d::text AS date,
            ps.session_type, ps.duration_min,
            dm.readiness_score,
            a.id AS activity_id, a.type AS activity_type, ROUND(a.duration_s / 60.0) AS activity_duration_min
     FROM generate_series(CURRENT_DATE - INTERVAL '3 days', CURRENT_DATE + INTERVAL '3 days', INTERVAL '1 day') d
     LEFT JOIN daily_metrics dm ON dm.user_id = $1 AND dm.date = d::date
     LEFT JOIN planned_sessions ps ON ps.date = d::date
       AND ps.training_plan_id IN (SELECT tp.id FROM training_plans tp JOIN goals g ON g.id = tp.goal_id WHERE g.user_id = $1)
     LEFT JOIN activities a ON a.id = dm.completed_activity_id
     ORDER BY d`,
    [userId]
  );

  const trendRows = await query<{
    date: string;
    ctl: string | null;
    atl: string | null;
    tsb: string | null;
    sleep_score: number | null;
  }>(
    `SELECT dm.date::text, dm.ctl, dm.atl, dm.tsb, ss.sleep_score
     FROM daily_metrics dm
     LEFT JOIN sleep_sessions ss ON ss.id = dm.sleep_session_id
     WHERE dm.user_id = $1 AND dm.date >= CURRENT_DATE - INTERVAL '30 days'
     ORDER BY dm.date ASC`,
    [userId]
  );

  const sleepValues = trendRows.map((r) => r.sleep_score).filter((v): v is number => v != null);
  const sleepAvg = sleepValues.length ? Math.round(sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length) : null;

  return {
    today: {
      date: todayStr,
      readinessScore: todayMetrics?.readiness_score ?? null,
      sleepScore: todayMetrics?.sleep_score ?? null,
      recoveryScore: todayMetrics?.body_battery_end ?? todayMetrics?.body_battery_start ?? null,
      plannedSession: plannedToday
        ? {
            sessionType: plannedToday.session_type,
            durationMin: plannedToday.duration_min,
            targetZone: plannedToday.target_zone,
            description: plannedToday.description,
          }
        : null,
      ctl: todayMetrics?.ctl ? Number(todayMetrics.ctl) : null,
      tsb: todayMetrics?.tsb ? Number(todayMetrics.tsb) : null,
    },
    week: weekRows.map((r) => {
      const d = new Date(`${r.date}T00:00:00Z`);
      const isToday = r.date === todayStr;
      const isFuture = r.date > todayStr;
      const kind = r.activity_type ?? r.session_type ?? "Descanso";
      return {
        date: r.date,
        dow: DOW_LABELS[d.getUTCDay()],
        kind,
        readinessPct: r.readiness_score,
        meta: r.activity_duration_min
          ? `${r.activity_duration_min} min`
          : r.duration_min
          ? `${r.duration_min} min planeado`
          : "—",
        isToday,
        isDone: !isFuture && !!r.activity_type,
        isFuture,
        activityId: r.activity_id,
      };
    }),
    trend: trendRows.map((r) => ({
      date: r.date,
      ctl: r.ctl ? Number(r.ctl) : null,
      atl: r.atl ? Number(r.atl) : null,
      tsb: r.tsb ? Number(r.tsb) : null,
      sleepScore: r.sleep_score,
    })),
    ctlNow: todayMetrics?.ctl ? Number(todayMetrics.ctl) : null,
    tsbNow: todayMetrics?.tsb ? Number(todayMetrics.tsb) : null,
    sleepAvg,
  };
}
