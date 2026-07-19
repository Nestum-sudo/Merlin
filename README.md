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
- Implementada com NextAuth (Auth.js v5), Strava como provider OAuth. Sessão
  JWT (sem tabelas de adapter) — `auth()` em `lib/auth.ts` é o que todas as
  rotas usam para saber quem está autenticado, nunca confiando em `userId`
  vindo do corpo do pedido.
- O Strava não devolve email nos scopes pedidos, por isso cada novo
  utilizador recebe um email placeholder (`strava-<athleteId>@merlin.local`)
  até definir um real nas Definições — ainda por construir esse campo lá.
- Sem "logout" implementado no frontend ainda (o NextAuth já suporta
  `signOut()`, só falta o botão).
- `AUTH_SECRET` tem de ser definido para as sessões serem válidas entre
  reinícios do servidor — sem ele, o NextAuth gera uma chave nova a cada
  arranque e invalida todas as sessões existentes.

**Strava**
- O sync inicial (no callback OAuth, dentro de `resolveInternalUser` em
  `lib/auth.ts`) corre em segundo plano sem `await` bloqueante — mas ainda
  não há forma de o utilizador saber quando terminou; o painel só mostra
  dados quando ele já lá estiver.
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
- O fallback Playwright (`playwright_fallback.py`) está implementado como
  referência estrutural, não validado contra o comportamento real da
  Garmin — o aviso completo está no topo desse ficheiro. Antes de confiar
  nele em produção: confirmar os seletores do formulário de login e a
  forma do JSON devolvido pelos endpoints internos usados
  (`dailySleepData`, `hrv-service`, `bodyBattery`), que provavelmente não
  batem certo exatamente com o que `_map_sleep`/`_map_recovery` esperam
  (escritas a pensar na resposta já processada pela lib direta).
- Sem sinal fiável para distinguir "password errada" de "bloqueado pela
  Cloudflare" — ambos os casos do caminho direto acionam o fallback da
  mesma forma, o que significa que uma password errada dispara sempre um
  login via Playwright desnecessário antes de finalmente falhar.
- O mapeamento de campos da resposta da lib direta (`_map_sleep`,
  `_map_recovery`) está escrito com base no formato habitual da lib, mas
  não foi validado contra uma resposta real — confirmar antes de confiar
  cegamente.

**Jobs agendados**
- Implementados como rotas `/api/cron/*` protegidas por `CRON_SECRET`, com
  `vercel.json` a agendá-las (ver detalhe em `apps/web/jobs/README.md`).
  Se não fores fazer deploy no Vercel, `vercel.json` não faz nada sozinho —
  precisas de configurar outro runner a chamar essas URLs nos mesmos
  horários.
- `weekly-plan-refresh` corre para todos os utilizadores com objetivo
  futuro — herda a mesma limitação já assinalada em `lib/plan.ts`: quem
  não tem objetivo não recebe plano nenhum, por decisão de produto ainda
  não tomada.
- Nenhum destes jobs tem alertagem se falhar (retorna um resumo JSON com
  falhas, mas ninguém é notificado) — para produção, ligar isto a algo que
  avise (Sentry, um webhook para Slack, etc.).

**Frontend**
- As três páginas principais (painel, onboarding, definições) estão
  portadas dos mocks HTML para React, ligadas a dados e endpoints reais —
  não há mais componentes vazios com `TODO`.
- Sem "esqueci-me da password" nem verificação de email — não faz sentido
  ainda, dado que o login é só via Strava (ver secção Autenticação).
- O mapa de rota (`RouteMap.tsx`) usa os tiles públicos do OpenStreetMap
  diretamente (`tile.openstreetmap.org`) — grátis mas com [política de uso
  aceitável](https://operations.osmfoundation.org/policies/tiles/) que não
  aguenta tráfego de produção a sério. Antes de lançar, trocar para um
  provedor de tiles dedicado (MapTiler, Stadia Maps, ou self-host) — a
  troca é só o `url` do `TileLayer`, não muda mais nada no componente.
- `DangerZone.deleteAccount` usa um clique duplo como confirmação
  (`confirmingDelete`) em vez de um modal — funcional, mas vale a pena
  substituir por algo mais robusto (confirmação por escrito do nome, como
  o GitHub faz) antes de produção, dado que a ação é irreversível.

## A começar

### 1. Criar a app no Strava

Em https://www.strava.com/settings/api, cria uma app:
- **Authorization Callback Domain:** `localhost` (dev) ou o domínio real em produção
- Copia o `Client ID` e o `Client Secret` para `apps/web/.env.local`
- O caminho exato do callback (`/api/auth/callback/strava`) é gerido pelo
  NextAuth automaticamente — só o domínio importa na configuração da app
  Strava, não precisas de registar o caminho completo

### 2. Configurar o resto

```bash
cp apps/web/.env.example apps/web/.env.local
cp services/garmin-worker/.env.example services/garmin-worker/.env

# gera uma chave para encriptar os tokens Strava e as credenciais Garmin
# em connected_accounts — tem de ser EXATAMENTE o mesmo valor em
# apps/web/.env.local e services/garmin-worker/.env (chave partilhada,
# não uma por serviço)
openssl rand -base64 32   # cola o resultado em APP_ENCRYPTION_KEY nos dois ficheiros

# chave só do apps/web/.env.local, assina as sessões — esta não precisa de
# bater certo com o worker Garmin
openssl rand -base64 32   # cola o resultado em AUTH_SECRET

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
