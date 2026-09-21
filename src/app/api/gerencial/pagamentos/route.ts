import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { logFromUser } from "@/lib/audit/log";
import { podeAprovar } from "@/lib/data/approval";
import { bloqueioPorFechamento, periodoFechadoAte } from "@/lib/data/period-lock";
import { hojeSP } from "@/lib/data/dashboard-financeiro";
import { repartirPagamento } from "@/lib/data/pagamentos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Escrita de Pagamentos, sobre o núcleo transacional.
 *
 * Um pagamento não é um `update` num campo: é uma BAIXA (`settlements`) que
 * abate o saldo, mais uma MOVIMENTAÇÃO (`transactions`) do dinheiro que saiu
 * da conta, ligadas pela conciliação. O saldo da parcela não é escrito aqui —
 * o gatilho do banco recalcula (§23.4), e é isso que garante a invariante
 * mesmo para quem escrever por outra porta.
 *
 * Toda ação passa pelas mesmas travas: período fechado, alçada de aprovação e
 * auditoria. Não existe atalho sem registro (§22 da spec).
 */

type Corpo = {
  action?: string;
  installmentId?: string;
  /** Pagamento. */
  date?: string;
  valorCent?: number;
  quitar?: boolean;
  jurosCent?: number;
  multaCent?: number;
  accountId?: string | null;
  justificativaNota?: string;
  /** Informar valor real. */
  novoValorCent?: number;
  barcode?: string;
  /** Programar / cancelar / estornar. */
  scheduledFor?: string | null;
  motivo?: string;
};

type Linha = Record<string, unknown>;
const erro = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });

export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") return erro("não autorizado", 401);
  if (user.readOnly) return erro("acesso somente leitura", 403);
  if (!isSupabaseConfigured()) return erro("banco não configurado", 503);

  let b: Corpo;
  try {
    b = (await req.json()) as Corpo;
  } catch {
    return erro("JSON inválido");
  }
  const acao = String(b.action ?? "");
  const id = String(b.installmentId ?? "").trim();
  if (!id) return erro("parcela ausente");

  const db = await createClient();
  const hoje = hojeSP();

  const { data: parcela, error: eParcela } = await db
    .from("installments")
    .select("id, document_id, due_date, amount_cents, open_balance_cents, status, approval_status, amount_status, estimated_amount_cents, payment_details")
    .eq("id", id)
    .maybeSingle();
  if (eParcela) return erro(eParcela.message, 500);
  if (!parcela) return erro("parcela não encontrada", 404);
  const p = parcela as Linha;

  // Período fechado vale para qualquer escrita sobre a parcela (§17).
  const fechadoAte = await periodoFechadoAte(db);
  const trava = bloqueioPorFechamento(String(p.due_date ?? ""), fechadoAte);
  if (trava) return erro(trava, 409);

  await logFromUser(user, {
    action: acao,
    area: "Financeiro · pagamentos",
    target: id,
  });

  switch (acao) {
    case "pagar":
      return pagar(db, user, p, b, hoje);
    case "informar-valor":
      return informarValor(db, p, b);
    case "aprovar":
    case "rejeitar":
      return decidirAprovacao(db, user, p, acao, b);
    case "programar":
      return programar(db, p, b);
    case "cancelar":
      return cancelar(db, p, b);
    default:
      return erro("ação desconhecida");
  }
}

/* ── Registrar pagamento (spec §8) ─────────────────────────────────────── */

