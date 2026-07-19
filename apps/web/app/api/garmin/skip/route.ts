import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

// "Saltar por agora" no passo Garmin do onboarding. Grava a decisão para
// não voltar a mostrar esse ecrã em cada login — o utilizador pode sempre
// ligar mais tarde nas Definições.
export async function POST() {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }

  await query(`UPDATE users SET garmin_onboarding_skipped = true WHERE id = $1`, [session.userId]);
  return NextResponse.json({ ok: true });
}
