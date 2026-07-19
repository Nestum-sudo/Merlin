import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { query } from "@/lib/db";

// Cria (ou recupera) o utilizador no arranque do onboarding.
//
// TODO real: isto não é autenticação — não há password, não há sessão, não
// há verificação de email. É o suficiente para ter um userId com que
// arrancar o fluxo Strava/Garmin, nada mais. Substituir por NextAuth (ou
// equivalente) é o bloqueador de produção mais óbvio, já assinalado no
// README.
//
// A API do Strava não devolve email na maioria dos scopes — por isso, sem
// email fornecido explicitamente (ex. pelo formulário "continuar com
// email"), gera-se um placeholder único. O utilizador pode definir o email
// real mais tarde nas Definições.
export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({ email: undefined }));

  if (email) {
    const [existing] = await query<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [email]);
    if (existing) return NextResponse.json({ userId: existing.id });

    const [created] = await query<{ id: string }>(
      `INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id`,
      [email, email.split("@")[0]]
    );
    return NextResponse.json({ userId: created.id });
  }

  const placeholderEmail = `pending-${randomUUID()}@merlin.local`;
  const [created] = await query<{ id: string }>(
    `INSERT INTO users (email, name) VALUES ($1, 'Atleta') RETURNING id`,
    [placeholderEmail]
  );
  return NextResponse.json({ userId: created.id });
}
