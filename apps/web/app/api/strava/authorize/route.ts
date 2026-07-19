import { NextRequest, NextResponse } from "next/server";
import { buildAuthorizeUrl } from "@/lib/strava";

// Chamado pelo botão "Continuar com Strava" do onboarding.
//
// TODO: 'state' devia ser assinado/verificável (ex. JWT curto com userId +
// timestamp), não o userId em texto simples — protege contra CSRF no
// callback. Fica simplificado aqui de propósito.
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId em falta" }, { status: 400 });
  }
  return NextResponse.redirect(buildAuthorizeUrl(userId));
}
