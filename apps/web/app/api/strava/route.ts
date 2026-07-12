import { NextRequest, NextResponse } from "next/server";

// OAuth2 real do Strava — este serviço fala diretamente com a API do
// Strava, sem intermediários (ao contrário do Garmin).
// TODO: iniciar o fluxo OAuth (redirect para strava.com/oauth/authorize)
export async function GET(_req: NextRequest) {
  return NextResponse.json({ todo: "iniciar OAuth do Strava" });
}
