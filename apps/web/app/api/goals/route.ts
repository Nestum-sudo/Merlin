import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

// Formulário "Define o teu objetivo" nos Objetivos.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }

  const { type, eventName, eventDate, priority, hoursPerWeekTarget } = await req.json();
  if (!type) {
    return NextResponse.json({ error: "type em falta" }, { status: 400 });
  }

  const [goal] = await query<{ id: string }>(
    `INSERT INTO goals (user_id, type, event_name, event_date, priority, hours_per_week_target)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [session.userId, type, eventName ?? null, eventDate ?? null, priority ?? null, hoursPerWeekTarget ?? null]
  );

  return NextResponse.json({ ok: true, goalId: goal.id });
}
