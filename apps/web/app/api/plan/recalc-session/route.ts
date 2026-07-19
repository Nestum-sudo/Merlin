import { NextRequest, NextResponse } from "next/server";
import { recalcTodaySession } from "@/lib/claude";

// Slider "Tempo disponível" do cartão de hoje no painel.
export async function POST(req: NextRequest) {
  const { userId, availableMinutes } = await req.json();
  if (!userId || !availableMinutes) {
    return NextResponse.json({ error: "userId ou availableMinutes em falta" }, { status: 400 });
  }

  try {
    const session = await recalcTodaySession(userId, availableMinutes);
    return NextResponse.json({ ok: true, session });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 502 });
  }
}