async function pagar(
  db: Awaited<ReturnType<typeof createClient>>,
  user: NonNullable<Awaited<ReturnType<typeof getSession>>>,
  p: Linha,
  b: Corpo,
  hoje: string,
) {
  if (p.status === "settled") return erro("Esta parcela já está liquidada.");
  // Sem valor confirmado não há o que baixar: pagar uma estimativa gravaria
  // um número que ninguém conferiu (§23 da spec, caso de borda).
  if (String(p.amount_status ?? "confirmed") === "estimated") {
    return erro("Informe o valor real antes de pagar: esta conta ainda está estimada.");
  }
  if (String(p.approval_status ?? "not_required") === "pending") {
    return erro("Parcela aguardando aprovação — um gestor precisa liberar antes do pagamento.", 409);
  }

  const data = String(b.date ?? hoje);
  if (data > hoje) return erro("A data do pagamento não pode ser no futuro.");

  const saldo = Number(p.open_balance_cents ?? 0);
  const pago = Math.round(Number(b.valorCent ?? saldo));
  if (!Number.isFinite(pago) || pago <= 0) return erro("valor inválido");

  const r = repartirPagamento({
    saldoCent: saldo,
    valorPagoCent: pago,
    quitar: Boolean(b.quitar),
    jurosInformadoCent: Math.round(Number(b.jurosCent ?? 0)),
    multaInformadaCent: Math.round(Number(b.multaCent ?? 0)),
  });

  const contaId = b.accountId || null;
  const { data: baixa, error: eBaixa } = await db
    .from("settlements")
    .insert({
      installment_id: String(p.id),
      date: data,
      principal_cents: r.principalCent,
      interest_cents: r.jurosCent,
      fine_cents: r.multaCent,
      discount_cents: r.descontoCent,
      financial_account_id: contaId,
      origin: "manual",
      missing_invoice_justification: b.justificativaNota?.trim() || null,
      created_by: user.name || user.email,
    })
    .select("id")
    .maybeSingle();
  if (eBaixa) return erro(eBaixa.message, 500);

  // A movimentação do dinheiro que saiu. Em conta com extrato ela nasce
  // `pending_confirmation` e é fundida com a linha do banco na conciliação
  // (§13.3) — é o que impede a mesma saída de ser contada duas vezes.
  let aguardandoExtrato = false;
  if (contaId && baixa) {
    const { data: conta } = await db
      .from("financial_accounts")
      .select("name, requires_statement_confirmation")
      .eq("id", contaId)
      .maybeSingle();
    aguardandoExtrato = (conta as Linha | null)?.requires_statement_confirmation !== false;

    const { data: mov } = await db
      .from("transactions")
      .insert({
        financial_account_id: contaId,
        date: data,
        // Saída é negativa: o sinal é o que diferencia entrada de saída (§5.2).
        // É o dinheiro que REALMENTE saiu — com desconto, é menor que o
        // principal, que fica cheio para não encolher o orçamento da categoria.
        amount_cents: -(r.principalCent - r.descontoCent + r.jurosCent + r.multaCent),
        description_raw: "Pagamento registrado no painel",
        origin: "manual",
        confirmation_status: aguardandoExtrato ? "pending_confirmation" : "confirmed",
      })
      .select("id")
      .maybeSingle();

    if (mov) {
      await db.from("reconciliation_links").insert({
        transaction_id: String((mov as Linha).id),
        settlement_id: String((baixa as Linha).id),
        amount_cents: r.principalCent,
        method: "manual",
        created_by: user.name || user.email,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    principalCent: r.principalCent,
    saldoRestanteCent: r.saldoRestanteCent,
    aguardandoExtrato,
  });
}

/* ── Informar valor real (spec §9) ─────────────────────────────────────── */

async function informarValor(
  db: Awaited<ReturnType<typeof createClient>>,
  p: Linha,
  b: Corpo,
) {
  const novo = Math.round(Number(b.novoValorCent ?? 0));
  if (!Number.isFinite(novo) || novo <= 0) return erro("valor inválido");
  if (p.status === "settled") return erro("Parcela já liquidada.");

  const jaPago = Number(p.amount_cents ?? 0) - Number(p.open_balance_cents ?? 0);
  if (novo < jaPago) {
    return erro("O valor informado é menor do que o já pago nesta parcela.");
  }

  const detalhes = {
    ...((p.payment_details ?? {}) as Record<string, unknown>),
    ...(b.barcode?.trim() ? { barcode: b.barcode.trim() } : {}),
  };

  const { error } = await db
    .from("installments")
    .update({
      amount_cents: novo,
      open_balance_cents: novo - jaPago,
      amount_status: "confirmed",
      // O estimado original vai para o histórico, não some (§9).
      estimated_amount_cents: p.estimated_amount_cents ?? Number(p.amount_cents ?? 0),
      payment_details: Object.keys(detalhes).length ? detalhes : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", String(p.id));
  if (error) return erro(error.message, 500);

  // O título tem de continuar fechando com as parcelas (§23.3).
  await ressincronizarTitulo(db, String(p.document_id));
  return NextResponse.json({ ok: true });
}

/**
 * Corrige o total do título e o item único depois que uma parcela muda de
 * valor. Sem isto, a invariante "soma dos itens = valor do título" quebra e o
 * Resultados passa a ler um número que a página de Pagamentos não mostra.
 */
async function ressincronizarTitulo(
  db: Awaited<ReturnType<typeof createClient>>,
  documentId: string,
) {
  const { data: parcelas } = await db
    .from("installments")
    .select("amount_cents")
    .eq("document_id", documentId);
  const total = ((parcelas ?? []) as Linha[])
    .reduce((s, x) => s + Math.round(Number(x.amount_cents) || 0), 0);

  await db.from("documents").update({ total_cents: total, updated_at: new Date().toISOString() })
    .eq("id", documentId);

  const { data: itens } = await db
    .from("document_items").select("id").eq("document_id", documentId);
  const lista = (itens ?? []) as Linha[];
  // Só dá para ajustar sozinho quando há um item: com rateio, mexer no valor
  // exigiria decidir de quem tirar — e isso é escolha de quem lançou.
  if (lista.length === 1) {
    await db.from("document_items").update({ amount_cents: total }).eq("id", String(lista[0].id));
  }
}

/* ── Aprovação (spec §14) ──────────────────────────────────────────────── */

async function decidirAprovacao(
  db: Awaited<ReturnType<typeof createClient>>,
  user: NonNullable<Awaited<ReturnType<typeof getSession>>>,
  p: Linha,
  acao: string,
  b: Corpo,
) {
  if (!podeAprovar(user.tier)) return erro("Só gestor ou admin aprova despesa.", 403);
  if (String(p.approval_status ?? "") !== "pending") return erro("Esta parcela não está aguardando aprovação.");
  // Rejeitar sem motivo devolve a conta ao solicitante sem dizer o que fazer.
  if (acao === "rejeitar" && !b.motivo?.trim()) return erro("Informe o motivo da recusa.");

  const { error } = await db
    .from("installments")
    .update({
      approval_status: acao === "aprovar" ? "approved" : "rejected",
      updated_at: new Date().toISOString(),
    })
    .eq("id", String(p.id));
  if (error) return erro(error.message, 500);
  return NextResponse.json({ ok: true });
}

/* ── Programar (spec §17) ──────────────────────────────────────────────── */

async function programar(
  db: Awaited<ReturnType<typeof createClient>>,
  p: Linha,
  b: Corpo,
) {
  if (p.status === "settled") return erro("Parcela já liquidada.");
  const { error } = await db
    .from("installments")
    .update({
      scheduled_payment_date: b.scheduledFor || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", String(p.id));
  if (error) return erro(error.message, 500);
  return NextResponse.json({ ok: true });
}

/* ── Cancelar (spec §17) ───────────────────────────────────────────────── */

async function cancelar(
  db: Awaited<ReturnType<typeof createClient>>,
  p: Linha,
  b: Corpo,
) {
  if (!b.motivo?.trim()) return erro("Cancelar exige motivo.");
  if (p.status === "settled") return erro("Parcela liquidada não é cancelada: estorne a baixa antes.");

  // Cancelar zera só o SALDO restante: a parte já paga permanece (§7.1).
  const { error } = await db
    .from("installments")
    .update({
      status: "cancelled",
      cancelled_reason: b.motivo.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", String(p.id));
  if (error) return erro(error.message, 500);
  return NextResponse.json({ ok: true });
}
