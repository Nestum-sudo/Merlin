import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

// Sliders "Composição da prontidão" nas Definições — os mesmos pesos que
// computeReadiness (lib/readiness.ts) usa a cada recompute.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }

  const { sleep, recovery } = await req.json();
  if (typeof sleep !== "number" || typeof recovery !== "number") {
    return NextResponse.json({ error: "sleep ou recovery em falta" }, { status: 400 });
  }

  await query(
    `INSERT INTO athlete_settings (user_id, readiness_weight_sleep, readiness_weight_recovery)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE
       SET readiness_weight_sleep = EXCLUDED.readiness_weight_sleep,
           readiness_weight_recovery = EXCLUDED.readiness_weight_recovery,
           updated_at = now()`,
    [session.userId, sleep, recovery]
  );

  return NextResponse.json({ ok: true });
}
