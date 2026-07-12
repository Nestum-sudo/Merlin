-- Auditoria da camada Claude — não é fonte de verdade, é histórico de debug.

CREATE TABLE ai_generations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            text NOT NULL, -- 'weekly_plan' | 'daily_insight' | 'session_recalc'
  input_snapshot  jsonb NOT NULL,
  output_raw      jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
