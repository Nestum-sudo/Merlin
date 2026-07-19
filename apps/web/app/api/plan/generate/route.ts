import { NextRequest, NextResponse } from "next/server";
import { generateWeeklyPlan } from "@/lib/claude";

// Botão "Gerar plano de treinos" nos Objetivos.
export async function POST(req: NextRequest) {
  const { userId, availableHoursThisWeek } = await req.json();
  if (!userId) {
    return NextResponse.json({ error: "userId em falta" }, { status: 400 });
  }

  try {
    const plan = await generateWeeklyPlan(userId, availableHoursThisWeek);
    return NextResponse.json({ ok: true, plan });
  } catch (err) {
    // TODO: distinguir erro de parsing da resposta do modelo (retry
    // automático faz sentido) de erro de rede/API (não faz).
    return NextResponse.json({ ok: false, error: String(err) }, { status: 502 });
  }
}
