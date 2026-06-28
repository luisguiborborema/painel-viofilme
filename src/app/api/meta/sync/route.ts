import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { hasServiceRole } from "@/lib/supabase/admin";
import { syncAllClients, syncClientFromMeta } from "@/lib/meta/sync";

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
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const pre = preflightError();
  if (pre) return pre;

  const results = await syncAllClients();
  return NextResponse.json({ ok: true, count: results.length, results });
}

/**
 * Manual (gerencial) — sincroniza um cliente.
 * POST /api/meta/sync?client=<clientId>
 */
export async function POST(request: NextRequest) {
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
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
