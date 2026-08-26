import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { EXPENSE_CATEGORIES } from "@/lib/data/gerfinance";
import { JANELA_ABERTA_MESES, planejarParcelas, type Recurrence } from "@/lib/data/expense-series";
import { logFromUser } from "@/lib/audit/log";
import { bloqueioPorFechamento, periodoFechadoAte } from "@/lib/data/period-lock";
import { getRegrasFinanceiras } from "@/lib/data/finance-guards-server";
import { bloqueioDePagamento, podeAprovar, statusInicial } from "@/lib/data/approval";

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
  action?: "create" | "update" | "delete" | "pay" | "unpay" | "approve" | "reject" | "reopen";
  id?: string;
  description?: string;
  category?: string;
  amount?: number;
  dueDate?: string;
  paidDate?: string;
  vendor?: string;
  status?: string;
  clientId?: string | null;
  /** Conta de onde o dinheiro sai — é o que permite conciliar com o banco. */
  accountId?: string | null;
  attachmentUrl?: string | null;
  invoiceNumber?: string | null;
  /** Motivo da recusa / observação da aprovação. */
  approvalNote?: string | null;
  // Recorrência (create): gera parcelas reais.
  recurrence?: string;      // monthly | weekly | yearly
  installments?: number;    // nº de parcelas; ignorado se openEnded
  openEnded?: boolean;      // sem fim — a rotina diária mantém a janela cheia
  // Alcance de update/delete numa série.
  scope?: "one" | "future"; // padrão: one
};

/** Colunas que só existem depois da 0138 — o insert tem de sobreviver sem elas. */
const COLS_0138 = ["approval_status", "invoice_number"] as const;

/** Erro do Postgres por coluna inexistente. */
const colunaFaltando = (msg: string) => /42703|column .* does not exist/i.test(msg);

/** Remove as colunas da 0138 de cada linha, para o retry sem migração. */
function semColunas0138<T extends Record<string, unknown>>(linhas: T[]): Record<string, unknown>[] {
  return linhas.map((l) => {
    const c = { ...l };
    for (const k of COLS_0138) delete c[k];
    return c;
  });
}

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

  // Período fechado: bloqueia mexer no passado já consolidado.
  const fechadoAte = await periodoFechadoAte(supabase);
  if (fechadoAte) {
    let dataAlvo = b.dueDate ?? null;
    if (!dataAlvo && b.id) {
      const { data: atual } = await supabase.from("expenses").select("due_date").eq("id", b.id).maybeSingle();
      dataAlvo = (atual as { due_date?: string | null } | null)?.due_date ?? null;
    }
    const bloqueio = bloqueioPorFechamento(dataAlvo, fechadoAte);
    if (bloqueio) return NextResponse.json({ error: bloqueio }, { status: 409 });
  }
  await logFromUser(user, { action, area: "Financeiro", target: b.description ?? b.id ?? null });
  const regras = await getRegrasFinanceiras(supabase);

  try {
    // ── Aprovar / recusar / reabrir (alçada) ───────────────────────────────
    if (action === "approve" || action === "reject" || action === "reopen") {
      if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
      if (!podeAprovar(user.tier)) {
        return NextResponse.json({ error: "Apenas gestor e admin aprovam despesas." }, { status: 403 });
      }
      const status = action === "approve" ? "approved" : action === "reject" ? "rejected" : "pending";
      const { error } = await supabase.from("expenses").update({
        approval_status: status,
        approved_by: action === "reopen" ? null : (user.name || user.email),
        approved_at: action === "reopen" ? null : new Date().toISOString(),
        approval_note: b.approvalNote?.trim() || null,
        updated_at: new Date().toISOString(),
      }).eq("id", b.id);
      if (error) throw error;
      return NextResponse.json({ ok: true, approvalStatus: status });
    }

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
      // Despesa acima da alçada só é paga depois de liberada.
      if (action === "pay") {
        const { data: atual } = await supabase.from("expenses").select("approval_status").eq("id", b.id).maybeSingle();
        const bloqueio = bloqueioDePagamento((atual as { approval_status?: string } | null)?.approval_status);
        if (bloqueio) return NextResponse.json({ error: bloqueio }, { status: 409 });
      }
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
      if (b.clientId !== undefined) patch.client_id = b.clientId || null;
      if (b.accountId !== undefined) patch.account_id = b.accountId || null;
      if (b.attachmentUrl !== undefined) patch.attachment_url = b.attachmentUrl || null;
      if (b.invoiceNumber !== undefined) patch.invoice_number = b.invoiceNumber?.trim() || null;

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
      let up = await supabase.from("expenses").update(patch).eq("id", b.id);
      if (up.error && colunaFaltando(up.error.message)) {
        delete patch.invoice_number;
        up = await supabase.from("expenses").update(patch).eq("id", b.id);
      }
      if (up.error) throw up.error;
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

    // Alçada: acima do limite a despesa nasce aguardando liberação.
    const approvalStatus = statusInicial(amount, regras.approvalThreshold);

    // Sem recorrência: uma linha só (comportamento antigo).
    if (!recorrencia) {
      const linha = {
        description, category, amount,
        approval_status: approvalStatus,
        invoice_number: b.invoiceNumber?.trim() || null,
        due_date: b.dueDate || null,
        paid_date: paid ? b.paidDate || today() : null,
        status: paid ? "paid" : "pending",
        recurring: false,
        vendor,
        client_id: b.clientId || null,
        account_id: b.accountId || null,
        created_by: user.id,
      };
      let r = await supabase.from("expenses").insert(linha).select("id").single();
      if (r.error && colunaFaltando(r.error.message)) {
        // Migração 0138 ainda não rodou: grava sem alçada e sem NF.
        r = await supabase.from("expenses").insert(semColunas0138([linha])[0]).select("id").single();
      }
      if (r.error) throw r.error;
      return NextResponse.json({ ok: true, persisted: true, id: r.data.id, parcelas: 1, approvalStatus });
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
      client_id: b.clientId || null,
      account_id: b.accountId || null,
      created_by: user.id,
      series_id: serieId,
      installment: aberta ? null : p.installment,
      installments_total: aberta ? null : plano.length,
      recurrence: recorrencia,
      open_ended: aberta,
      approval_status: approvalStatus,
    }));

    let ins = await supabase.from("expenses").insert(linhas);
    if (ins.error && colunaFaltando(ins.error.message)) ins = await supabase.from("expenses").insert(semColunas0138(linhas));
    if (ins.error) throw ins.error;
    return NextResponse.json({ ok: true, persisted: true, seriesId: serieId, parcelas: linhas.length, approvalStatus });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    if (/client_id|attachment_url/i.test(msg)) {
      return NextResponse.json({ error: "Rode a migração 0136_finance_completo.sql." }, { status: 409 });
    }
    if (/approval_status|approved_by|invoice_number/i.test(msg)) {
      return NextResponse.json({ error: "Rode a migração 0138_conciliacao_nf_encargos_alcada.sql." }, { status: 409 });
    }
    if (/series_id|installment|recurrence|open_ended|42703/i.test(msg)) {
      return NextResponse.json({ error: "Rode a migração 0130_expenses_series.sql." }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
