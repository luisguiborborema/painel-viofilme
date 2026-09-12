import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { hasServiceRole } from "@/lib/supabase/admin";
import { syncAllClients, syncClientFromMeta } from "@/lib/meta/sync";
import { anotarChamada, withApiLog } from "@/lib/audit/api-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function preflightError(): NextResponse | null {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase não configurado" },
      { status: 503 },
    );
  }
  if (!hasServiceRole()) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY ausente" },
      { status: 503 },
    );
  }
  return null;
}

/**
 * Cron (Vercel) — sincroniza TODOS os clientes.
 * Protegido por CRON_SECRET: o Vercel envia "Authorization: Bearer <CRON_SECRET>".
 * GET /api/meta/sync
 */
async function getHandler(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const pre = preflightError();
  if (pre) return pre;

  const results = await syncAllClients();

  /**
   * Erros da sincronização entram nos Logs de API.
   *
   * Antes eles só existiam no corpo da resposta, que ninguém lê: o cron chama
   * de madrugada e segue. Uma conta com token expirado ficaria semanas sem
   * números novos, e a primeira pessoa a notar seria o cliente perguntando por
   * que o relatório parou.
   */
  const comErro = results.filter((r) => r.errors.length > 0);
  anotarChamada({
    meta: {
      clientes: results.length,
      comErro: comErro.length,
      ...(comErro.length ? { erros: comErro.slice(0, 10).map((r) => `${r.clientId}: ${r.errors[0]}`) } : {}),
    },
  });
  return NextResponse.json({ ok: true, count: results.length, comErro: comErro.length, results });
}

export const GET = withApiLog("cron:meta-sync", getHandler);

/**
 * Manual (gerencial) — sincroniza um cliente.
 * POST /api/meta/sync?client=<clientId>
 */
async function postHandler(request: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const pre = preflightError();
  if (pre) return pre;

  const clientId = request.nextUrl.searchParams.get("client");
  if (!clientId) {
    return NextResponse.json(
      { error: "informe ?client=<clientId>" },
      { status: 400 },
    );
  }

  try {
    const result = await syncClientFromMeta(clientId);
    if (result.errors.length) anotarChamada({ meta: { cliente: clientId, erros: result.errors.slice(0, 10) } });
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const POST = withApiLog("meta:sync", postHandler);
