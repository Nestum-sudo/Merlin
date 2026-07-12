import { NextRequest, NextResponse } from "next/server";
import { generateWeeklyPlan } from "@/lib/claude";

// TODO: montar `input` a partir de daily_metrics + goals do utilizador
// autenticado, nunca a partir de dados em bruto do Strava/Garmin.
export async function POST(_req: NextRequest) {
  const result = await generateWeeklyPlan({
    athlete: { age: 0, weightKg: 0, ftpW: null },
    recentDailyMetrics: [],
    goal: null,
  });
  return NextResponse.json(result);
}
