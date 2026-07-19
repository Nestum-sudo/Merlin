import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

// Formulário "Perfil" nas Definições — nome, data de nascimento, FTP
// manual, unidades. Nunca aceita alterar email por aqui (isso implicaria
// verificação, fora de scope por agora — fica para quando decidirmos como
// substituir o placeholder strava-<id>@merlin.local por um email real).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }

  const { name, dateOfBirth, ftpManualW, unitsPreference } = await req.json();

  await query(
    `UPDATE users SET name = COALESCE($2, name), date_of_birth = $3, units_preference = COALESCE($4, units_preference)
     WHERE id = $1`,
    [session.userId, name ?? null, dateOfBirth ?? null, unitsPreference ?? null]
  );

  // athlete_settings pode não ter linha ainda para este utilizador — é por
  // isso que isto é um upsert, não um UPDATE simples.
  await query(
    `INSERT INTO athlete_settings (user_id, ftp_manual_w)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET ftp_manual_w = EXCLUDED.ftp_manual_w, updated_at = now()`,
    [session.userId, ftpManualW ?? null]
  );

  return NextResponse.json({ ok: true });
}
