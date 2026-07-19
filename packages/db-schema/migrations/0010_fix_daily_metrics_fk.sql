-- daily_metrics.planned_session_id ficou sem ação de ON DELETE definida na
-- migration 0006 (o ALTER TABLE que a acrescenta não a especificava,
-- ficando NO ACTION por omissão). Não é problema para apagar um
-- utilizador inteiro (daily_metrics já cai antes, pela cascata via
-- user_id), mas bloquearia apagar um plano isoladamente enquanto o
-- histórico de daily_metrics desse período continuasse a existir — perder
-- o plano não devia arrastar consigo os dados históricos do dia.

ALTER TABLE daily_metrics
  DROP CONSTRAINT fk_daily_metrics_planned_session;

ALTER TABLE daily_metrics
  ADD CONSTRAINT fk_daily_metrics_planned_session
  FOREIGN KEY (planned_session_id) REFERENCES planned_sessions(id) ON DELETE SET NULL;

-- mesma lacuna, mesmo raciocínio: perder a atividade correspondida não
-- devia impedir (nem arrastar) a sessão planeada em si
ALTER TABLE planned_sessions
  DROP CONSTRAINT planned_sessions_matched_activity_id_fkey;

ALTER TABLE planned_sessions
  ADD CONSTRAINT planned_sessions_matched_activity_id_fkey
  FOREIGN KEY (matched_activity_id) REFERENCES activities(id) ON DELETE SET NULL;
