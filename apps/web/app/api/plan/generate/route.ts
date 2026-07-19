import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateWeeklyPlan } from "@/lib/claude";

// Botão "Gerar plano de treinos" nos Objetivos.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ ok: false, error: "não autenticado" }, { status: 401 });
  }

  const { availableHoursThisWeek } = await req.json().catch(() => ({}));

  try {
    const plan = await generateWeeklyPlan(session.userId, availableHoursThisWeek);
    return NextResponse.json({ ok: true, plan });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 502 });
  }
}
