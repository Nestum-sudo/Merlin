import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Gera o plano semanal / insight diário a partir de daily_metrics já
// normalizado — nunca a partir de dados em bruto do Strava/Garmin.
// O par (input, output) fica registado em ai_generations para auditoria.
export async function generateWeeklyPlan(input: {
  athlete: { age: number; weightKg: number; ftpW: number | null };
  recentDailyMetrics: unknown[];
  goal: unknown | null;
}) {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: JSON.stringify(input), // TODO: prompt estruturado real
      },
    ],
  });

  // TODO: gravar em ai_generations (input_snapshot, output_raw)
  return response;
}
