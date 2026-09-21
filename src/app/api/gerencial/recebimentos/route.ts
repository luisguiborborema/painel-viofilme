import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { logFromUser } from "@/lib/audit/log";
import { bloqueioPorFechamento, periodoFechadoAte } from "@/lib/data/period-lock";
import { hojeSP } from "@/lib/data/dashboard-financeiro";
import { repartirPagamento } from "@/lib/data/pagamentos";
import { brlExato, MOTIVOS_DISPENSA } from "@/lib/data/recebimentos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Escrita de Recebimentos, sobre o núcleo transacional.
 *
 * Receber não é um `update` num campo: é uma BAIXA (`settlements`) que abate o
 * saldo, mais uma MOVIMENTAÇÃO (`transactions`) do dinheiro que entrou na
 * conta, ligadas pela conciliação. O saldo e o status da parcela não são
 * escritos aqui — o gatilho do banco recalcula (§23.4), e é isso que faz a
 * invariante valer para qualquer porta de escrita.
 *
 * A repartição entre principal, encargos e desconto é a mesma de Pagamentos
 * (`repartirPagamento`): a matemática da baixa não muda com a direção do
 * dinheiro, e duplicá-la só criaria duas versões para divergirem.
 */

type Corpo = {
  action?: string;
  installmentId?: string;
  date?: string;
  valorCent?: number;
  /** Menor que o saldo: quitar com desconto (true) ou deixar parcial (false). */
  quitar?: boolean;
  jurosCent?: number;
  multaCent?: number;
  accountId?: string | null;
  /** Dispensa de encargos (§6.2): exige motivo da lista. */
  dispensarEncargos?: boolean;
  motivoDispensa?: string;
  /** Contato, promessa e etapa manual (§9.4). */
  tipo?: string;
  nota?: string;
  resultado?: string;
  canal?: string;
  partyId?: string;
  promessaData?: string;
};

type Linha = Record<string, unknown>;
const cent = (v: unknown) => Math.round(Number(v) || 0);
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
  const db = await createClient();
  const hoje = hojeSP();

  // Contato e promessa são do cliente, não de uma parcela: seguem por outro
  // caminho, sem exigir `installmentId`.
  if (acao === "registrar-contato" || acao === "registrar-promessa" || acao === "marcar-etapa") {
    await logFromUser(user, {
      action: acao, area: "Financeiro · recebimentos", target: String(b.partyId ?? ""),
    });
    return acao === "registrar-promessa"
      ? registrarPromessa(db, user, b, hoje)
      : registrarEvento(db, user, b, acao);
  }

  const id = String(b.installmentId ?? "").trim();
  if (!id) return erro("parcela ausente");

  const { data: parcela, error: eParcela } = await db
    .from("installments")
    .select("id, document_id, due_date, amount_cents, open_balance_cents, status")
    .eq("id", id)
    .maybeSingle();
  if (eParcela) return erro(eParcela.message, 500);
  if (!parcela) return erro("parcela não encontrada", 404);
  const p = parcela as Linha;

  // Período fechado vale para qualquer escrita sobre a parcela (§17).
  const trava = bloqueioPorFechamento(String(p.due_date ?? ""), await periodoFechadoAte(db));
  if (trava) return erro(trava, 409);

  await logFromUser(user, {
    action: acao, area: "Financeiro · recebimentos", target: id,
  });

  if (acao === "receber") return receber(db, user, p, b, hoje);
  return erro("ação desconhecida");
}

/* ── Registrar recebimento (spec §6) ───────────────────────────────────── */

