-- Objetivos e plano

CREATE TABLE goals (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                    text NOT NULL, -- 'gran_fondo' | 'stage_race' | 'timed_climb' | 'base'
  event_name              text,
  event_date              date,
  priority                text, -- 'climbing_endurance' | 'threshold' | 'punch'
  hours_per_week_target   integer,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE training_plans (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id        uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  generated_at   timestamptz NOT NULL DEFAULT now(),
  model_version  text NOT NULL
);

CREATE TABLE planned_sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_plan_id    uuid NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
  date                date NOT NULL,
  session_type        text NOT NULL, -- 'endurance' | 'threshold' | 'vo2max' | 'recovery' | 'rest'
  duration_min        integer,
  target_zone         text,
  description         text,
  status              text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'completed', 'skipped')),
  matched_activity_id uuid REFERENCES activities(id) -- liga ao treino real, para aderência
);

ALTER TABLE daily_metrics
  ADD CONSTRAINT fk_daily_metrics_planned_session
  FOREIGN KEY (planned_session_id) REFERENCES planned_sessions(id);
