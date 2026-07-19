import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// Formulário "Define o teu objetivo" nos Objetivos. Depois de criado, este
// passa a ser o objetivo "ativo" automaticamente — assemblePlanInput
// (lib/plan.ts) escolhe sempre o mais próximo no futuro, sem precisar de
// um campo explícito de "ativo".
export async function POST(req: NextRequest) {
  const { userId, type, eventName, eventDate, priority, hoursPerWeekTarget } = await req.json();
  if (!userId || !type) {
    return NextResponse.json({ error: "userId ou type em falta" }, { status: 400 });
  }

  const [goal] = await query<{ id: string }>(
    `INSERT INTO goals (user_id, type, event_name, event_date, priority, hours_per_week_target)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [userId, type, eventName ?? null, eventDate ?? null, priority ?? null, hoursPerWeekTarget ?? null]
  );

  return NextResponse.json({ ok: true, goalId: goal.id });
}
