import { NextResponse, type NextRequest } from "next/server";
import { runBackup } from "@/lib/data/backup";
import { withApiLog } from "@/lib/audit/api-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Backup diário do banco para o Google Drive. Chamado pelo despachante
 * (/api/cron/daily). Protegido por CRON_SECRET.
 */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const res = await runBackup();
  // Falha de backup vira 500 para aparecer em vermelho nos Logs de API.
  return NextResponse.json(res, { status: res.ok ? 200 : 500 });
}

export const GET = withApiLog("cron:backup", handle);
export const POST = withApiLog("cron:backup", handle);
