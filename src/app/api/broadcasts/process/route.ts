import { NextResponse, type NextRequest } from "next/server";
import { runBroadcasts } from "@/lib/data/broadcast-run";
import { withApiLog } from "@/lib/audit/api-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Processa os disparos pendentes/agendados. Protegido por CRON_SECRET.
 * Agendado via Supabase (pg_cron + pg_net) — ver 0124_broadcasts.sql — para
 * não depender do limite de crons do plano Hobby da Vercel.
 */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const res = await runBroadcasts({ budgetMs: 55_000 });
  return NextResponse.json(res);
}

export const GET = withApiLog("cron:broadcasts", handle);
export const POST = withApiLog("cron:broadcasts", handle);
