import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getAging, getIndicadores, getOrcamento } from "@/lib/data/finance-reports-server";
import { logFromUser } from "@/lib/audit/log";
import type { DrePeriodo } from "@/lib/data/dre";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PERIODOS = new Set(["mes", "trimestre", "ano"]);

/** Relatórios: orçamento, aging e indicadores. */
export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  const q = request.nextUrl.searchParams;
  const view = q.get("view") ?? "orcamento";

  if (view === "aging") return NextResponse.json(await getAging());
  if (view === "indicadores") {
    const p = q.get("periodo") ?? "mes";
    return NextResponse.json(await getIndicadores((PERIODOS.has(p) ? p : "mes") as DrePeriodo));
  }
  return NextResponse.json(await getOrcamento(q.get("mes") ?? undefined));
}

type Body = {
  action?: "budget" | "fechar" | "reabrir";
  month?: string;        // YYYY-MM
  categoryKey?: string;
  amount?: number;
  closedUntil?: string;  // YYYY-MM-DD
};

export async function POST(req: Request) {
  const user = await getSession();
  if (user?.readOnly) return NextResponse.json({ error: "acesso somente leitura" }, { status: 403 });
  if (!user || user.role !== "gerencial") return NextResponse.json({ error: "não autorizado" }, { status: 401 });

  let b: Body;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });
  const supabase = await createClient();

  try {
    // Fechamento de período: trava alterações até a data.
    if (b.action === "fechar" || b.action === "reabrir") {
      const ate = b.action === "reabrir" ? null : b.closedUntil;
      if (b.action === "fechar" && !ate) return NextResponse.json({ error: "Informe a data de fechamento." }, { status: 400 });
      await logFromUser(user, { action: b.action, area: "Financeiro · fechamento", target: ate });
      const { error } = await supabase.from("finance_settings").upsert(
        { id: 1, closed_until: ate, closed_by: ate ? (user.name || user.email) : null, closed_at: ate ? new Date().toISOString() : null },
        { onConflict: "id" },
      );
      if (error) throw error;
      return NextResponse.json({ ok: true, closedUntil: ate });
    }

    // Orçamento de uma categoria no mês.
    const mes = String(b.month ?? "");
    if (!/^\d{4}-\d{2}$/.test(mes)) return NextResponse.json({ error: "Mês inválido." }, { status: 400 });
    const chave = String(b.categoryKey ?? "").trim();
    if (!chave) return NextResponse.json({ error: "Categoria ausente." }, { status: 400 });
    const valor = Number(b.amount);
    if (!Number.isFinite(valor) || valor < 0) return NextResponse.json({ error: "Valor inválido." }, { status: 400 });

    const { error } = await supabase.from("budgets").upsert(
      { month: `${mes}-01`, category_key: chave, amount: valor, updated_at: new Date().toISOString() },
      { onConflict: "month,category_key" },
    );
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    if (/budgets.*does not exist|closed_until|42P01|42703/i.test(msg)) {
      return NextResponse.json({ error: "Rode a migração 0137_budget_and_closing.sql." }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
