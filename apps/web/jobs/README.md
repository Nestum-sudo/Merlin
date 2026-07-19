# Jobs agendados

Definições de jobs para um runner externo (Trigger.dev, Inngest, ou cron
simples) — não correm dentro do processo Next.js em produção.

- `strava-periodic-sync` — chama `syncStravaForUser` para cada utilizador
  ligado, em vez de depender só do sync inicial no callback OAuth e do botão
  manual nas Definições.
- `recompute-daily-metrics` — recalcula CTL/ATL/TSB e readiness_score para
  dias afetados por um sync novo.
- `weekly-plan-refresh` — gera o plano da semana seguinte via lib/claude.ts.
- Sincronização Garmin **não** vive aqui — o próprio garmin-worker tem o seu
  cron interno (ver services/garmin-worker).

TODO: implementar consoante a escolha final de runner de jobs.
