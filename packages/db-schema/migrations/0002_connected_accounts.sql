-- Contas ligadas (Strava / Garmin)

CREATE TABLE connected_accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider        text NOT NULL CHECK (provider IN ('strava', 'garmin')),
  status          text NOT NULL DEFAULT 'disconnected'
                    CHECK (status IN ('connected', 'error', 'disconnected')),
  access_token    text,  -- encriptado a nível de aplicação antes de gravar
  refresh_token   text,  -- encriptado; para o Garmin guarda o necessário p/ reautenticar a sessão
  scope           text,
  last_synced_at  timestamptz,
  last_error      text,
  connected_at    timestamptz,
  UNIQUE (user_id, provider)
);
