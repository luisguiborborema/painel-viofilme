import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { bloqueioPorFechamento, periodoFechadoAte } from "@/lib/data/period-lock";
import { ddmm, diasEntre, hojeSP } from "@/lib/data/dashboard-financeiro";
import {
  brlExato, calcularEncargosReceber, chipDeRecebimento, estadoDaRegua, linhaDaCobranca,
  rotuloDeRecebimento, SITUACAO_RECEBER_TOM, type EtapaRegua,
} from "@/lib/data/recebimentos";
import type { StatusParcela } from "@/lib/data/pagamentos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ficha da conta a receber (spec §5).
 *
 * É a ficha universal do documento-mãe (§22), invocada por `installment_id`.
 * Tudo sai do núcleo: itens com as dimensões, baixas com encargos, cobrança
 * com as etapas e a frase da régua — que é derivada, não gravada (§14.5).
 */

type Linha = Record<string, unknown>;
const cent = (v: unknown) => Math.round(Number(v) || 0);

/**
 * As linhas de uma consulta, sem os tipos do supabase-js no caminho.
 *
 * Sem tipos gerados do banco, um select com embed volta tipado como erro
 * estático. Quem interpreta os campos é o código abaixo, um a um.
 */
const linhas = (r: { data: unknown }): Linha[] => (r.data ?? []) as Linha[];

const texto = (...v: unknown[]) => {
  for (const x of v) { const t = String(x ?? "").trim(); if (t) return t; }
  return "";
};

const MESES = ["", "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const TIPO_EVENTO: Record<string, string> = {
  charge_sent: "Cobrança enviada", reminder: "Lembrete enviado",
  overdue_notice: "Aviso de atraso", whatsapp: "WhatsApp enviado",
  cs_triggered: "CS acionado", escalation: "Escalado para a diretoria",
  contact: "Contato registrado", promise: "Promessa registrada",
  promise_broken: "Promessa quebrada", renegotiation: "Renegociação",
  pause: "Régua pausada", resume: "Régua retomada", write_off: "Registrado como perda",
};

export type EtapaCobranca = { nome: string; data: string | null; concluida: boolean };

export type FichaRecebimento = {
  id: string;
  documentId: string;
  cliente: string;
  clienteVinculado: boolean;
  descricao: string;
  valorCent: number;
  saldoCent: number;
  recebidoCent: number;
  encargosCent: number;
  atualizadoCent: number;
  /** Linha auxiliar do cabeçalho (§5.1): muda com a situação. */
  subSaldo: string;
  situacaoLabel: string;
  situacaoTom: string;
  cobranca: { texto: string; tom: string };
  origem: string;
  vencimento: string;
  competencia: string;
  parcela: string;
  /** Mini linha do tempo: uma bolinha por parcela do título (§5.2). */
  parcelas: { id: string; numero: number; paga: boolean; atual: boolean; label: string }[];
  contaPrevista: string | null;
  formaCobranca: string;
  nf: string | null;
  itens: { descricao: string; dimensoes: string; valor: string }[];
  etapas: EtapaCobranca[];
  linkPagamento: string | null;
  fraseDaRegua: string;
  destinatarios: string | null;
  baixas: {
    data: string; valor: string; encargos: string | null; conta: string | null;
    conciliacao: string; conciliada: boolean;
  }[];
  anexos: { kind: string; rotulo: string; anexado: boolean }[];
  historico: { quando: string; texto: string }[];
  /** Decisões tomadas no servidor: a tela não recalcula permissão. */
  podeReceber: boolean;
  bloqueioReceber: string | null;
  recebida: boolean;
  contas: { id: string; nome: string; exigeExtrato: boolean }[];
  contaSugeridaId: string | null;
  /** Encargos sugeridos para o modal (§6.2). */
  sugestao: {
    diasAtraso: number; multaCent: number; jurosCent: number;
    totalCent: number; detalhe: string | null; valorSugeridoCent: number;
  };
};

