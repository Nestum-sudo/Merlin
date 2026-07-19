import { NextRequest, NextResponse } from "next/server";

// Protege as rotas /api/cron/* — só quem tiver o segredo (o próprio
// scheduler, nunca o browser) pode disparar estes jobs. Convenção do
// Vercel Cron: define CRON_SECRET e o Vercel manda automaticamente
// `Authorization: Bearer $CRON_SECRET` nos pedidos que ele próprio faz.
// Usar outro runner (Trigger.dev, Inngest, cron do sistema) só precisa de
// mandar o mesmo header manualmente.
export function requireCronSecret(req: NextRequest): NextResponse | null {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  return null;
}
