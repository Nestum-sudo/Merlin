import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
import { decodePolyline } from "@/lib/polyline";

// Alimenta o modal de detalhe do painel (clique numa tira do dia).
// Devolve os streams reais downsampled — não inventa curvas.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }

  const [activity] = await query<{
    type: string;
    started_at: string;
    duration_s: number;
    distance_m: string | null;
    elevation_gain_m: string | null;
    avg_power_w: number | null;
    normalized_power_w: number | null;
    avg_hr: number | null;
    max_hr: number | null;
    route_polyline: string | null;
  }>(
    // user_id no WHERE não é só filtragem — é o que impede um utilizador
    // de ver o detalhe de uma atividade de outra pessoa só por adivinhar o
    // UUID (o id sozinho não bastava para autorizar o acesso).
    `SELECT type, started_at, duration_s, distance_m, elevation_gain_m,
            avg_power_w, normalized_power_w, avg_hr, max_hr, route_polyline
     FROM activities WHERE id = $1 AND user_id = $2`,
    [params.id, session.userId]
  );
  if (!activity) {
    return NextResponse.json({ error: "não encontrada" }, { status: 404 });
  }

  const [streamRow] = await query<{ stream_data: any }>(
    `SELECT stream_data FROM activity_streams WHERE activity_id = $1`,
    [params.id]
  );

  // downsample para ~120 pontos — o modal não precisa da resolução ao
  // segundo, só da forma da curva
  const power = downsample(streamRow?.stream_data?.watts?.data ?? [], 120);
  const hr = downsample(streamRow?.stream_data?.heartrate?.data ?? [], 120);

  return NextResponse.json({
    type: activity.type,
    startedAt: activity.started_at,
    durationS: activity.duration_s,
    distanceM: activity.distance_m ? Number(activity.distance_m) : null,
    elevationGainM: activity.elevation_gain_m ? Number(activity.elevation_gain_m) : null,
    avgPowerW: activity.avg_power_w,
    normalizedPowerW: activity.normalized_power_w,
    avgHr: activity.avg_hr,
    maxHr: activity.max_hr,
    hasRoute: !!activity.route_polyline,
    route: activity.route_polyline ? decodePolyline(activity.route_polyline) : null,
    powerSeries: power,
    hrSeries: hr,
  });
}

function downsample(arr: number[], targetPoints: number): number[] {
  if (arr.length <= targetPoints) return arr;
  const step = arr.length / targetPoints;
  const out: number[] = [];
  for (let i = 0; i < targetPoints; i++) out.push(arr[Math.floor(i * step)]);
  return out;
}
