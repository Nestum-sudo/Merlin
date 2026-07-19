import Anthropic from "@anthropic-ai/sdk";
import { query } from "./db";
import { assemblePlanInput, persistPlan, PlanInput, GeneratedPlan, GeneratedSession } from "./plan";

const MODEL = "claude-sonnet-4-6";
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `
És o motor de geração de planos de treino do Merlin, uma app de ciclismo.

Recebes o estado atual de um atleta (idade, peso, FTP, o objetivo que
persegue, e as últimas semanas de carga de treino/prontidão) e devolves o
plano da próxima semana: uma sessão por dia, sete dias.

Regras de treino a respeitar sempre:
- Nunca proponhas duas sessões de alta intensidade (threshold ou vo2max) em
  dias consecutivos.
- Se o TSB dos últimos dias estiver claramente negativo (abaixo de -15) e a
  prontidão recente for baixa, prioriza recuperação em vez de construção,
  mesmo que isso atrase o objetivo — treino em cima de fadiga não acumulada
  não é produtivo.
- Se o atleta tiver um objetivo com data definida, ajusta a ênfase da semana
  à fase em que essa data implica estar (base, construção, afinação, ou
  semana do evento) — não trates todas as semanas como intercambiáveis.
- Sem objetivo definido: foca em manutenção de base equilibrada, sem
  presumir que o atleta quer picos de forma nalgum ponto próximo.
- "rest" é uma sessão válida — não preenchas os 7 dias artificialmente só
  para parecer mais completo.

Respondes SEMPRE e APENAS com um objeto JSON válido, sem markdown, sem
texto antes ou depois, seguindo exatamente este formato:

{
  "summary": "1-2 frases em português explicando a lógica geral desta semana",
  "sessions": [
    {
      "date": "YYYY-MM-DD",
      "session_type": "endurance" | "threshold" | "vo2max" | "recovery" | "rest",
      "duration_min": <número inteiro, 0 se for descanso>,
      "target_zone": "texto curto, ex. 'Z2 68-75% FTP' ou '-' se descanso",
      "description": "1-2 frases em português, o texto que o atleta vê no cartão do dia"
    }
  ]
}

Exatamente 7 objetos em "sessions", um por cada dia consecutivo a partir de
amanhã (não incluas hoje).
`.trim();

function buildUserMessage(input: PlanInput, availableHoursThisWeek?: number): string {
  const parts = [
    `Estado do atleta: ${JSON.stringify(input.athlete)}`,
    `Objetivo ativo: ${input.goal ? JSON.stringify(input.goal) : "nenhum definido"}`,
    `Últimas semanas (daily_metrics, mais recente por último): ${JSON.stringify(input.recentDailyMetrics)}`,
  ];
  if (availableHoursThisWeek != null) {
    parts.push(`O atleta indicou ter ${availableHoursThisWeek}h disponíveis esta semana especificamente — respeita este limite mesmo que o objetivo pedisse mais.`);
  }
  return parts.join("\n\n");
}

// Remove fences ```json ... ``` se o modelo os incluir por hábito, apesar
// da instrução explícita para não o fazer — mais robusto que confiar cegamente
// na instrução.
function parsePlanResponse(raw: string): GeneratedPlan {
  const cleaned = raw.replace(/^```json\s*|```\s*$/g, "").trim();
  const parsed = JSON.parse(cleaned);

  if (!Array.isArray(parsed.sessions) || parsed.sessions.length !== 7) {
    throw new Error(`resposta do modelo não tem exatamente 7 sessões: ${cleaned.slice(0, 200)}`);
  }
  return parsed as GeneratedPlan;
}

export async function generateWeeklyPlan(userId: string, availableHoursThisWeek?: number): Promise<GeneratedPlan> {
  const input = await assemblePlanInput(userId);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserMessage(input, availableHoursThisWeek) }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("resposta do Claude sem bloco de texto");
  }

  const plan = parsePlanResponse(textBlock.text);

  // Auditoria: exatamente o que foi mandado e o que voltou, para nunca
  // teres de adivinhar "porque é que sugeriu isto?" depois.
  await query(
    `INSERT INTO ai_generations (user_id, type, input_snapshot, output_raw)
     VALUES ($1, 'weekly_plan', $2, $3)`,
    [userId, JSON.stringify(input), JSON.stringify(plan)]
  );

  if (input.goal) {
    await persistPlan(input.goal.id, plan, MODEL);
  }
  // TODO: decidir o comportamento quando não há goal (ver nota em
  // persistPlan) — por agora, sem objetivo, o plano é gerado e auditado
  // mas não persistido em planned_sessions.

  return plan;
}

// Recalcula só a sessão de hoje quando o atleta ajusta o tempo disponível
// no slider do painel — não gera a semana toda outra vez. Prompt mais
// pequeno e focado, chamada mais barata e mais rápida (o slider precisa de
// resposta quase imediata).
export async function recalcTodaySession(userId: string, availableMinutes: number): Promise<GeneratedSession> {
  const input = await assemblePlanInput(userId);
  const recent = input.recentDailyMetrics.slice(-7);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: `Ajustas a sessão de treino de HOJE de um atleta de ciclismo para caber no tempo que ele tem disponível, mantendo a intenção da sessão original o mais possível (endurance continua endurance, não vira threshold só porque há menos tempo). Respondes APENAS com um objeto JSON: {"session_type","duration_min","target_zone","description"}.`,
    messages: [
      {
        role: "user",
        content: `Estado recente: ${JSON.stringify(recent)}\nTempo disponível hoje: ${availableMinutes} minutos.`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("resposta do Claude sem bloco de texto");

  const cleaned = textBlock.text.replace(/^```json\s*|```\s*$/g, "").trim();
  const session = JSON.parse(cleaned);

  await query(
    `INSERT INTO ai_generations (user_id, type, input_snapshot, output_raw)
     VALUES ($1, 'session_recalc', $2, $3)`,
    [userId, JSON.stringify({ recent, availableMinutes }), JSON.stringify(session)]
  );

  return { date: new Date().toISOString().slice(0, 10), ...session };
}

// re-exporta o tipo para quem só importa de claude.ts
export type { GeneratedSession, GeneratedPlan } from "./plan";
