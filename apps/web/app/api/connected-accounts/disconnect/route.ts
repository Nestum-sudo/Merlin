import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

// "Desligar Strava" / "Desligar Garmin" nas Definições. Limpa os tokens
// guardados (não deixa credenciais válidas mortas na base de dados) e marca
// como desligado — não apaga o histórico já sincronizado (activities,
// sleep_sessions, etc. ficam, só a ligação viva é que sai).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }

  const { provider } = await req.json();
  if (provider !== "strava" && provider !== "garmin") {
    return NextResponse.json({ error: "provider inválido" }, { status: 400 });
  }

  await query(
    `UPDATE connected_accounts
     SET status = 'disconnected', access_token = NULL, refresh_token = NULL, last_error = NULL
     WHERE user_id = $1 AND provider = $2`,
    [session.userId, provider]
  );

  return NextResponse.json({ ok: true });
}