async function receber(
  db: Awaited<ReturnType<typeof createClient>>,
  user: NonNullable<Awaited<ReturnType<typeof getSession>>>,
  p: Linha,
  b: Corpo,
  hoje: string,
) {
  const status = String(p.status ?? "open");
  if (status === "settled") return erro("Esta parcela já está liquidada.");
  if (status === "cancelled" || status === "renegotiated") {
    return erro("Parcela encerrada: não há saldo a receber.");
  }

  const data = String(b.date ?? hoje);
  if (data > hoje) return erro("A data do recebimento não pode ser no futuro.");

  const saldo = cent(p.open_balance_cents);
  const recebido = cent(b.valorCent ?? saldo);
  if (!Number.isFinite(recebido) || recebido <= 0) return erro("valor inválido");

  // Dispensar encargos exige motivo da lista (§6.2). Sem ele, a dispensa
  // ficaria sem explicação na auditoria — que é a única razão de registrá-la.
  const dispensou = Boolean(b.dispensarEncargos);
  const motivo = String(b.motivoDispensa ?? "").trim();
  if (dispensou && !MOTIVOS_DISPENSA.some((m) => m.key === motivo || m.label === motivo)) {
    return erro("Escolha o motivo da dispensa de encargos.");
  }

  const juros = dispensou ? 0 : Math.max(0, cent(b.jurosCent ?? 0));
  const multa = dispensou ? 0 : Math.max(0, cent(b.multaCent ?? 0));

  const r = repartirPagamento({
    saldoCent: saldo,
    valorPagoCent: recebido,
    quitar: Boolean(b.quitar),
    jurosInformadoCent: juros,
    multaInformadaCent: multa,
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
      fee_waived: dispensou,
      fee_waiver_reason: dispensou
        ? (MOTIVOS_DISPENSA.find((m) => m.key === motivo)?.label ?? motivo)
        : null,
      // O encargo dispensado fica registrado: é receita de que se abriu mão,
      // e sem o número não há como medir quanto a cortesia custou no ano.
      waived_amount_cents: dispensou
        ? Math.max(0, cent(b.jurosCent ?? 0)) + Math.max(0, cent(b.multaCent ?? 0))
        : 0,
      financial_account_id: contaId,
      origin: "manual",
      created_by: user.name || user.email,
    })
    .select("id")
    .maybeSingle();
  if (eBaixa) return erro(eBaixa.message, 500);

  // A movimentação do dinheiro que entrou. Em conta com extrato ela nasce
  // `pending_confirmation` e é fundida com a linha do banco na conciliação
  // (§13.3) — é o que impede a mesma entrada de ser contada duas vezes.
  let aguardandoExtrato = false;
  let nomeDaConta: string | null = null;
  if (contaId && baixa) {
    const { data: conta } = await db
      .from("financial_accounts")
      .select("name, requires_statement_confirmation")
      .eq("id", contaId)
      .maybeSingle();
    aguardandoExtrato = (conta as Linha | null)?.requires_statement_confirmation !== false;
    nomeDaConta = (conta as Linha | null)?.name ? String((conta as Linha).name) : null;

    const { data: mov } = await db
      .from("transactions")
      .insert({
        financial_account_id: contaId,
        date: data,
        // Entrada é positiva (§5.2). É o dinheiro que REALMENTE entrou: com
        // desconto, menor que o principal, que fica cheio para a receita da
        // categoria não encolher por causa de uma negociação.
        amount_cents: r.principalCent - r.descontoCent + r.jurosCent + r.multaCent,
        description_raw: "Recebimento registrado no painel",
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
    conta: nomeDaConta,
    // O toast é montado aqui porque quem sabe o que aconteceu é quem gravou.
    mensagem: [
      `Recebimento registrado: ${brlExato(r.principalCent - r.descontoCent + r.jurosCent + r.multaCent)}.`,
      r.saldoRestanteCent > 0 ? `Saldo de ${brlExato(r.saldoRestanteCent)} segue em aberto.` : null,
      aguardandoExtrato && nomeDaConta ? `Aguardando confirmação no extrato ${nomeDaConta}.` : null,
    ].filter(Boolean).join(" "),
  });
}

/* ── Linha do tempo da cobrança (§9.4) ─────────────────────────────────── */

const TIPOS_EVENTO = new Set([
  "charge_sent", "reminder", "overdue_notice", "whatsapp", "cs_triggered",
  "escalation", "contact", "promise", "promise_broken", "renegotiation",
  "pause", "resume", "write_off",
]);

const RESULTADOS = new Set(["nao_atendeu", "vai_pagar", "pediu_prazo", "contestou"]);

async function registrarEvento(
  db: Awaited<ReturnType<typeof createClient>>,
  user: NonNullable<Awaited<ReturnType<typeof getSession>>>,
  b: Corpo,
  acao: string,
) {
  const partyId = String(b.partyId ?? "").trim();
  if (!partyId) {
    return erro("Sem cliente vinculado não há a quem registrar o contato.");
  }
  const tipo = acao === "marcar-etapa" ? String(b.tipo ?? "whatsapp") : "contact";
  if (!TIPOS_EVENTO.has(tipo)) return erro("tipo de evento desconhecido");

  const resultado = String(b.resultado ?? "").trim();
  if (acao === "registrar-contato" && resultado && !RESULTADOS.has(resultado)) {
    return erro("resultado desconhecido");
  }

  const { error } = await db.from("collection_events").insert({
    party_id: partyId,
    installment_id: b.installmentId || null,
    type: tipo,
    channel: b.canal?.trim() || null,
    // Registrado por gente: a automação entra com `automatic = true` e autor
    // "sistema", e misturar os dois apagaria quem de fato falou com o cliente.
    automatic: false,
    result: resultado || null,
    note: b.nota?.trim() || null,
    created_by: user.name || user.email,
  });
  if (error) return erro(error.message, 500);
  return (revalidateTag("financeiro", { expire: 0 }), NextResponse.json({ ok: true }));
}

/* ── Promessa de pagamento (§9.6) ──────────────────────────────────────── */

async function registrarPromessa(
  db: Awaited<ReturnType<typeof createClient>>,
  user: NonNullable<Awaited<ReturnType<typeof getSession>>>,
  b: Corpo,
  hoje: string,
) {
  const partyId = String(b.partyId ?? "").trim();
  if (!partyId) return erro("Sem cliente vinculado não há promessa a registrar.");

  const data = String(b.promessaData ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return erro("Informe a data prometida.");
  // Promessa para ontem não pausa nada: já nasceria quebrada (§18).
  if (data < hoje) return erro("A data prometida não pode ser anterior a hoje.");

  const { data: promessa, error } = await db
    .from("payment_promises")
    .insert({
      party_id: partyId,
      installment_ids: b.installmentId ? [b.installmentId] : [],
      promised_date: data,
      amount_cents: Math.max(0, cent(b.valorCent ?? 0)),
      status: "active",
      created_by: user.name || user.email,
    })
    .select("id")
    .maybeSingle();
  if (error) return erro(error.message, 500);

  // A promessa também é um evento: a linha do tempo precisa mostrar quando
  // alguém prometeu, não só que existe uma promessa ativa.
  await db.from("collection_events").insert({
    party_id: partyId,
    installment_id: b.installmentId || null,
    type: "promise",
    automatic: false,
    note: `Promessa de pagamento para ${data.split("-").reverse().join("/")}`,
    created_by: user.name || user.email,
  });

  return (revalidateTag("financeiro", { expire: 0 }), NextResponse.json({ ok: true, id: promessa ? String((promessa as Linha).id) : null }));
}
