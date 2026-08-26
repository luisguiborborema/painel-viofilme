import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getDre, type DrePeriodo } from "@/lib/data/dre-server";
import { type DreRegime } from "@/lib/data/dre";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PERIODOS = new Set(["mes", "trimestre", "ano"]);
const REGIMES = new Set(["competencia", "caixa"]);

/** DRE do período (GET) e meta de margem (POST). */
export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") return NextResponse.json({ error: "não autorizado" }, { status: 401 });

  const p = request.nextUrl.searchParams.get("periodo") ?? "mes";
  const periodo = (PERIODOS.has(p) ? p : "mes") as DrePeriodo;
  // Deslocamento em períodos (0 = atual, -1 = anterior…).
  const offset = Math.max(-36, Math.min(Number(request.nextUrl.searchParams.get("offset") ?? 0) || 0, 0));

  const ref = new Date();
  if (offset !== 0) {
    if (periodo === "ano") ref.setUTCFullYear(ref.getUTCFullYear() + offset);
    else if (periodo === "trimestre") ref.setUTCMonth(ref.getUTCMonth() + offset * 3);
    else ref.setUTCMonth(ref.getUTCMonth() + offset);
  }

  const rg = request.nextUrl.searchParams.get("regime") ?? "competencia";
  const regime = (REGIMES.has(rg) ? rg : "competencia") as DreRegime;

  return NextResponse.json(await getDre(periodo, ref, regime));
}

export async function POST(req: Request) {
  const user = await getSession();
  if (user?.readOnly) return NextResponse.json({ error: "acesso somente leitura" }, { status: 403 });
  if (!user || user.role !== "gerencial") return NextResponse.json({ error: "não autorizado" }, { status: 401 });

  let b: { metaMargin?: number };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const meta = Number(b.metaMargin);
  if (!Number.isFinite(meta) || meta < 0 || meta > 100) {
    return NextResponse.json({ error: "Meta deve ser entre 0 e 100." }, { status: 400 });
  }
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });

  const supabase = await createClient();
  const { error } = await supabase
    .from("finance_settings")
    .upsert({ id: 1, meta_margin: meta, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) {
    if (/finance_settings.*does not exist|42P01/i.test(error.message)) {
      return NextResponse.json({ error: "Rode a migração 0132_finance_settings.sql." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, metaMargin: meta });
}
