import { NextRequest, NextResponse } from "next/server";
import { recomputeDailyMetrics } from "@/lib/daily-metrics";

// Chamado pelo garmin-worker depois de um sync com sucesso — o cálculo de
// CTL/ATL/TSB e readiness vive só aqui (TypeScript), o worker Python não o
// reimplementa, só avisa que há dados novos.
// Autenticado por token de serviço, nunca exposto publicamente.
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.WEB_INTERNAL_SERVICE_TOKEN}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const { userId } = await req.json();
  await recomputeDailyMetrics(userId);
  return NextResponse.json({ ok: true });
}
