-- Perfil e conta

CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL UNIQUE,
  name            text NOT NULL,
  date_of_birth   date,
  units_preference text NOT NULL DEFAULT 'metric', -- 'metric' | 'imperial'
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE athlete_settings (
  user_id                       uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  ftp_manual_w                  integer,
  readiness_weight_sleep        integer NOT NULL DEFAULT 45,
  readiness_weight_recovery     integer NOT NULL DEFAULT 55,
  readiness_weight_nutrition    integer, -- reservado para o futuro, nullable
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE weight_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recorded_at  date NOT NULL,
  weight_kg    numeric(5,2) NOT NULL,
  UNIQUE (user_id, recorded_at)
);
