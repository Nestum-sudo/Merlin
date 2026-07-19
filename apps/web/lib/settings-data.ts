import { query } from "./db";

export interface ConnectedAccountInfo {
  status: "connected" | "error" | "disconnected" | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  connectedAt: string | null;
  scope: string | null;
}

export interface SettingsData {
  profile: {
    name: string;
    dateOfBirth: string | null;
    unitsPreference: string;
    ftpManualW: number | null;
  };
  weight: {
    current: number | null;
    fourWeeksAgo: number | null;
  };
  readinessWeights: { sleep: number; recovery: number };
  strava: ConnectedAccountInfo;
  garmin: ConnectedAccountInfo;
}

export async function getSettingsData(userId: string): Promise<SettingsData> {
  const [user] = await query<{
    name: string;
    date_of_birth: string | null;
    units_preference: string;
  }>(`SELECT name, date_of_birth::text, units_preference FROM users WHERE id = $1`, [userId]);

  const [settings] = await query<{
    ftp_manual_w: number | null;
    readiness_weight_sleep: number;
    readiness_weight_recovery: number;
  }>(
    `SELECT ftp_manual_w, readiness_weight_sleep, readiness_weight_recovery FROM athlete_settings WHERE user_id = $1`,
    [userId]
  );

  const [currentWeight] = await query<{ weight_kg: string }>(
    `SELECT weight_kg FROM weight_log WHERE user_id = $1 ORDER BY recorded_at DESC LIMIT 1`,
    [userId]
  );
  const [pastWeight] = await query<{ weight_kg: string }>(
    `SELECT weight_kg FROM weight_log WHERE user_id = $1 AND recorded_at <= CURRENT_DATE - INTERVAL '28 days'
     ORDER BY recorded_at DESC LIMIT 1`,
    [userId]
  );

  const accounts = await query<{
    provider: string;
    status: string;
    last_synced_at: string | null;
    last_error: string | null;
    connected_at: string | null;
    scope: string | null;
  }>(`SELECT provider, status, last_synced_at, last_error, connected_at, scope FROM connected_accounts WHERE user_id = $1`, [userId]);

  const strava = accounts.find((a) => a.provider === "strava");
  const garmin = accounts.find((a) => a.provider === "garmin");

  const toInfo = (row?: (typeof accounts)[number]): ConnectedAccountInfo => ({
    status: (row?.status as ConnectedAccountInfo["status"]) ?? null,
    lastSyncedAt: row?.last_synced_at ?? null,
    lastError: row?.last_error ?? null,
    connectedAt: row?.connected_at ?? null,
    scope: row?.scope ?? null,
  });

  return {
    profile: {
      name: user?.name ?? "",
      dateOfBirth: user?.date_of_birth ?? null,
      unitsPreference: user?.units_preference ?? "metric",
      ftpManualW: settings?.ftp_manual_w ?? null,
    },
    weight: {
      current: currentWeight?.weight_kg ? Number(currentWeight.weight_kg) : null,
      fourWeeksAgo: pastWeight?.weight_kg ? Number(pastWeight.weight_kg) : null,
    },
    readinessWeights: {
      sleep: settings?.readiness_weight_sleep ?? 45,
      recovery: settings?.readiness_weight_recovery ?? 55,
    },
    strava: toInfo(strava),
    garmin: toInfo(garmin),
  };
}
