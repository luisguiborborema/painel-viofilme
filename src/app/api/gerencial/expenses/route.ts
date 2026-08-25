import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { EXPENSE_CATEGORIES } from "@/lib/data/gerfinance";
import { JANELA_ABERTA_MESES, planejarParcelas, type Recurrence } from "@/lib/data/expense-series";
import { logFromUser } from "@/lib/audit/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Chaves válidas: as cadastradas (0133) ou as padrão, se a migração não rodou. */
async function chavesValidas(db: Awaited<ReturnType<typeof createClient>>): Promise<Set<string>> {
  const { data, error } = await db.from("expense_categories").select("key");
  if (error || !data?.length) return new Set(EXPENSE_CATEGORIES.map((c) => c.key));
  return new Set(data.map((c) => String((c as { key: unknown }).key)));
}
const RECS = new Set<string>(["monthly", "weekly", "yearly"]);
const today = () => new Date().toISOString().slice(0, 10);

type Body = {
  action?: "create" | "update" | "delete" | "pay" | "unpay";
  id?: string;
  description?: string;
  category?: string;
  amount?: number;
  dueDate?: string;
  paidDate?: string;
  vendor?: string;
  status?: string;
  // Recorrência (create): gera parcelas reais.
  recurrence?: string;      // monthly | weekly | yearly
  installments?: number;    // nº de parcelas; ignorado se openEnded
  openEnded?: boolean;      // sem fim — a rotina diária mantém a janela cheia
  // Alcance de update/delete numa série.
  scope?: "one" | "future"; // padrão: one
};

/** Contas a pagar / despesas da agência (gerencial). */
export async function POST(req: Request) {
  const user = await getSession();
  if (user?.readOnly) return NextResponse.json({ error: "acesso somente leitura" }, { status: 403 });
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  let b: Body;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });
  const supabase = await createClient();
  const CATS = await chavesValidas(supabase);
  const action = b.action ?? "create";
  await logFromUser(user, { action, area: "Financeiro", target: b.description ?? b.id ?? null });

  try {
    // ── Excluir (uma parcela ou esta e as futuras) ──────────────────────────
    if (action === "delete") {
      if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
      if (b.scope === "future") {
        const { data: alvo } = await supabase
          .from("expenses")
          .select("series_id, due_date")
          .eq("id", b.id)
          .maybeSingle();
        const serie = (alvo as { series_id?: string | null } | null)?.series_id;
        const venc = (alvo as { due_date?: string | null } | null)?.due_date;
        if (serie && venc) {
          // Só as ainda não pagas: histórico pago não se apaga por engano.
          const { error, count } = await supabase
            .from("expenses")
            .delete({ count: "exact" })
            .eq("series_id", serie)
            .gte("due_date", venc)
            .eq("status", "pending");
          if (error) throw error;
          return NextResponse.json({ ok: true, persisted: true, removidas: count ?? 0 });
        }
      }
      const { error } = await supabase.from("expenses").delete().eq("id", b.id);
      if (error) throw error;
      return NextResponse.json({ ok: true, persisted: true, removidas: 1 });
    }

    // ── Baixar / estornar ──────────────────────────────────────────────────
    if (action === "pay" || action === "unpay") {
      if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
      const patch =
        action === "pay"
          ? { status: "paid", paid_date: b.paidDate || today() }
          : { status: "pending", paid_date: null };
      const { error } = await supabase
        .from("expenses")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", b.id);
      if (error) throw error;
      return NextResponse.json({ ok: true, persisted: true });
    }

    // ── Editar (uma parcela ou esta e as futuras) ──────────────────────────
    if (action === "update") {
      if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (b.description !== undefined) {
        const d = b.description.trim();
        if (!d) return NextResponse.json({ error: "descrição não pode ficar vazia" }, { status: 400 });
        patch.description = d;
      }
      if (b.amount !== undefined) {
        const v = Number(b.amount);
        if (!Number.isFinite(v) || v <= 0) return NextResponse.json({ error: "valor inválido" }, { status: 400 });
        patch.amount = v;
      }
      if (b.category !== undefined) patch.category = CATS.has(b.category) ? b.category : "outros";
      if (b.vendor !== undefined) patch.vendor = b.vendor.trim() || null;

      if (b.scope === "future") {
        const { data: alvo } = await supabase
          .from("expenses")
          .select("series_id, due_date")
          .eq("id", b.id)
          .maybeSingle();
        const serie = (alvo as { series_id?: string | null } | null)?.series_id;
        const venc = (alvo as { due_date?: string | null } | null)?.due_date;
        if (serie && venc) {
          // Vencimento não é propagado: cada parcela tem o seu.
          delete patch.due_date;
          const { error, count } = await supabase
            .from("expenses")
            .update(patch, { count: "exact" })
            .eq("series_id", serie)
            .gte("due_date", venc)
            .eq("status", "pending");
          if (error) throw error;
          return NextResponse.json({ ok: true, persisted: true, atualizadas: count ?? 0 });
        }
      }
      // Só nesta parcela o vencimento pode mudar.
      if (b.dueDate !== undefined) patch.due_date = b.dueDate || null;
      const { error } = await supabase.from("expenses").update(patch).eq("id", b.id);
      if (error) throw error;
      return NextResponse.json({ ok: true, persisted: true, atualizadas: 1 });
    }

    // ── Criar (avulsa ou série de parcelas) ────────────────────────────────
    const description = (b.description ?? "").trim();
    const amount = Number(b.amount);
    if (!description || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "descrição e valor são obrigatórios" }, { status: 400 });
    }
    const category = b.category && CATS.has(b.category) ? b.category : "outros";
    const vendor = b.vendor?.trim() || null;
    const paid = b.status === "paid";
    const primeiro = b.dueDate || today();
    const recorrencia = b.recurrence && RECS.has(b.recurrence) ? (b.recurrence as Recurrence) : null;

    // Sem recorrência: uma linha só (comportamento antigo).
    if (!recorrencia) {
      const { data, error } = await supabase
        .from("expenses")
        .insert({
          description, category, amount,
          due_date: b.dueDate || null,
          paid_date: paid ? b.paidDate || today() : null,
          status: paid ? "paid" : "pending",
          recurring: false,
          vendor,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (error) throw error;
      return NextResponse.json({ ok: true, persisted: true, id: data.id, parcelas: 1 });
    }

    // Com recorrência: gera as parcelas de verdade, agrupadas por series_id.
    const aberta = Boolean(b.openEnded);
    const qtd = aberta ? JANELA_ABERTA_MESES : Math.max(1, Math.round(Number(b.installments) || 1));
    const plano = planejarParcelas(primeiro, recorrencia, qtd);
    const serieId = crypto.randomUUID();

    const linhas = plano.map((p) => ({
      description, category, amount,
      due_date: p.dueDate,
      paid_date: null,
      status: "pending",
      recurring: true,
      vendor,
      created_by: user.id,
      series_id: serieId,
      installment: aberta ? null : p.installment,
      installments_total: aberta ? null : plano.length,
      recurrence: recorrencia,
      open_ended: aberta,
    }));

    const { error } = await supabase.from("expenses").insert(linhas);
    if (error) throw error;
    return NextResponse.json({ ok: true, persisted: true, seriesId: serieId, parcelas: linhas.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    if (/series_id|installment|recurrence|open_ended|42703/i.test(msg)) {
      return NextResponse.json({ error: "Rode a migração 0130_expenses_series.sql." }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
