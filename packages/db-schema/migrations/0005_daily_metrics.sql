-- A camada normalizada — o único sítio que o frontend e o Claude deviam ler
-- para o dia-a-dia. Recalculada sempre que chega um sync novo que afete o dia.

CREATE TABLE daily_metrics (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date                   date NOT NULL,
  sleep_session_id       uuid REFERENCES sleep_sessions(id),
  recovery_metrics_id    uuid REFERENCES recovery_metrics(id),
  completed_activity_id  uuid REFERENCES activities(id),
  planned_session_id     uuid, -- FK adicionada em 0006, depois de planned_sessions existir
  readiness_score        integer,
  ctl                    numeric(6,2),
  atl                    numeric(6,2),
  tsb                    numeric(6,2),
  computed_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);
