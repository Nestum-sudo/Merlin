// Cálculo de CTL/ATL/TSB e do readiness_score diário.
//
// Chamado por recomputeDailyMetrics() sempre que chega um novo sync (Strava
// ou Garmin) que afete um dia já existente em daily_metrics.

interface ReadinessInputs {
  sleepScore: number | null;
  recoveryScore: number | null;
  weights: { sleep: number; recovery: number; nutrition?: number | null };
}

// Normaliza os pesos sobre as fontes realmente disponíveis nesse dia — se o
// Garmin não estiver ligado (ou tiver falhado a sincronizar), a prontidão
// não é penalizada por "meio input em falta": usa 100% do peso do sono
// nesse dia, em vez de tratar o recovery_score em falta como zero.
export function computeReadiness({ sleepScore, recoveryScore, weights }: ReadinessInputs): number | null {
  const available: { score: number; weight: number }[] = [];
  if (sleepScore != null) available.push({ score: sleepScore, weight: weights.sleep });
  if (recoveryScore != null) available.push({ score: recoveryScore, weight: weights.recovery });
  if (available.length === 0) return null;

  const totalWeight = available.reduce((sum, s) => sum + s.weight, 0);
  const weighted = available.reduce((sum, s) => sum + s.score * (s.weight / totalWeight), 0);
  return Math.round(weighted);
}

export interface LoadPoint {
  date: string;
  ctl: number;
  atl: number;
  tsb: number;
}

// Constantes de tempo convencionais (dias) — CTL ~6 semanas, ATL ~1 semana.
const CTL_TIME_CONSTANT = 42;
const ATL_TIME_CONSTANT = 7;

// Médias móveis exponenciais sobre a série diária de TSS.
// TSB do dia é a forma ANTES do treino desse dia (CTL - ATL de ontem) — é a
// convenção standard (TrainingPeaks e afins): a prontidão de hoje depende da
// carga acumulada até ontem, não do treino que ainda vais fazer hoje.
export function computeCtlAtlTsb(
  dailyTssHistory: { date: string; tss: number }[],
  seed?: { ctl: number; atl: number }
): LoadPoint[] {
  let ctl = seed?.ctl ?? 0;
  let atl = seed?.atl ?? 0;
  const out: LoadPoint[] = [];

  for (const day of dailyTssHistory) {
    const tsb = round2(ctl - atl); // forma antes do treino de hoje, com o estado até ontem
    ctl = ctl + (day.tss - ctl) / CTL_TIME_CONSTANT;
    atl = atl + (day.tss - atl) / ATL_TIME_CONSTANT;
    out.push({ date: day.date, ctl: round2(ctl), atl: round2(atl), tsb });
  }
  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
