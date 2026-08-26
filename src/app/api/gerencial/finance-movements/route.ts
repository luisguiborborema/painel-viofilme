import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getMovimentacoes, type MovKind } from "@/lib/data/movements-server";
import { getCashflow } from "@/lib/data/cashflow-server";
import { getRentabilidade } from "@/lib/data/profitability-server";
import type { DrePeriodo } from "@/lib/data/dre";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KINDS = new Set(["entrada", "saida", "transferencia"]);
const PERIODOS = new Set(["mes", "trimestre", "ano"]);

/**
 * Visões consolidadas: extrato (`view=extrato`), fluxo de caixa projetado
 * (`view=fluxo`) e rentabilidade por cliente (`view=rentabilidade`).
 */
export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  const q = request.nextUrl.searchParams;
  const view = q.get("view") ?? "extrato";

  if (view === "fluxo") {
    return NextResponse.json(await getCashflow(Number(q.get("semanas") ?? 12)));
  }
  if (view === "rentabilidade") {
    const p = q.get("periodo") ?? "mes";
    return NextResponse.json(await getRentabilidade((PERIODOS.has(p) ? p : "mes") as DrePeriodo));
  }

  const kind = q.get("kind");
  return NextResponse.json(
    await getMovimentacoes({
      from: q.get("from") ?? undefined,
      to: q.get("to") ?? undefined,
      accountId: q.get("conta") ?? undefined,
      kind: kind && KINDS.has(kind) ? (kind as MovKind) : undefined,
      situacao: q.get("situacao") ?? undefined,
    }),
  );
}

type Body = {
  action?: "reconciliar" | "desreconciliar";
  /** id no formato "p-<uuid>" (recebimento) ou "e-<uuid>" (despesa). */
  ids?: string[];
};

/** Conciliação: marca o que de fato caiu/saiu da conta. */
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

  const ids = (b.ids ?? []).filter(Boolean);
  if (ids.length === 0) return NextResponse.json({ error: "Nada selecionado." }, { status: 400 });

  const quando = b.action === "desreconciliar" ? null : new Date().toISOString();
  const supabase = await createClient();

  const pagamentos = ids.filter((i) => i.startsWith("p-")).map((i) => i.slice(2));
  const despesas = ids.filter((i) => i.startsWith("e-")).map((i) => i.slice(2));

  try {
    let total = 0;
    if (pagamentos.length) {
      const { error, count } = await supabase
        .from("payments")
        .update({ reconciled_at: quando }, { count: "exact" })
        .in("id", pagamentos);
      if (error) throw error;
      total += count ?? 0;
    }
    if (despesas.length) {
      const { error, count } = await supabase
        .from("expenses")
        .update({ reconciled_at: quando }, { count: "exact" })
        .in("id", despesas);
      if (error) throw error;
      total += count ?? 0;
    }
    return NextResponse.json({ ok: true, atualizados: total });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    if (/reconciled_at|42703/i.test(msg)) {
      return NextResponse.json({ error: "Rode a migração 0136_finance_completo.sql." }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
