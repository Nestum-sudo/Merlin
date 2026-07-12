import { NextRequest, NextResponse } from "next/server";

// Nunca fala com o Garmin diretamente — só pede ao garmin-worker para
// sincronizar, e o worker escreve o resultado em connected_accounts.
// Usado pelo botão "Sincronizar agora" nas Definições.
export async function POST(req: NextRequest) {
  const { userId } = await req.json();

  const res = await fetch(`${process.env.GARMIN_WORKER_URL}/sync/${userId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GARMIN_WORKER_SERVICE_TOKEN}` },
  });

  if (!res.ok) {
    return NextResponse.json({ error: "worker indisponível" }, { status: 502 });
  }

  // O worker responde de imediato ("aceite") e sincroniza em segundo plano.
  // O estado real fica em connected_accounts.status / last_error.
  return NextResponse.json({ accepted: true });
}