export async function GET(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "banco não configurado" }, { status: 503 });
  }
  const id = String(new URL(req.url).searchParams.get("id") ?? "").trim();
  if (!id) return NextResponse.json({ error: "id ausente" }, { status: 400 });

  const db = await createClient();
  const hoje = hojeSP();

  const { data, error } = await db
    .from("installments")
    .select(
      "id, document_id, number, total_number, due_date, competence_month, amount_cents, " +
      "open_balance_cents, status, original_due_date, created_at, " +
      "doc:documents!installments_document_id_fkey(id, description, origin, recurrence_id, " +
      "client_id, nf_number, nf_date, created_at, created_by, clients(id, name), " +
      "party:parties!documents_party_id_fkey(id, name, billing_emails, billing_whatsapp, " +
      "default_billing_method, default_account_id, custom_fine_pct, custom_interest_pct))",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "parcela não encontrada" }, { status: 404 });

  // O parser de tipos do supabase-js não resolve o embed com FK nomeada e
  // devolve um tipo de erro no lugar do objeto. A leitura é campo a campo.
  const p = data as unknown as Linha;
  const doc = (Array.isArray(p.doc) ? p.doc[0] : p.doc) as Linha | undefined;
  const party = doc ? (Array.isArray(doc.party) ? doc.party[0] : doc.party) as Linha | undefined : undefined;
  const cliente = doc ? (Array.isArray(doc.clients) ? doc.clients[0] : doc.clients) as Linha | undefined : undefined;
  const partyId = party?.id ? String(party.id) : null;

  const [itensRes, baixasRes, cobrancasRes, anexosRes, contasRes, irmasRes,
    etapasRes, eventosRes, promessasRes, fechadoAte] = await Promise.all([
    db.from("document_items")
      .select("amount_cents, description, category_key, services(label), clients(name), cost_centers(name)")
      .eq("document_id", String(p.document_id)),
    db.from("settlements")
      .select("date, principal_cents, interest_cents, fine_cents, discount_cents, " +
        "fee_waived, fee_waiver_reason, financial_account_id, origin, reversed_at")
      .eq("installment_id", id).order("date", { ascending: false }),
    db.from("charges").select("method, provider, url, status, sent_at, created_at")
      .eq("installment_id", id).order("created_at", { ascending: false }),
    db.from("attachments").select("kind").eq("installment_id", id),
    db.from("financial_accounts")
      .select("id, name, requires_statement_confirmation, is_default")
      .eq("active", true).order("position"),
    db.from("installments").select("id, number, status, due_date")
      .eq("document_id", String(p.document_id)).order("number"),
    db.from("dunning_steps")
      .select("offset_days, action, mode, channel, dunning_profiles!inner(is_default)")
      .eq("dunning_profiles.is_default", true).order("offset_days"),
    partyId
      ? db.from("collection_events").select("type, note, result, automatic, created_at, created_by")
        .eq("party_id", partyId).order("created_at", { ascending: false }).limit(30)
      : Promise.resolve({ data: [] as Linha[], error: null }),
    partyId
      ? db.from("payment_promises").select("promised_date, status")
        .eq("party_id", partyId).eq("status", "active").order("promised_date")
      : Promise.resolve({ data: [] as Linha[], error: null }),
    periodoFechadoAte(db),
  ]);

  const itens = linhas(itensRes);
  const baixas = linhas(baixasRes).filter((s) => !s.reversed_at);
  const cobranca = linhas(cobrancasRes)[0];
  const anexos = new Set(linhas(anexosRes).map((a) => String(a.kind)));
  const contas = linhas(contasRes).map((c) => ({
    id: String(c.id),
    nome: String(c.name ?? "Conta"),
    exigeExtrato: c.requires_statement_confirmation !== false,
    padrao: Boolean(c.is_default),
  }));
  const irmas = linhas(irmasRes);
  const eventos = linhas(eventosRes);
  const promessa = linhas(promessasRes)[0];

  const status = String(p.status ?? "open") as StatusParcela;
  const recebida = status === "settled";
  const valorCent = cent(p.amount_cents);
  const saldoCent = cent(p.open_balance_cents);
  const recebidoCent = baixas.reduce((s, b) => s + cent(b.principal_cents), 0);
  const vencimentoIso = String(p.due_date ?? hoje);
  const ultimaBaixa = baixas[0];

  const encargos = calcularEncargosReceber(saldoCent, vencimentoIso, hoje, {
    multaPct: numero(party?.custom_fine_pct) ?? undefined,
    jurosMesPct: numero(party?.custom_interest_pct) ?? undefined,
  });

  const paraChip = { status, dueDateIso: vencimentoIso, saldoCent, valorCent };
  const situacao = chipDeRecebimento(paraChip, hoje);

  const forma = String(cobranca?.method ?? party?.default_billing_method ?? "");
  const viaSistema = Boolean(cobranca) ||
    ["BOLETO", "PIX", "CREDIT_CARD", "UNDEFINED", "boleto", "pix"].includes(forma);
  const contaDaBaixa = ultimaBaixa?.financial_account_id
    ? contas.find((c) => c.id === String(ultimaBaixa.financial_account_id))
    : undefined;

  const etapasRegua: EtapaRegua[] = linhas(etapasRes).map((e) => ({
    offsetDias: Number(e.offset_days ?? 0),
    acao: String(e.action ?? ""),
    modo: String(e.mode ?? "automatic") as EtapaRegua["modo"],
    canal: e.channel ? String(e.channel) : null,
  }));

  const regua = estadoDaRegua({
    etapas: etapasRegua,
    diasAtraso: diasEntre(vencimentoIso, hoje),
    recebida,
    promessaAte: promessa ? String(promessa.promised_date) : null,
    pausadaAte: null,
    hojeIso: hoje,
    cobrancaEnviada: Boolean(cobranca?.sent_at),
  });

  // A trava mais forte por último: período fechado barra qualquer escrita.
  const travaFechamento = bloqueioPorFechamento(vencimentoIso, fechadoAte);
  const bloqueio = recebida
    ? "Esta parcela já foi recebida."
    : status === "cancelled" || status === "renegotiated"
      ? "Parcela encerrada: não há saldo a receber."
      : travaFechamento;

  const historico: { quando: string; texto: string }[] = [];
  if (doc?.created_at) {
    historico.push({
      quando: ddmm(String(doc.created_at).slice(0, 10)),
      texto: doc.recurrence_id ? "Gerada pela recorrência" : "Lançada no painel",
    });
  }
  if (cobranca?.sent_at) {
    historico.push({ quando: ddmm(String(cobranca.sent_at).slice(0, 10)), texto: "Cobrança enviada" });
  }
  for (const s of baixas) {
    historico.push({
      quando: ddmm(String(s.date)),
      texto: `Recebimento de ${brlExato(cent(s.principal_cents))}`,
    });
  }
  for (const e of eventos) {
    historico.push({
      quando: ddmm(String(e.created_at).slice(0, 10)),
      texto: [TIPO_EVENTO[String(e.type)] ?? String(e.type), e.note ? String(e.note) : null]
        .filter(Boolean).join(" · "),
    });
  }
  historico.sort((a, b) => b.quando.localeCompare(a.quando));

  const total = Number(p.total_number ?? 1);
  const compIso = String(p.competence_month ?? vencimentoIso);
  const emails = ((party?.billing_emails ?? []) as string[]).filter(Boolean);

  const ficha: FichaRecebimento = {
    id: String(p.id),
    documentId: String(p.document_id),
    cliente: texto(party?.name, cliente?.name) || "Cliente não vinculado",
    clienteVinculado: Boolean(party || cliente),
    descricao: texto(doc?.description, "Recebimento"),
    valorCent,
    saldoCent,
    recebidoCent,
    encargosCent: encargos.totalCent,
    atualizadoCent: encargos.atualizadoCent,
    subSaldo: recebida && ultimaBaixa
      ? `Recebido em ${ddmm(String(ultimaBaixa.date))}`
      : encargos.totalCent > 0
        ? `${brlExato(encargos.atualizadoCent)} atualizado hoje, com ${encargos.detalhe}`
        : status === "partial"
          ? `Saldo de ${brlExato(saldoCent)}, já recebido ${brlExato(recebidoCent)}`
          : "",
    situacaoLabel: rotuloDeRecebimento(situacao, paraChip, hoje),
    situacaoTom: SITUACAO_RECEBER_TOM[situacao],
    cobranca: linhaDaCobranca({
      temCobranca: Boolean(cobranca),
      enviadaEm: cobranca?.sent_at ? String(cobranca.sent_at).slice(0, 10) : null,
      visualizadaEm: null,
      falhou: false,
      envioProgramadoPara: null,
      viaSistema,
      recebida,
      confirmadaNoExtrato: Boolean(contaDaBaixa && !contaDaBaixa.exigeExtrato),
    }),
    origem: doc?.recurrence_id
      ? "Gerada por recorrência"
      : String(doc?.origin ?? "manual") === "integration"
        ? "Veio da integração com o Asaas"
        : `Criada manualmente${doc?.created_by ? ` por ${doc.created_by}` : ""}`,
    vencimento: ddmm(vencimentoIso) +
      (p.original_due_date ? ` (era ${ddmm(String(p.original_due_date))})` : ""),
    competencia: `${MESES[Number(compIso.slice(5, 7))]} de ${compIso.slice(0, 4)}`,
    parcela: total > 1 ? `${Number(p.number ?? 1)} de ${total}` : "Única",
    parcelas: irmas.map((i) => ({
      id: String(i.id),
      numero: Number(i.number ?? 1),
      paga: String(i.status) === "settled",
      atual: String(i.id) === id,
      label: `${Number(i.number ?? 1)}ª · ${ddmm(String(i.due_date))}`,
    })),
    contaPrevista: contaDaBaixa?.nome
      ?? (party?.default_account_id
        ? contas.find((c) => c.id === String(party.default_account_id))?.nome ?? null
        : null),
    formaCobranca: FORMAS[forma] ?? (forma || "Não definida"),
    nf: doc?.nf_number ? String(doc.nf_number) : null,
    itens: itens.map((i) => {
      const cli = (Array.isArray(i.clients) ? i.clients[0] : i.clients) as Linha | undefined;
      const cc = (Array.isArray(i.cost_centers) ? i.cost_centers[0] : i.cost_centers) as Linha | undefined;
      const srv = (Array.isArray(i.services) ? i.services[0] : i.services) as Linha | undefined;
      return {
        descricao: texto(srv?.label, i.description, "Item"),
        dimensoes: [
          i.category_key && `Categoria ${i.category_key}`,
          cli?.name && `Cliente ${cli.name}`,
          cc?.name && `Centro de custo ${cc.name}`,
        ].filter(Boolean).join(", ") || "Sem dimensões cadastradas",
        valor: brlExato(cent(i.amount_cents)),
      };
    }),
    // As quatro etapas de §5.2. "Visualizada" fica sempre pendente: o webhook
    // de visualização do Asaas não existe, e marcá-la sem ele seria afirmar
    // que o cliente viu a cobrança.
    etapas: [
      { nome: "Criada", data: cobranca ? ddmm(String(cobranca.created_at).slice(0, 10)) : null,
        concluida: Boolean(cobranca) },
      { nome: "Enviada", data: cobranca?.sent_at ? ddmm(String(cobranca.sent_at).slice(0, 10)) : null,
        concluida: Boolean(cobranca?.sent_at) },
      { nome: "Visualizada", data: null, concluida: false },
      { nome: "Paga", data: ultimaBaixa ? ddmm(String(ultimaBaixa.date)) : null, concluida: recebida },
    ],
    linkPagamento: cobranca?.url ? String(cobranca.url) : null,
    fraseDaRegua: regua.frase,
    destinatarios: emails.length
      ? `Enviada para ${emails.join(", ")}`
      : party
        ? "Sem e-mail de cobrança no cadastro do cliente."
        : null,
    baixas: baixas.map((s) => {
      const juros = cent(s.interest_cents);
      const multa = cent(s.fine_cents);
      const desconto = cent(s.discount_cents);
      const extras = [
        juros > 0 && `juros ${brlExato(juros)}`,
        multa > 0 && `multa ${brlExato(multa)}`,
        desconto > 0 && `desconto ${brlExato(desconto)}`,
        s.fee_waived && `encargos dispensados${s.fee_waiver_reason ? ` (${s.fee_waiver_reason})` : ""}`,
      ].filter(Boolean).join(", ");
      const conta = s.financial_account_id
        ? contas.find((c) => c.id === String(s.financial_account_id))
        : undefined;
      return {
        data: ddmm(String(s.date)),
        valor: brlExato(cent(s.principal_cents)),
        encargos: extras || null,
        conta: conta?.nome ?? null,
        conciliacao: !conta ? "Sem conta informada"
          : conta.exigeExtrato ? "Aguardando confirmação no extrato" : "Confirmado no extrato",
        conciliada: Boolean(conta && !conta.exigeExtrato),
      };
    }),
    anexos: [
      { kind: "invoice_nf", rotulo: "Nota fiscal", anexado: anexos.has("invoice_nf") },
      { kind: "receipt", rotulo: "Comprovante", anexado: anexos.has("receipt") },
      { kind: "contract", rotulo: "Contrato", anexado: anexos.has("contract") },
    ],
    historico,
    podeReceber: !bloqueio,
    bloqueioReceber: bloqueio,
    recebida,
    contas: contas.map(({ id: cid, nome, exigeExtrato }) => ({ id: cid, nome, exigeExtrato })),
    // A conta da cobrança; senão a do cadastro do cliente; senão a padrão (§6.1).
    contaSugeridaId: contaDaBaixa?.id
      ?? (party?.default_account_id ? String(party.default_account_id) : null)
      ?? contas.find((c) => c.padrao)?.id
      ?? contas[0]?.id
      ?? null,
    sugestao: {
      diasAtraso: encargos.diasAtraso,
      multaCent: encargos.multaCent,
      jurosCent: encargos.jurosCent,
      totalCent: encargos.totalCent,
      detalhe: encargos.detalhe,
      valorSugeridoCent: encargos.atualizadoCent,
    },
  };

  if (!recebida && vencimentoIso < hoje) {
    const d = diasEntre(vencimentoIso, hoje);
    ficha.origem = `${ficha.origem} · vencida há ${d} ${d === 1 ? "dia" : "dias"}`;
  }

  return NextResponse.json(ficha);
}

const FORMAS: Record<string, string> = {
  BOLETO: "Boleto", PIX: "PIX", CREDIT_CARD: "Cartão de crédito",
  UNDEFINED: "PIX ou boleto", boleto: "Boleto", pix: "PIX",
  transferencia: "Transferência",
};

function numero(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
