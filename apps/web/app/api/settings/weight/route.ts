import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

// "Registar peso de hoje" nas Definições. Um registo por dia — se já
// existir um para hoje, atualiza em vez de duplicar (UNIQUE (user_id,
// recorded_at) na migration 0001 garante isto ao nível da BD também).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }

  const { weightKg } = await req.json();
  if (!weightKg) {
    return NextResponse.json({ error: "weightKg em falta" }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  await query(
    `INSERT INTO weight_log (user_id, recorded_at, weight_kg)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, recorded_at) DO UPDATE SET weight_kg = EXCLUDED.weight_kg`,
    [session.userId, today, weightKg]
  );

  return NextResponse.json({ ok: true });
}
