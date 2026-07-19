-- Suporte para autenticação real via NextAuth com o Strava como provider.
--
-- Não usamos as tabelas standard do adapter do NextAuth (accounts, sessions,
-- verification_token) — a sessão usa estratégia JWT (sem tabela própria) e
-- os tokens Strava continuam em connected_accounts, que já existia e já é
-- o que lib/strava.ts lê para sincronizar. external_account_id é o que
-- falta para reconhecer "este athlete_id do Strava já é este utilizador"
-- em logins seguintes.

ALTER TABLE connected_accounts
  ADD COLUMN external_account_id text;

-- só um utilizador pode estar ligado a um dado athlete_id do Strava (ou
-- outro provider) de cada vez
CREATE UNIQUE INDEX idx_connected_accounts_provider_external
  ON connected_accounts (provider, external_account_id)
  WHERE external_account_id IS NOT NULL;

-- evita reaparecer sempre o ecrã "Ligar Garmin" no onboarding a cada login,
-- para quem escolheu explicitamente saltar esse passo
ALTER TABLE users
  ADD COLUMN garmin_onboarding_skipped boolean NOT NULL DEFAULT false;
