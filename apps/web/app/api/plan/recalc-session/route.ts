import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { recalcTodaySession } from "@/lib/claude";

// Slider "Tempo disponível" do cartão de hoje no painel.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ ok: false, error: "não autenticado" }, { status: 401 });
  }

  const { availableMinutes } = await req.json();
  if (!availableMinutes) {
    return NextResponse.json({ ok: false, error: "availableMinutes em falta" }, { status: 400 });
  }

  try {
    const recalced = await recalcTodaySession(session.userId, availableMinutes);
    return NextResponse.json({ ok: true, session: recalced });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 502 });
  }
}
