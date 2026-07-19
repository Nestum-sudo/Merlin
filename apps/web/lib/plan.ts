import { query } from "./db";

export interface PlanInput {
  athlete: {
    age: number | null;
    weightKg: number | null;
    ftpW: number | null;
  };
  goal: {
    id: string;
    type: string;
    eventName: string | null;
    eventDate: string | null;
    priority: string | null;
    hoursPerWeekTarget: number | null;
  } | null;
  recentDailyMetrics: {
    date: string;
    readinessScore: number | null;
    ctl: number | null;
    atl: number | null;
    tsb: number | null;
    completedSessionType: string | null;
    completedDurationMin: number | null;
  }[];
}

// Junta só o que o prompt precisa — nunca o histórico completo do
// utilizador. É este objeto que fica gravado em ai_generations.input_snapshot,
// por isso também é aqui que se vê, em auditoria, que não vazou mais do que
// isto para fora da base de dados.
export async function assemblePlanInput(userId: string): Promise<PlanInput> {
  const [profile] = await query<{ date_of_birth: string | null; ftp_manual_w: number | null }>(
    `SELECT u.date_of_birth, s.ftp_manual_w
     FROM users u LEFT JOIN athlete_settings s ON s.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );
  const [latestWeight] = await query<{ weight_kg: string | null }>(
    `SELECT weight_kg FROM weight_log WHERE user_id = $1 ORDER BY recorded_at DESC LIMIT 1`,
    [userId]
  );

  const [goal] = await query<{
    id: string;
    type: string;
    event_name: string | null;
    event_date: string | null;
    priority: string | null;
    hours_per_week_target: number | null;
  }>(
    // objetivo mais próximo no futuro — se houver vários, é o que importa
    // para a semana a planear agora
    `SELECT id, type, event_name, event_date, priority, hours_per_week_target
     FROM goals
     WHERE user_id = $1 AND (event_date IS NULL OR event_date >= CURRENT_DATE)
     ORDER BY event_date ASC NULLS LAST
     LIMIT 1`,
    [userId]
  );

  const dailyMetrics = await query<{
    date: string;
    readiness_score: number | null;
    ctl: string | null;
    atl: string | null;
    tsb: string | null;
    session_type: string | null;
    duration_min: number | null;
  }>(
    `SELECT dm.date::text AS date, dm.readiness_score, dm.ctl, dm.atl, dm.tsb,
            a.type AS session_type, ROUND(a.duration_s / 60.0) AS duration_min
     FROM daily_metrics dm
     LEFT JOIN activities a ON a.id = dm.completed_activity_id
     WHERE dm.user_id = $1 AND dm.date >= CURRENT_DATE - INTERVAL '28 days'
     ORDER BY dm.date ASC`,
    [userId]
  );

  return {
    athlete: {
      age: profile?.date_of_birth ? calculateAge(profile.date_of_birth) : null,
      weightKg: latestWeight?.weight_kg ? Number(latestWeight.weight_kg) : null,
      ftpW: profile?.ftp_manual_w ?? null,
    },
    goal: goal
      ? {
          id: goal.id,
          type: goal.type,
          eventName: goal.event_name,
          eventDate: goal.event_date,
          priority: goal.priority,
          hoursPerWeekTarget: goal.hours_per_week_target,
        }
      : null,
    recentDailyMetrics: dailyMetrics.map((d) => ({
      date: d.date,
      readinessScore: d.readiness_score,
      ctl: d.ctl ? Number(d.ctl) : null,
      atl: d.atl ? Number(d.atl) : null,
      tsb: d.tsb ? Number(d.tsb) : null,
      completedSessionType: d.session_type,
      completedDurationMin: d.duration_min,
    })),
  };
}

function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const hasHadBirthdayThisYear =
    now.getMonth() > dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() >= dob.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

export interface GeneratedSession {
  date: string;
  session_type: "endurance" | "threshold" | "vo2max" | "recovery" | "rest";
  duration_min: number;
  target_zone: string;
  description: string;
}

export interface GeneratedPlan {
  summary: string;
  sessions: GeneratedSession[];
}

// Grava o plano gerado — cria training_plans e as 7 planned_sessions.
// goalId pode ser null (utilizador sem objetivo definido, só quer sugestões
// de manutenção de base); training_plans.goal_id assume então um objetivo
// implícito de "base" já existente, ou é ignorado consoante a decisão de
// produto — TODO: decidir isto quando goals sem objetivo explícito existir
// na prática.
export async function persistPlan(goalId: string, plan: GeneratedPlan, modelVersion: string): Promise<string> {
  const [{ id: planId }] = await query<{ id: string }>(
    `INSERT INTO training_plans (goal_id, model_version) VALUES ($1, $2) RETURNING id`,
    [goalId, modelVersion]
  );

  for (const session of plan.sessions) {
    await query(
      `INSERT INTO planned_sessions (training_plan_id, date, session_type, duration_min, target_zone, description)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [planId, session.date, session.session_type, session.duration_min, session.target_zone, session.description]
    );
  }

  return planId;
}
