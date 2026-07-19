import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncStravaForUser, SyncRange } from "@/lib/strava";

const VALID_RANGES: SyncRange[] = ["all", "month", "week"];

// Botão "Sincronizar agora" do cartão Strava nas Definições — com as três
// opções de janela (desde sempre / último mês / última semana).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ ok: false, error: "não autenticado" }, { status: 401 });
  }

  const { range } = await req.json().catch(() => ({ range: undefined }));
  if (range && !VALID_RANGES.includes(range)) {
    return NextResponse.json({ ok: false, error: "range inválido" }, { status: 400 });
  }

  try {
    const result = await syncStravaForUser(session.userId, range as SyncRange | undefined);
    return NextResponse.json({ ok: true, imported: result.imported });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 502 });
  }
}
