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

## A começar

```bash
cp apps/web/.env.example apps/web/.env.local
cp services/garmin-worker/.env.example services/garmin-worker/.env

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
# Merlin
