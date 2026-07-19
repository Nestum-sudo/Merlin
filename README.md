# Merlin

App de treino de ciclismo que junta Strava (atividades, potência, FC, rotas) e
Garmin (sono, HRV, recuperação) para gerar planos de treino e insights via
Claude.

## Estrutura

- `apps/web` — Next.js (frontend + backend principal). Dono das tabelas de
  Strava/atividades, geração de plano via Claude, e leitor de `daily_metrics`.
- `services/garmin-worker` — serviço Python isolado. Dono das tabelas de
  sono/recuperação. Corre à parte porque a ligação ao Garmin não tem OAuth
  oficial e pode partir sem aviso (proteções Cloudflare do lado deles).
- `packages/db-schema` — migrations SQL puro, fonte única do esquema. Nenhum
  ORM "possui" o schema — cada serviço gera o seu client a partir daqui.
- `infra` — docker-compose para desenvolvimento local.

## Estado atual e pontas soltas

Isto não é production-ready — é um esqueleto funcional com peças reais por
baixo. Antes de assumir que algo funciona, confirma aqui:

**Autenticação**
- Não existe sistema de auth real ainda (NextAuth ou equivalente). Todas as
  rotas recebem `userId` diretamente no body/query — funciona para
  desenvolvimento, mas qualquer pessoa pode chamar a API por outro
  utilizador. Bloqueador para produção, não para continuar a desenvolver.

**Strava**
- O `state` do OAuth (`app/api/strava/authorize`) é o `userId` em texto
  simples, não assinado — vulnerável a CSRF. Resolver quando a auth real
  entrar (o `state` pode então ser derivado da sessão).
- O sync inicial no callback OAuth corre inline (`await syncStravaForUser`)
  — para uma conta com muito histórico, isto pode ultrapassar o limite de
  tempo de uma function serverless (Vercel). Falta mover para um job em
  background.
- Sem paginação/rate-limit handling explícito para a API do Strava além do
  que já existe — um `sync: all` em conta com anos de atividades pode
  bater no limite de pedidos do Strava.

**Carga (CTL/ATL/TSB) e prontidão**
- O checkpoint (`lib/daily-metrics.ts`) só reaproveita `daily_metrics` já
  calculado — se nunca correu antes para esse utilizador, ainda recalcula
  desde a primeira atividade. É esperado, não é bug.
- `computeReadiness` não tem ainda o terceiro input (nutrição) — o campo
  existe em `athlete_settings` mas não é usado em lado nenhum ainda.

**Camada Claude**
- `generateWeeklyPlan` não tem retry se a resposta do modelo vier com JSON
  malformado — falha com 502 direto.
- Sem objetivo (`goal`) definido, o plano é gerado e fica em
  `ai_generations`, mas não é persistido em `planned_sessions` — decisão de
  produto por tomar (gerar plano de "base" implícito, ou esconder o botão
  até haver objetivo).
- `recalcTodaySession` não atualiza `planned_sessions` — só devolve a
  sessão recalculada; falta decidir se isso deve sobrescrever a sessão do
  dia ou ficar como sugestão à parte.

**Garmin**
- O fallback Playwright para o bloqueio Cloudflare não está implementado —
  só o caminho direto via `python-garminconnect`. Ver TODO em
  `services/garmin-worker/src/sync.py`.
- O mapeamento de campos da resposta da lib (`_map_sleep`, `_map_recovery`)
  está escrito com base no formato habitual da lib, mas não foi validado
  contra uma resposta real — confirmar antes de confiar cegamente.

**Jobs agendados**
- `apps/web/jobs/README.md` descreve os jobs necessários
  (sync periódico, recompute, refresh do plano semanal), mas nenhum está
  implementado — falta escolher e configurar o runner (Trigger.dev,
  Inngest, ou cron simples).

**Frontend**
- Só o painel principal (`Hoje`/`Tendências`/`Objetivos`) foi portado dos
  mocks HTML para React até agora — onboarding e definições continuam como
  componentes vazios.
- Botões "Desligar conta" / "Apagar conta" nas Definições ainda não têm
  endpoint real por trás.
- O mapa de rota (`RouteMap.tsx`) usa os tiles públicos do OpenStreetMap
  diretamente (`tile.openstreetmap.org`) — grátis mas com [política de uso
  aceitável](https://operations.osmfoundation.org/policies/tiles/) que não
  aguenta tráfego de produção a sério. Antes de lançar, trocar para um
  provedor de tiles dedicado (MapTiler, Stadia Maps, ou self-host) — a
  troca é só o `url` do `TileLayer`, não muda mais nada no componente.

## A começar

### 1. Criar a app no Strava

Em https://www.strava.com/settings/api, cria uma app:
- **Authorization Callback Domain:** `localhost` (dev) ou o domínio real em produção
- Copia o `Client ID` e o `Client Secret` para `apps/web/.env.local`
- `STRAVA_REDIRECT_URI` tem de bater certo com `apps/web/app/api/strava/callback/route.ts`
  (por omissão: `http://localhost:3000/api/strava/callback`)

### 2. Configurar o resto

```bash
cp apps/web/.env.example apps/web/.env.local
cp services/garmin-worker/.env.example services/garmin-worker/.env

# gera uma chave para encriptar os tokens Strava e as credenciais Garmin
# em connected_accounts — tem de ser EXATAMENTE o mesmo valor em
# apps/web/.env.local e services/garmin-worker/.env (chave partilhada,
# não uma por serviço)
openssl rand -base64 32   # cola o resultado em APP_ENCRYPTION_KEY nos dois ficheiros

docker compose -f infra/docker-compose.yml up -d postgres

# aplicar migrations (qualquer runner de SQL simples serve, ex. psql)
for f in packages/db-schema/migrations/*.sql; do
  psql "$DATABASE_URL" -f "$f"
done

docker compose -f infra/docker-compose.yml up
```

Ver `packages/db-schema/migrations/` para o esquema completo e
`docs/` (fora deste esqueleto, nos ficheiros partilhados anteriormente) para
o racional de cada decisão.
