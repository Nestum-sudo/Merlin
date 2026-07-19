import { NextRequest, NextResponse } from "next/server";
import { syncStravaForUser, SyncRange } from "@/lib/strava";

const VALID_RANGES: SyncRange[] = ["all", "month", "week"];

// Botão "Sincronizar agora" do cartão Strava nas Definições — com as três
// opções de janela (desde sempre / último mês / última semana).
// Corre em processo — o Strava é estável e rápido o suficiente para não
// precisar de um worker isolado como o Garmin.
export async function POST(req: NextRequest) {
  const { userId, range } = await req.json();

  if (range && !VALID_RANGES.includes(range)) {
    return NextResponse.json({ ok: false, error: "range inválido" }, { status: 400 });
  }

  try {
    const result = await syncStravaForUser(userId, range as SyncRange | undefined);
    return NextResponse.json({ ok: true, imported: result.imported });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 502 });
  }
}
