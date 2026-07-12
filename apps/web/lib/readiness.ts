// Cálculo de CTL/ATL/TSB e do readiness_score diário.
//
// Chamado sempre que chega um novo sync (Strava ou Garmin) que afete um dia
// já existente em daily_metrics. Os pesos (sono vs. HRV/recuperação, e no
// futuro nutrição) vêm de athlete_settings, não estão fixos aqui.

interface ReadinessInputs {
  sleepScore: number | null;
  recoveryScore: number | null;
  weights: { sleep: number; recovery: number; nutrition?: number | null };
}

export function computeReadiness({ sleepScore, recoveryScore, weights }: ReadinessInputs): number | null {
  // TODO: decidir como lidar com uma das fontes em falta (Garmin não ligado
  // ou em erro) — normalizar pesos sobre as fontes disponíveis, não somar
  // como se o valor em falta fosse zero.
  if (sleepScore == null && recoveryScore == null) return null;
  const parts: number[] = [];
  if (sleepScore != null) parts.push(sleepScore * (weights.sleep / 100));
  if (recoveryScore != null) parts.push(recoveryScore * (weights.recovery / 100));
  return Math.round(parts.reduce((a, b) => a + b, 0));
}

export function computeCtlAtlTsb(_dailyTssHistory: { date: string; tss: number }[]) {
  // TODO: médias móveis exponenciais (CTL ~42 dias, ATL ~7 dias), TSB = CTL - ATL.
  throw new Error("not implemented");
}
