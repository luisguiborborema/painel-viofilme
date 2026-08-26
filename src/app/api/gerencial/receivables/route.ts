import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { MANUAL_METHODS } from "@/lib/data/gerfinance";
import { planejarParcelas, type Recurrence } from "@/lib/data/expense-series";
import { logFromUser } from "@/lib/audit/log";
import { bloqueioPorFechamento, periodoFechadoAte } from "@/lib/data/period-lock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const METHODS = new Set(MANUAL_METHODS.map((m) => m.key));
const RECS = new Set(["monthly", "weekly", "yearly"]);
const today = () => new Date().toISOString().slice(0, 10);
const clean = (v?: string) => (v && v.trim() ? v.trim() : null);

type Body = {
  action?: "create" | "update" | "delete" | "receive" | "unreceive";
  id?: string;
  clientId?: string;
  description?: string;
  value?: number;
  dueDate?: string;
  paymentDate?: string;
  method?: string;
  accountId?: string;
  note?: string;
  status?: string;
  // parcelamento
  installments?: number;
  recurrence?: string;
};

/**
 * Recebíveis MANUAIS — entradas fora do Asaas (PIX, dinheiro, permuta…).
 *
 * Gravam na mesma tabela `payments`, com source='manual' e asaas_payment_id
 * nulo. O webhook do Asaas faz upsert por asaas_payment_id, então nunca toca
 * nestas linhas. Como é a mesma tabela, DRE, fluxo de caixa e inadimplência já
 * enxergam esses valores sem lógica extra.
 */
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
  const action = b.action ?? "create";
  await logFromUser(user, { action, area: "Financeiro · recebíveis", target: b.description ?? b.id ?? null });

  const fechadoAte = await periodoFechadoAte(supabase);
  if (fechadoAte) {
    let dataAlvo = b.dueDate ?? null;
    if (!dataAlvo && b.id) {
      const { data: atual } = await supabase.from("payments").select("due_date").eq("id", b.id).maybeSingle();
      dataAlvo = (atual as { due_date?: string | null } | null)?.due_date ?? null;
    }
    const bloqueio = bloqueioPorFechamento(dataAlvo, fechadoAte);
    if (bloqueio) return NextResponse.json({ error: bloqueio }, { status: 409 });
  }

  /** Trava: só lançamento manual pode ser alterado por aqui. */
  async function ehManual(id: string): Promise<boolean> {
    const { data } = await supabase.from("payments").select("source").eq("id", id).maybeSingle();
    return String((data as { source?: string } | null)?.source ?? "asaas") === "manual";
  }

  try {
    if (action === "delete" || action === "update" || action === "receive" || action === "unreceive") {
      if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
      if (!(await ehManual(b.id))) {
        return NextResponse.json(
          { error: "Cobranças do Asaas não podem ser editadas aqui — altere no próprio Asaas." },
          { status: 403 },
        );
      }
    }

    if (action === "delete") {
      const { error } = await supabase.from("payments").delete().eq("id", b.id!);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === "receive" || action === "unreceive") {
      const patch =
        action === "receive"
          ? { status: "RECEIVED", payment_date: b.paymentDate || today() }
          : { status: "PENDING", payment_date: null };
      const { error } = await supabase.from("payments").update(patch).eq("id", b.id!);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === "update") {
      const patch: Record<string, unknown> = {};
      if (b.description !== undefined) patch.description = clean(b.description);
      if (b.value !== undefined) {
        const v = Number(b.value);
        if (!Number.isFinite(v) || v <= 0) return NextResponse.json({ error: "valor inválido" }, { status: 400 });
        patch.value = v;
        patch.net_value = v;
      }
      if (b.dueDate !== undefined) patch.due_date = b.dueDate || null;
      if (b.clientId !== undefined) patch.client_id = clean(b.clientId);
      if (b.method !== undefined) patch.billing_type = METHODS.has(String(b.method)) ? b.method : "OTHER";
      if (b.accountId !== undefined) patch.account_id = clean(b.accountId);
      if (b.note !== undefined) patch.note = clean(b.note);
      const { error } = await supabase.from("payments").update(patch).eq("id", b.id!);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    // ── criar (avulso ou parcelado) ───────────────────────────────────────
    const descricao = clean(b.description);
    const valor = Number(b.value);
    if (!descricao || !Number.isFinite(valor) || valor <= 0) {
      return NextResponse.json({ error: "descrição e valor são obrigatórios" }, { status: 400 });
    }
    const recebido = b.status === "received";
    const metodo = METHODS.has(String(b.method)) ? b.method : "PIX";
    const primeiro = b.dueDate || today();
    const recorrencia = b.recurrence && RECS.has(b.recurrence) ? (b.recurrence as Recurrence) : "monthly";
    const qtd = Math.max(1, Math.round(Number(b.installments) || 1));
    const plano = planejarParcelas(primeiro, recorrencia, qtd);

    const linhas = plano.map((p) => ({
      asaas_payment_id: null,
      source: "manual",
      client_id: clean(b.clientId),
      status: recebido && plano.length === 1 ? "RECEIVED" : "PENDING",
      billing_type: metodo,
      value: valor,
      net_value: valor,
      due_date: p.dueDate,
      payment_date: recebido && plano.length === 1 ? b.paymentDate || today() : null,
      description: plano.length > 1 ? `${descricao} (${p.installment}/${plano.length})` : descricao,
      account_id: clean(b.accountId),
      note: clean(b.note),
    }));

    const { error } = await supabase.from("payments").insert(linhas);
    if (error) throw error;
    return NextResponse.json({ ok: true, parcelas: linhas.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    if (/source|account_id|note|42703/i.test(msg) || /null value in column "asaas_payment_id"/i.test(msg)) {
      return NextResponse.json({ error: "Rode a migração 0131_financial_accounts.sql." }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
