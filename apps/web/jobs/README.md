# Jobs agendados

Implementados como rotas de API protegidas por segredo partilhado
(`lib/cron-auth.ts`), agendadas via Vercel Cron (`vercel.json` na raiz de
`apps/web`). Nenhum destes corre dentro do processo normal do Next.js —
só respondem quando o scheduler os chama.

- **`/api/cron/strava-sync`** (a cada 6h) — sync incremental para todos os
  utilizadores com Strava ligado. Complementa o botão manual nas
  Definições, não o substitui.
- **`/api/cron/recompute-metrics`** (diário, 03:00) — recalcula
  `daily_metrics` para todos os utilizadores, mesmo sem sync novo. É o que
  garante que dias de descanso aparecem no gráfico de tendências com o
  decaimento real de CTL/ATL, em vez de um buraco até à próxima atividade.
- **`/api/cron/weekly-plan-refresh`** (semanal, domingo 05:00) — gera o
  plano da semana seguinte para quem tem um objetivo futuro definido.

Sincronização Garmin **não** vive aqui — o próprio `garmin-worker` tem o
seu cron interno (`services/garmin-worker/src/main.py`,
`scheduled_sync_all`, a cada 6h), porque só ele tem acesso às credenciais
desencriptadas.

## A usar outro runner que não o Vercel

`vercel.json` só funciona em deploy no Vercel. Para Trigger.dev, Inngest,
ou um cron do sistema operativo, o que muda é só quem chama estas rotas —
o handler em si (`requireCronSecret` + a lógica de cada rota) mantém-se:
configura o runner escolhido para fazer `GET` a cada URL com o header
`Authorization: Bearer $CRON_SECRET`, nos horários acima.
