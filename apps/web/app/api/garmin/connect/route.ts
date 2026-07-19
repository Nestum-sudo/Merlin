import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { query } from "@/lib/db";

// Formulário "Ligar Garmin" do onboarding e das Definições.
//
// Sem OAuth oficial, connected_accounts.access_token/refresh_token são
// reaproveitados para guardar email/password encriptados (não são tokens
// OAuth reais) — é o próprio garmin-worker que os desencripta para abrir
// sessão na lib python-garminconnect. Assinalado no comentário da migration
// 0002, repetido aqui para quem só vir este ficheiro.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }
  const userId = session.userId;

  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "email ou password em falta" }, { status: 400 });
  }

  await query(
    `INSERT INTO connected_accounts (user_id, provider, status, access_token, refresh_token, scope, connected_at)
     VALUES ($1, 'garmin', 'connected', $2, $3, $4, now())
     ON CONFLICT (user_id, provider) DO UPDATE
       SET status = 'connected',
           access_token = $2,
           refresh_token = $3,
           scope = $4,
           last_error = NULL,
           connected_at = now()`,
    [userId, encrypt(email), encrypt(password), "sleep,hrv,recovery"]
  );

  // Dispara o primeiro sync no worker, em vez de esperar pelo cron de 6h —
  // o utilizador está a olhar para o ecrã de onboarding à espera de ver
  // dados, não faz sentido fazê-lo esperar até ao próximo ciclo agendado.
  try {
    await fetch(`${process.env.GARMIN_WORKER_URL}/sync/${userId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.GARMIN_WORKER_SERVICE_TOKEN}` },
    });
  } catch {
    // Não bloqueia a ligação da conta — as credenciais já ficaram
    // guardadas; se o worker estiver em baixo agora, o cron apanha isto
    // dentro de 6h, e o utilizador pode sempre carregar em "Sincronizar
    // agora" mais tarde nas Definições.
  }

  return NextResponse.json({ ok: true });
}
