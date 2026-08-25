import { NextResponse, type NextRequest } from "next/server";
import { withApiLog } from "@/lib/audit/api-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Dispatcher diário — plano Hobby da Vercel permite poucos crons (e só 1×/dia).
 * Em vez de 1 cron por tarefa, este único cron dispara em sequência todas as
 * rotinas diárias do app. Cada rotina continua sendo um endpoint próprio
 * (testável isolado) protegido por CRON_SECRET; aqui só as chamamos internamente.
 *
 * Autoriza via CRON_SECRET (o Vercel envia "Authorization: Bearer <CRON_SECRET>").
 */
const JOBS = ["notifications", "nps", "meeting-survey", "expenses", "backup"] as const;

async function getHandler(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  // Base absoluta para chamar os próprios endpoints. Sem ela, usa a origem da request.
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "") || new URL(request.url).origin;

  const results: Record<string, unknown> = {};
  for (const job of JOBS) {
    try {
      const res = await fetch(`${base}/api/cron/${job}`, {
        headers: { authorization: `Bearer ${secret}` },
        cache: "no-store",
      });
      results[job] = { status: res.status, body: await res.json().catch(() => null) };
    } catch (e) {
      results[job] = { error: e instanceof Error ? e.message : "erro" };
    }
  }

  return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), results });
}

export const GET = withApiLog("cron:daily", getHandler);
