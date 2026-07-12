-- Sono e recuperação (Garmin) — dono: services/garmin-worker

CREATE TABLE sleep_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date          date NOT NULL,
  bedtime       timestamptz,
  wake_time     timestamptz,
  duration_min  integer,
  deep_min      integer,
  light_min     integer,
  rem_min       integer,
  awake_min     integer,
  sleep_score   integer,
  UNIQUE (user_id, date)
);

CREATE TABLE recovery_metrics (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date                  date NOT NULL,
  hrv_ms                numeric(5,1),
  hrv_status             text,
  resting_hr            integer,
  body_battery_start    integer,
  body_battery_end      integer,
  stress_score          integer,
  UNIQUE (user_id, date)
);
