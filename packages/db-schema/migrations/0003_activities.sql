-- Atividades (Strava) — dono: apps/web

CREATE TABLE activities (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source              text NOT NULL DEFAULT 'strava',
  external_id         text NOT NULL,
  type                text NOT NULL,
  started_at          timestamptz NOT NULL,
  duration_s          integer NOT NULL,
  distance_m          numeric(10,1),
  elevation_gain_m    numeric(8,1),
  avg_power_w         integer,
  normalized_power_w  integer,
  avg_hr              integer,
  max_hr              integer,
  tss                 numeric(6,1),
  intensity_factor    numeric(4,2),
  route_polyline      text,
  UNIQUE (source, external_id)
);

CREATE INDEX idx_activities_user_started ON activities (user_id, started_at);

-- Streams ao segundo (HR, potência, cadência, altitude) — pesados,
-- separados para não abrandar listagens/cálculos de carga. Em produção
-- avaliar guardar como ficheiro em object storage e referenciar aqui em vez
-- de JSON inline, consoante o volume real.
CREATE TABLE activity_streams (
  activity_id  uuid PRIMARY KEY REFERENCES activities(id) ON DELETE CASCADE,
  stream_data  jsonb NOT NULL
);
