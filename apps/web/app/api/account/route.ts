import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

// "Apagar conta" nas Definições. Um único DELETE em users basta — todas as
// tabelas relacionadas (connected_accounts, activities, weight_log,
// daily_metrics, goals, etc.) têm ON DELETE CASCADE nas suas FKs para
// user_id, definido logo nas migrations 0001-0007. Não apaga nada aqui
// manualmente para não correr o risco de esquecer uma tabela quando o
// esquema crescer.
export async function DELETE() {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }

  await query(`DELETE FROM users WHERE id = $1`, [session.userId]);
  return NextResponse.json({ ok: true });
}
