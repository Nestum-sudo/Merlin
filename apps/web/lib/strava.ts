import { query } from "./db";
import { encrypt, decrypt } from "./crypto";
import { recomputeDailyMetrics } from "./daily-metrics";

const STRAVA_OAUTH_BASE = "https://www.strava.com/oauth";
const STRAVA_API_BASE = "https://www.strava.com/api/v3";

// read: perfil básico. activity:read_all: inclui atividades privadas, sem o
// que ficaríamos a ver só um subconjunto do histórico real do atleta.
const SCOPES = "read,activity:read_all";

// ---------- 1. Início do fluxo OAuth ----------

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID!,
    redirect_uri: process.env.STRAVA_REDIRECT_URI!,
    response_type: "code",
    approval_prompt: "auto",
    scope: SCOPES,
    state,
  });
  return `${STRAVA_OAUTH_BASE}/authorize?${params.toString()}`;
}

// ---------- 2. Troca do code pelo primeiro par de tokens ----------

interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix timestamp (segundos)
  athlete?: { id: number };
}

export async function exchangeCodeForToken(code: string): Promise<StravaTokenResponse> {
  const res = await fetch(`${STRAVA_OAUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(`falha na troca do code Strava: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function storeStravaTokens(userId: string, tokens: StravaTokenResponse): Promise<void> {
  await query(
    `INSERT INTO connected_accounts (user_id, provider, status, access_token, refresh_token, scope, token_expires_at, connected_at, last_synced_at)
     VALUES ($1, 'strava', 'connected', $2, $3, $4, to_timestamp($5), now(), NULL)
     ON CONFLICT (user_id, provider) DO UPDATE
       SET status = 'connected',
           access_token = $2,
           refresh_token = $3,
           scope = $4,
           token_expires_at = to_timestamp($5),
           last_error = NULL`,
    [userId, encrypt(tokens.access_token), encrypt(tokens.refresh_token), SCOPES, tokens.expires_at]
  );
}

// ---------- 3. Garantir um access_token válido (refresh automático) ----------
//
// Tokens Strava duram ~6h. Em vez de esperar por um 401 da API, verificamos
// a validade antes de cada sync — mais previsível e evita perder o pedido
// de atividades a meio por um token expirado.

interface ConnectedAccountRow {
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
}

export async function ensureValidAccessToken(userId: string): Promise<string> {
  const rows = await query<ConnectedAccountRow>(
    `SELECT access_token, refresh_token, token_expires_at
     FROM connected_accounts WHERE user_id = $1 AND provider = 'strava'`,
    [userId]
  );
  if (rows.length === 0) throw new Error("Strava não está ligado para este utilizador.");

  const { access_token, refresh_token, token_expires_at } = rows[0];
  const expiresAt = new Date(token_expires_at).getTime();
  const now = Date.now();

  // margem de 5 min antes de expirar, para não arriscar um pedido a meio da troca
  if (expiresAt - now > 5 * 60 * 1000) {
    return decrypt(access_token);
  }

  const res = await fetch(`${STRAVA_OAUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: decrypt(refresh_token),
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    await query(
      `UPDATE connected_accounts SET status = 'error', last_error = $2
       WHERE user_id = $1 AND provider = 'strava'`,
      [userId, "Não foi possível renovar o acesso ao Strava. Liga a conta novamente."]
    );
    throw new Error(`falha no refresh do token Strava: ${res.status}`);
  }

  const refreshed: StravaTokenResponse = await res.json();
  await query(
    `UPDATE connected_accounts
       SET access_token = $2, refresh_token = $3, token_expires_at = to_timestamp($4), status = 'connected', last_error = NULL
     WHERE user_id = $1 AND provider = 'strava'`,
    [userId, encrypt(refreshed.access_token), encrypt(refreshed.refresh_token), refreshed.expires_at]
  );

  return refreshed.access_token;
}

// ---------- 4. Sync de atividades ----------

interface StravaActivity {
  id: number;
  type: string;
  start_date: string;
  moving_time: number;
  distance: number;
  total_elevation_gain: number;
  average_watts?: number;
  weighted_average_watts?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  map?: { summary_polyline?: string };
}

async function fetchActivitiesSince(accessToken: string, afterUnix: number): Promise<StravaActivity[]> {
  const all: StravaActivity[] = [];
  let page = 1;
  // Strava pagina a 200 por pedido; um atleta com muito histórico pode
  // precisar de várias páginas na primeira sincronização.
  while (true) {
    const url = `${STRAVA_API_BASE}/athlete/activities?after=${afterUnix}&per_page=200&page=${page}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error(`falha a listar atividades Strava: ${res.status}`);
    const batch: StravaActivity[] = await res.json();
    all.push(...batch);
    if (batch.length < 200) break;
    page += 1;
  }
  return all;
}

async function fetchActivityStreams(accessToken: string, activityId: number) {
  const keys = "time,heartrate,watts,cadence,altitude";
  const url = `${STRAVA_API_BASE}/activities/${activityId}/streams?keys=${keys}&key_by_type=true`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    // streams podem não existir (ex. atividade manual sem sensores) — não é
    // um erro fatal do sync, só significa que este treino não terá curva de
    // potência/FC no ecrã de detalhe.
    return null;
  }
  return res.json();
}

function estimateTss(activity: StravaActivity, ftpW: number | null): { tss: number | null; intensityFactor: number | null } {
  if (!ftpW || !activity.weighted_average_watts) return { tss: null, intensityFactor: null };
  const intensityFactor = activity.weighted_average_watts / ftpW;
  const tss = ((activity.moving_time * activity.weighted_average_watts * intensityFactor) / (ftpW * 3600)) * 100;
  return { tss: Math.round(tss * 10) / 10, intensityFactor: Math.round(intensityFactor * 100) / 100 };
}

export type SyncRange = "all" | "month" | "week";

// Sem 'range' (chamada automática/periódica): comportamento incremental —
// só desde a última sync, ou 90 dias na primeira vez, para não puxar uma
// carreira inteira sem o utilizador pedir. Com 'range' (botão manual nas
// Definições): ignora last_synced_at, o utilizador está a pedir
// explicitamente uma janela — 'all' força mesmo tudo o que o Strava tiver.
export async function syncStravaForUser(userId: string, range?: SyncRange): Promise<{ imported: number }> {
  const accessToken = await ensureValidAccessToken(userId);

  const [account] = await query<{ last_synced_at: string | null }>(
    `SELECT last_synced_at FROM connected_accounts WHERE user_id = $1 AND provider = 'strava'`,
    [userId]
  );
  const [settings] = await query<{ ftp_manual_w: number | null }>(
    `SELECT ftp_manual_w FROM athlete_settings WHERE user_id = $1`,
    [userId]
  );

  const nowUnix = Math.floor(Date.now() / 1000);
  const DAY = 24 * 60 * 60;

  let after: number;
  if (range === "all") {
    after = 0; // desde sempre — o Strava simplesmente devolve tudo o que tiver
  } else if (range === "month") {
    after = nowUnix - 30 * DAY;
  } else if (range === "week") {
    after = nowUnix - 7 * DAY;
  } else {
    // comportamento incremental por omissão
    after = account?.last_synced_at
      ? Math.floor(new Date(account.last_synced_at).getTime() / 1000)
      : nowUnix - 90 * DAY;
  }

  const activities = await fetchActivitiesSince(accessToken, after);
  let imported = 0;

  for (const act of activities) {
    const { tss, intensityFactor } = estimateTss(act, settings?.ftp_manual_w ?? null);

    const [{ id: activityRowId }] = await query<{ id: string }>(
      `INSERT INTO activities
         (user_id, source, external_id, type, started_at, duration_s, distance_m,
          elevation_gain_m, avg_power_w, normalized_power_w, avg_hr, max_hr,
          tss, intensity_factor, route_polyline)
       VALUES ($1,'strava',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (source, external_id) DO UPDATE
         SET duration_s = EXCLUDED.duration_s,
             tss = EXCLUDED.tss,
             intensity_factor = EXCLUDED.intensity_factor
       RETURNING id`,
      [
        userId,
        String(act.id),
        act.type,
        act.start_date,
        act.moving_time,
        act.distance,
        act.total_elevation_gain,
        act.average_watts ?? null,
        act.weighted_average_watts ?? null,
        act.average_heartrate ?? null,
        act.max_heartrate ?? null,
        tss,
        intensityFactor,
        act.map?.summary_polyline ?? null,
      ]
    );

    const streams = await fetchActivityStreams(accessToken, act.id);
    if (streams) {
      await query(
        `INSERT INTO activity_streams (activity_id, stream_data)
         VALUES ($1, $2)
         ON CONFLICT (activity_id) DO UPDATE SET stream_data = EXCLUDED.stream_data`,
        [activityRowId, JSON.stringify(streams)]
      );
    }

    imported += 1;
  }

  await query(
    `UPDATE connected_accounts SET last_synced_at = now(), status = 'connected', last_error = NULL
     WHERE user_id = $1 AND provider = 'strava'`,
    [userId]
  );

  // Uma vez por sync, não por atividade — e limitado à janela pedida (ver
  // checkpoint em daily-metrics.ts): um sync de "última semana" não obriga
  // a reprocessar anos de série toda.
  const fromDate = new Date(after * 1000).toISOString().slice(0, 10);
  await recomputeDailyMetrics(userId, { fromDate });

  return { imported };
}
