-- Necessário para o refresh de tokens OAuth2 do Strava (expiram ~6h).
-- O Garmin não usa este campo (a "sessão" dele é gerida inteiramente pelo
-- garmin-worker, não por um par access/refresh token com expiração conhecida).

ALTER TABLE connected_accounts
  ADD COLUMN token_expires_at timestamptz;
