import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken, storeStravaTokens, syncStravaForUser } from "@/lib/strava";

// URL de callback registada na app Strava (STRAVA_REDIRECT_URI).
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const userId = req.nextUrl.searchParams.get("state"); // ver TODO em authorize/route.ts
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    // utilizador cancelou no ecrã de permissões do Strava
    return NextResponse.redirect(new URL(`/onboarding?strava=cancelled&userId=${userId ?? ""}`, req.url));
  }
  if (!code || !userId) {
    return NextResponse.json({ error: "code ou state em falta" }, { status: 400 });
  }

  const tokens = await exchangeCodeForToken(code);
  await storeStravaTokens(userId, tokens);

  // Sincronização inicial inline. Em produção, para contas com muito
  // histórico isto pode ultrapassar o limite de tempo de uma function
  // serverless — nesse caso, disparar como job em background (ver
  // apps/web/jobs) e redirecionar já para o ecrã de "Garmin" do onboarding,
  // deixando a primeira sync a terminar em segundo plano.
  await syncStravaForUser(userId);

  return NextResponse.redirect(new URL(`/onboarding?step=garmin&userId=${userId}`, req.url));
}
