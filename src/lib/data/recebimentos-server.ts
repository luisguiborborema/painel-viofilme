import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { buscarTudo } from "@/lib/data/paginate-server";
import {
  aging, atrasoMedio, brlCheio, ddmm, diasEntre, hojeSP, limitesDoMes, somarDias,
  type FaixaAging,
} from "@/lib/data/dashboard-financeiro";
import {
  acaoDeRecebimento, ACAO_RECEBER_LABEL, brlExato, calcularEncargosReceber, chipDeRecebimento,
  estadoDaRegua, linhaDaCobranca, perfilPagador, PERFIL_LABEL, PERFIL_TOM,
  rotuloDeRecebimento, SITUACAO_RECEBER_TOM,
  type AcaoReceber, type Encargos, type EtapaRegua, type LinhaCobranca,
  type PerfilPagador, type SituacaoReceber,
} from "@/lib/data/recebimentos";
import type { StatusParcela } from "@/lib/data/pagamentos";

/**
 * Recebimentos — leitura da página 2 (spec) sobre o núcleo transacional.
 *
 * A fonte é `installments` com direção `in`, como o documento-mãe fixa
 * (invariante §23.1). `payments` continua de pé para as telas antigas, mas
 * quem manda aqui é a parcela.
 *
 * Nada de estado de cobrança gravado: a etapa da régua, o chip de situação e
 * o valor atualizado são derivados na hora (§14.5). Um campo "etapa D+3" no
 * banco vira mentira no dia seguinte, sem ninguém tocar nele.
 *
 * Tudo em centavos; "hoje", vencimento e aging no fuso de São Paulo (§24).
 */

type Linha = Record<string, unknown>;
const cent = (v: unknown) => Math.round(Number(v) || 0);
const SEM_CLIENTE = "sem-cliente";

/** `installments` aponta para `documents` por duas colunas — o embed nomeia a FK. */
const DOC_EMBED = "doc:documents!installments_document_id_fkey";

/**
 * Consulta que falhou não pode virar zero na tela.
 *
 * Já aconteceu em Pagamentos: um embed ambíguo devolvia erro, a lista vinha
 * vazia e a página anunciava "nada a vencer" com 12 parcelas no banco.
 */
function exigir<T>(r: { linhas: T[]; erro: { message: string } | null }, onde: string): T[] {
  if (r.erro) throw new Error(`${onde}: ${r.erro.message}`);
  return r.linhas;
}

/**
 * Mesma ideia para as consultas simples, que devolvem { data, error }.
 *
 * `data: unknown` de propósito: sem tipos gerados do banco, o supabase-js não
 * infere a forma de um select com embed e devolve um tipo de erro estático.
 * Quem interpreta as linhas é o código abaixo, campo a campo.
 */
function exigirDado<T>(r: { data: unknown; error: { message: string } | null }, onde: string): T {
  if (r.error) throw new Error(`${onde}: ${r.error.message}`);
  return (r.data ?? []) as T;
}

/* ── O que a página recebe ─────────────────────────────────────────────── */

export type ContaAReceber = {
  id: string;
  documentId: string;
  vencimentoIso: string;
  vencimentoLabel: string;
  /** Segunda linha da coluna Vencimento: "hoje", "em 3 dias", "há 81 dias". */
  relativo: string;
  relativoTom: "neutro" | "ruim" | "atencao";
  cliente: string;
  clienteId: string | null;
  /** `parties.id` — o cadastro financeiro, que é onde a régua e os encargos moram. */
  partyId: string | null;
  descricao: string;
  recorrente: boolean;
  parcelaLabel: string | null;
  situacao: SituacaoReceber;
  situacaoLabel: string;
  situacaoTom: string;
  cobranca: LinhaCobranca;
  valorCent: number;
  saldoCent: number;
  recebidoCent: number;
  encargosCent: number;
  atualizadoCent: number;
  /** Linha auxiliar sob o valor (§4.3): "de R$ X", "R$ X atualizado", "recebido em dd/mm". */
  subValor: string;
  subValorTom: "neutro" | "atencao" | "ok";
  acao: AcaoReceber;
  acaoLabel: string;
  linkPagamento: string | null;
  competenciaLabel: string;
  servicos: string[];
  formaCobranca: string;
  contaPrevista: string | null;
  nf: string | null;
  origem: string;
  recebida: boolean;
  recebidaEmIso: string | null;
  confirmadaNoExtrato: boolean;
  temCobranca: boolean;
  diasAtraso: number;
  selecionavel: boolean;
};

export type IndicadoresReceber = {
  aVencerCent: number;
  aVencerContexto: string;
  recebidoCent: number;
  recebidoPct: number;
  recebidoContexto: string;
  vencidoCent: number;
  vencidoContexto: string;
  inadimplencia90Pct: number | null;
  inadimplenciaContexto: string;
};

export type RecorrenciaReceita = {
  id: string;
  cliente: string;
  descricao: string;
  vigencia: string;
  servicos: string[];
  valorCent: number;
  dia: number;
  proxima: string;
  reajuste: string;
  status: string;
  statusLabel: string;
  statusTom: string;
};

export type EtapaContada = {
  dia: string;
  acao: string;
  modo: "automatic" | "manual" | "task";
  modoLabel: string;
  canal: string | null;
  clientes: number;
};

export type ParcelaVencida = {
  id: string;
  descricao: string;
  vencimentoLabel: string;
  saldoCent: number;
  atualizadoCent: number;
  /** "R$ X atualizado", ou null quando o encargo não muda o valor exibido. */
  atualizadoLabel: string | null;
};

export type EventoCobranca = {
  id: string;
  dataLabel: string;
  texto: string;
  tom: "ok" | "ruim" | "atencao" | "info" | "neutro";
};

export type ClienteInadimplente = {
  key: string;
  partyId: string | null;
  nome: string;
  cs: string | null;
  vencidoCent: number;
  atualizadoCent: number;
  parcelas: ParcelaVencida[];
  diasAtraso: number;
  faixaKey: string;
  etapaLabel: string;
  etapaTom: "atencao" | "info" | "neutro";
  proximoPasso: string;
  ultimoContato: string;
  perfil: PerfilPagador;
  perfilLabel: string;
  perfilTom: string;
  /** Etapa manual já atingida e ainda sem registro de envio (§9.4). */
  pendenciaManual: {
    etapa: string;
    acao: string;
    /** Texto pronto para enviar; null quando não há a quem enviar. */
    mensagem: string | null;
    whatsapp: string | null;
    /** O que impede o envio, quando impede. */
    aviso: string | null;
  } | null;
  eventos: EventoCobranca[];
  promessaAte: string | null;
};

export type ClienteFinanceiro = {
  id: string;
  partyId: string;
  nome: string;
  desde: string;
  mrrCent: number;
  /** Fee do cadastro comercial, quando não existe recorrência no Financeiro. */
  feeContratadoCent: number;
  servicos: string[];
  emAbertoCent: number;
  vencidoCent: number;
  recebido12Cent: number;
  atrasoMedioDias: number | null;
  perfil: PerfilPagador;
  perfilLabel: string;
  perfilTom: string;
  pendencias: string[];
};

export type RecebimentosView = {
  semDados: boolean;
  /** Falta rodar a migração: sem o núcleo (0149) ou sem a régua (0150). */
  pendente: boolean;
  hojeIso: string;
  mesIso: string;
  mesLabel: string;
  base: "vencimento" | "competencia";
  indicadores: IndicadoresReceber;
  contas: ContaAReceber[];
  totalNoFiltro: number;
  rodape: { totalCent: number; abertoCent: number; recebidoCent: number; vencidoCent: number };
  visoes: { key: string; label: string; total: number }[];
  semCobranca: number;
  /** Vencidas de outros meses — o que explica "Em aberto" vazio (§18). */
  vencidasForaDoMes: number;
  /** Parcelas de entrada sem cliente vinculado — o aviso que a tabela mostra. */
  semClienteVinculado: number;
  recorrencias: RecorrenciaReceita[];
  recorrenciasResumo: {
    mrrCent: number;
    ativas: number;
    pausadas: number;
    reajustes30: number;
    encerrando60: number;
    feeContratadoCent: number;
    clientesComFee: number;
  };
  aging: FaixaAging[];
  agingClientes: Record<string, number>;
  /** Parcelas vencidas sem cliente no cadastro, por faixa. */
  agingSemCliente: Record<string, number>;
  inadimplencia: {
    totalCent: number;
    contexto: string;
    pct: number | null;
    metaPct: number;
    atrasoMedioDias: number | null;
    promessasAtivas: number;
  };
  regua: EtapaContada[];
  reguaAtiva: boolean;
  inadimplentes: ClienteInadimplente[];
  clientes: ClienteFinanceiro[];
  clientesIncompletos: number;
  badgeInadimplencia: number;
};

export type FiltrosRecebimentos = {
  visao?: string;
  mes?: string;
  base?: string;
  q?: string;
  chip?: string;
  faixa?: string;
  qCliente?: string;
};

/* ── Parâmetros (§15) ──────────────────────────────────────────────────── */

/**
 * A spec manda estes parâmetros para Configurações Financeiras, e a tabela
 * `finance_settings` ainda não tem colunas para eles. Ficam aqui, num lugar
 * só, com o padrão da spec — e o cliente já pode sobrescrever multa e juros
 * pelos campos `custom_*` de `parties`.
 */
const META_INADIMPLENCIA_PCT = 3;

const MESES = [
  "", "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const mesPorExtenso = (iso: string) => `${MESES[Number(iso.slice(5, 7))]} de ${iso.slice(0, 4)}`;
const mesCurto = (iso: string) => `${MESES[Number(iso.slice(5, 7))].slice(0, 3)}/${iso.slice(2, 4)}`;

const MODO_LABEL: Record<string, string> = {
  automatic: "Automático",
  manual: "Manual",
  task: "Tarefa",
};

const FORMAS: Record<string, string> = {
  BOLETO: "Boleto",
  PIX: "PIX",
  CREDIT_CARD: "Cartão de crédito",
  UNDEFINED: "PIX ou boleto",
  boleto: "Boleto",
  pix: "PIX",
  transferencia: "Transferência",
};
const rotuloDaForma = (k: string) => FORMAS[k] ?? (k || "Não definida");

const ORIGENS: Record<string, string> = {
  manual: "Avulsa",
  integration: "Asaas",
  recurrence: "Recorrência",
  project: "Projeto",
  reconciliation: "Conciliação",
  commercial: "Comercial",
};

/* ── Estado vazio ──────────────────────────────────────────────────────── */

function vazio(hojeIso: string, semDados: boolean, pendente = false): RecebimentosView {
  const { primeiro } = limitesDoMes(hojeIso);
  return {
    semDados, pendente, hojeIso, mesIso: primeiro, mesLabel: mesPorExtenso(primeiro),
    base: "vencimento",
    indicadores: {
      aVencerCent: 0, aVencerContexto: "nada a vencer neste mês",
      recebidoCent: 0, recebidoPct: 0, recebidoContexto: "nada previsto neste mês",
      vencidoCent: 0, vencidoContexto: "nada em atraso",
      inadimplencia90Pct: null, inadimplenciaContexto: "sem vencimentos nos últimos 90 dias",
    },
    contas: [], totalNoFiltro: 0,
    rodape: { totalCent: 0, abertoCent: 0, recebidoCent: 0, vencidoCent: 0 },
    visoes: [], semCobranca: 0, vencidasForaDoMes: 0, semClienteVinculado: 0,
    recorrencias: [],
    recorrenciasResumo: {
      mrrCent: 0, ativas: 0, pausadas: 0, reajustes30: 0, encerrando60: 0,
      feeContratadoCent: 0, clientesComFee: 0,
    },
    aging: aging([]), agingClientes: {}, agingSemCliente: {},
    inadimplencia: {
      totalCent: 0, contexto: "nada em atraso", pct: null, metaPct: META_INADIMPLENCIA_PCT,
      atrasoMedioDias: null, promessasAtivas: 0,
    },
    regua: [], reguaAtiva: false, inadimplentes: [],
    clientes: [], clientesIncompletos: 0, badgeInadimplencia: 0,
  };
}

const semTabela = (e: unknown) => {
  const c = (e as { code?: string })?.code;
  const m = e instanceof Error ? e.message : String(e ?? "");
  return c === "42P01" || c === "42703" ||
    /does not exist|schema cache|installments|documents|dunning_/i.test(m);
};

/* ── Leitura ───────────────────────────────────────────────────────────── */

export async function getRecebimentos(
  filtros: FiltrosRecebimentos = {},
  agora: Date = new Date(),
): Promise<RecebimentosView> {
  const hoje = hojeSP(agora);
  if (!isSupabaseConfigured()) return vazio(hoje, true);
  try {
    return await montar(await createClient(), filtros, hoje);
  } catch (e) {
    if (semTabela(e)) return { ...vazio(hoje, false), pendente: true };
    throw e;
  }
}

async function montar(
  db: SupabaseClient,
  filtros: FiltrosRecebimentos,
  hoje: string,
): Promise<RecebimentosView> {
  const mesBase = /^\d{4}-\d{2}/.test(filtros.mes ?? "") ? `${filtros.mes}-01` : hoje;
  const { primeiro: mesIni, ultimo: mesFim } = limitesDoMes(mesBase);
  const base = filtros.base === "competencia" ? "competencia" : "vencimento";
  const doze = somarDias(hoje, -365);
  const noventa = somarDias(hoje, -90);

  const SELECT_PARCELA =
    "id, document_id, number, total_number, due_date, competence_month, amount_cents, " +
    "open_balance_cents, status, original_due_date, " +
    `${DOC_EMBED}!inner(id, direction, description, party_id, client_id, recurrence_id, ` +
    "origin, nf_number, nf_date, clients(id, name), " +
    "party:parties!documents_party_id_fkey(id, name, client_id, document, address, " +
    "billing_emails, default_billing_method, default_send_days_before, " +
    "custom_fine_pct, custom_interest_pct))";

  // Duas janelas, porque respondem perguntas diferentes: a tabela é o mês
  // escolhido (que pode ser futuro) mais o atraso, que não pertence a mês
  // nenhum; os números por cliente são os últimos 12 meses.
  const campoMes = base === "competencia" ? "competence_month" : "due_date";
  const [janelaMes, atrasadas, dozeMeses] = await Promise.all([
    buscarTudo<Linha>((a, b) => db.from("installments").select(SELECT_PARCELA)
      .eq("doc.direction", "in")
      .gte(campoMes, mesIni).lte(campoMes, mesFim).range(a, b)),
    buscarTudo<Linha>((a, b) => db.from("installments").select(SELECT_PARCELA)
      .eq("doc.direction", "in")
      .lt("due_date", hoje).gt("open_balance_cents", 0).range(a, b)),
    buscarTudo<Linha>((a, b) => db.from("installments").select(SELECT_PARCELA)
      .eq("doc.direction", "in")
      .gte("due_date", doze).lte("due_date", hoje).range(a, b)),
  ]);

  const porId = new Map<string, Linha>();
  for (const p of [
    ...exigir(janelaMes, "parcelas do mês"),
    ...exigir(atrasadas, "parcelas vencidas"),
    ...exigir(dozeMeses, "parcelas dos últimos 12 meses"),
  ]) porId.set(String(p.id), p);
  const parcelas = [...porId.values()];
  const ids = parcelas.map((p) => String(p.id));
  const docIds = [...new Set(parcelas.map((p) => String(p.document_id)))];

  const [baixasRes, cobrancasRes, itensRes, contasRes, partiesRes, clientesRes,
    servicosRes, etapasRes, eventosRes, promessasRes, recorrenciasRes] = await Promise.all([
    ids.length
      ? db.from("settlements").select(
          "id, installment_id, date, principal_cents, interest_cents, fine_cents, " +
          "discount_cents, fee_waived, financial_account_id, method, origin, reversed_at")
        .in("installment_id", ids.slice(0, 500))
      : Promise.resolve({ data: [] as Linha[], error: null }),
    ids.length
      ? db.from("charges").select("id, installment_id, method, provider, url, status, sent_at, created_at")
        .in("installment_id", ids.slice(0, 500))
      : Promise.resolve({ data: [] as Linha[], error: null }),
    docIds.length
      ? db.from("document_items").select("document_id, amount_cents, category_key, description, services(label)")
        .in("document_id", docIds.slice(0, 500))
      : Promise.resolve({ data: [] as Linha[], error: null }),
    db.from("financial_accounts").select("id, name, requires_statement_confirmation").eq("active", true),
    db.from("parties").select(
      "id, name, client_id, document, address, roles, status, billing_emails, billing_whatsapp, " +
      "billing_contact_name, default_billing_method, default_due_day, default_send_days_before, " +
      "custom_fine_pct, custom_interest_pct, created_at"),
    db.from("clients").select("id, name, monthly_fee, status, created_at"),
    db.from("client_services").select("client_id, type, final_value, services(label)"),
    db.from("dunning_steps").select("offset_days, action, mode, channel, profile_id, dunning_profiles!inner(is_default)")
      .eq("dunning_profiles.is_default", true).order("offset_days"),
    db.from("collection_events").select(
      "id, party_id, installment_id, type, channel, automatic, result, note, created_by, created_at")
      .order("created_at", { ascending: false }).limit(400),
    db.from("payment_promises").select("id, party_id, installment_ids, promised_date, amount_cents, status")
      .eq("status", "active"),
    db.from("recurrences").select(
      "id, description, amount_cents, due_day, frequency, start_date, end_date, status, " +
      "party_id, client_id, paused_until, pause_reason, adjustment_rule, adjustment_base_date")
      .eq("direction", "in"),
  ]);

  const baixas = exigirDado<Linha[]>(baixasRes, "baixas").filter((s) => !s.reversed_at);
  const cobrancas = exigirDado<Linha[]>(cobrancasRes, "cobranças");
  const itens = exigirDado<Linha[]>(itensRes, "itens do título");
  const contas = exigirDado<Linha[]>(contasRes, "contas financeiras");
  const parties = exigirDado<Linha[]>(partiesRes, "clientes (cadastro financeiro)");
  const clientes = exigirDado<Linha[]>(clientesRes, "clientes");
  const servicosContratados = exigirDado<Linha[]>(servicosRes, "serviços contratados");
  const etapas = exigirDado<Linha[]>(etapasRes, "régua de cobrança");
  const eventos = exigirDado<Linha[]>(eventosRes, "eventos de cobrança");
  const promessas = exigirDado<Linha[]>(promessasRes, "promessas de pagamento");
  const recorrencias = exigirDado<Linha[]>(recorrenciasRes, "recorrências");

  const baixasPorParcela = agrupar(baixas, (s) => String(s.installment_id));
  const cobrancaPorParcela = new Map<string, Linha>();
  for (const c of cobrancas) {
    const k = String(c.installment_id);
    const atual = cobrancaPorParcela.get(k);
    if (!atual || String(c.created_at) > String(atual.created_at)) cobrancaPorParcela.set(k, c);
  }
  const itensPorDoc = agrupar(itens, (i) => String(i.document_id));
  const contaPorId = new Map(contas.map((c) => [String(c.id), c]));
  const partyPorId = new Map(parties.map((p) => [String(p.id), p]));
  const partyPorCliente = new Map(
    parties.filter((p) => p.client_id).map((p) => [String(p.client_id), p]),
  );

  const etapasRegua: EtapaRegua[] = etapas.map((e) => ({
    offsetDias: Number(e.offset_days ?? 0),
    acao: String(e.action ?? ""),
    modo: (String(e.mode ?? "automatic") as EtapaRegua["modo"]),
    canal: e.channel ? String(e.channel) : null,
  }));

  const promessaPorParty = new Map<string, Linha>();
  for (const p of promessas) {
    const k = String(p.party_id);
    const atual = promessaPorParty.get(k);
    if (!atual || String(p.promised_date) < String(atual.promised_date)) promessaPorParty.set(k, p);
  }
  const eventosPorParty = agrupar(eventos, (e) => String(e.party_id ?? SEM_CLIENTE));

  /* ── Cada parcela vira uma linha da tabela (§4.3) ─────────────────────── */

  const todas: ContaAReceber[] = parcelas.map((p) => {
    const doc = um<Linha>(p.doc);
    const party = doc ? um<Linha>(doc.party) : undefined;
    const clienteDoc = doc ? um<Linha>(doc.clients) : undefined;

    const id = String(p.id);
    const status = String(p.status ?? "open") as StatusParcela;
    const recebida = status === "settled";
    const saldoCent = cent(p.open_balance_cents);
    const valorCent = cent(p.amount_cents);
    const vencimentoIso = String(p.due_date ?? hoje);
    const dias = diasEntre(hoje, vencimentoIso);
    const atraso = Math.max(0, -dias);

    const minhasBaixas = baixasPorParcela.get(id) ?? [];
    const ultimaBaixa = [...minhasBaixas].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    const recebidoCent = minhasBaixas.reduce((s, b) => s + cent(b.principal_cents), 0);
    const cobranca = cobrancaPorParcela.get(id);
    const conta = ultimaBaixa?.financial_account_id
      ? contaPorId.get(String(ultimaBaixa.financial_account_id))
      : undefined;

    const encargos: Encargos = calcularEncargosReceber(saldoCent, vencimentoIso, hoje, {
      multaPct: numeroOuNulo(party?.custom_fine_pct) ?? undefined,
      jurosMesPct: numeroOuNulo(party?.custom_interest_pct) ?? undefined,
    });

    const forma = String(cobranca?.method ?? party?.default_billing_method ?? "");
    const viaSistema = Boolean(cobranca) || String(cobranca?.provider ?? "") === "asaas" ||
      ["BOLETO", "PIX", "CREDIT_CARD", "UNDEFINED", "boleto", "pix"].includes(forma);

    const situacao = chipDeRecebimento(
      { status, dueDateIso: vencimentoIso, saldoCent, valorCent }, hoje,
    );

    const meusItens = itensPorDoc.get(String(p.document_id)) ?? [];
    const servicos = [...new Set(
      meusItens.map((i) => um<Linha>(i.services)?.label).filter(Boolean).map(String),
    )];

    const total = Number(p.total_number ?? 1);
    const nome = texto(party?.name, clienteDoc?.name);

    return {
      id,
      documentId: String(p.document_id),
      vencimentoIso,
      vencimentoLabel: ddmm(vencimentoIso),
      relativo: recebida && ultimaBaixa ? `Paga em ${ddmm(String(ultimaBaixa.date))}`
        : dias === 0 ? "hoje"
        : dias > 0 ? `em ${dias} ${dias === 1 ? "dia" : "dias"}`
        : `há ${atraso} ${atraso === 1 ? "dia" : "dias"}`,
      relativoTom: recebida ? "neutro" : dias < 0 ? "ruim" : dias <= 7 ? "atencao" : "neutro",
      // Sem cliente vinculado, dizer isso é melhor que repetir a descrição no
      // lugar do nome: o aviso da tabela conta quantas estão assim.
      cliente: nome || "Cliente não vinculado",
      clienteId: doc?.client_id ? String(doc.client_id) : party?.client_id ? String(party.client_id) : null,
      partyId: party?.id ? String(party.id) : null,
      descricao: texto(doc?.description, "Recebimento"),
      recorrente: Boolean(doc?.recurrence_id),
      parcelaLabel: total > 1 ? `${Number(p.number ?? 1)}/${total}` : null,
      situacao,
      situacaoLabel: rotuloDeRecebimento(
        situacao, { status, dueDateIso: vencimentoIso, saldoCent, valorCent }, hoje,
      ),
      situacaoTom: SITUACAO_RECEBER_TOM[situacao],
      cobranca: linhaDaCobranca({
        temCobranca: Boolean(cobranca),
        enviadaEm: cobranca?.sent_at ? String(cobranca.sent_at).slice(0, 10) : null,
        // O webhook de visualização do Asaas ainda não existe, então nenhuma
        // cobrança pode ser dada como vista — inventar isso seria pior que a
        // ausência, porque muda a decisão de cobrar.
        visualizadaEm: null,
        falhou: false,
        // Não há job emitindo cobrança (§12): prometer "envio automático em
        // dd/mm" seria descrever uma automação que não roda.
        envioProgramadoPara: null,
        viaSistema,
        recebida,
        confirmadaNoExtrato: Boolean(conta && conta.requires_statement_confirmation === false),
      }),
      valorCent,
      saldoCent,
      recebidoCent,
      encargosCent: encargos.totalCent,
      atualizadoCent: encargos.atualizadoCent,
      // O valor atualizado só é dito quando a tela mostraria outro número:
      // "R$ 10" ao lado de "R$ 10 atualizado" parece defeito, não encargo.
      subValor: recebida && ultimaBaixa ? `recebido em ${ddmm(String(ultimaBaixa.date))}`
        : status === "partial" ? `de ${brlCheio(valorCent)}`
        : encargos.totalCent > 0 && brlCheio(encargos.atualizadoCent) !== brlCheio(saldoCent)
          ? `${brlCheio(encargos.atualizadoCent)} atualizado`
        : "",
      subValorTom: recebida ? "ok" : encargos.totalCent > 0 ? "atencao" : "neutro",
      acao: acaoDeRecebimento({ recebida, temCobranca: Boolean(cobranca), viaSistema }),
      acaoLabel: ACAO_RECEBER_LABEL[
        acaoDeRecebimento({ recebida, temCobranca: Boolean(cobranca), viaSistema })
      ],
      linkPagamento: cobranca?.url ? String(cobranca.url) : null,
      competenciaLabel: mesCurto(String(p.competence_month ?? vencimentoIso)),
      servicos,
      formaCobranca: rotuloDaForma(forma),
      contaPrevista: conta ? String(conta.name) : null,
      nf: doc?.nf_number ? String(doc.nf_number) : null,
      origem: ORIGENS[String(doc?.origin ?? "manual")] ?? "Avulsa",
      recebida,
      recebidaEmIso: ultimaBaixa ? String(ultimaBaixa.date) : null,
      confirmadaNoExtrato: Boolean(conta && conta.requires_statement_confirmation === false),
      temCobranca: Boolean(cobranca),
      diasAtraso: atraso,
      selecionavel: !recebida,
    };
  });

  /* ── Indicadores (§3) ─────────────────────────────────────────────────── */

  const noMes = (c: ContaAReceber) => {
    const chave = base === "competencia" ? mesDaCompetencia(c) : c.vencimentoIso;
    return chave >= mesIni && chave <= mesFim;
  };
  const doMes = todas.filter(noMes);
  const vencidas = todas.filter((c) => !c.recebida && c.saldoCent > 0 && c.vencimentoIso < hoje);
  const aVencer = doMes.filter((c) => !c.recebida && c.vencimentoIso >= hoje);
  const semCobranca = todas.filter((c) => !c.recebida && !c.temCobranca);

  const soma = (l: ContaAReceber[], campo: "saldoCent" | "valorCent" | "recebidoCent" = "saldoCent") =>
    l.reduce((s, c) => s + c[campo], 0);

  const previstoMes = soma(doMes, "valorCent");
  const recebidoMesCent = soma(doMes, "recebidoCent");
  const maisAntiga = [...vencidas].sort((a, b) => a.vencimentoIso.localeCompare(b.vencimentoIso))[0];
  // "1 cliente" com a parcela sem vínculo diria que alguém identificado está
  // devendo. O que existe é uma cobrança sem dono no cadastro — e é isso que
  // a linha precisa dizer, porque muda quem se vai procurar.
  const vencidoContexto = (() => {
    if (!vencidas.length) return "nada em atraso";
    const identificados = new Set(
      vencidas.filter((c) => c.partyId ?? c.clienteId).map((c) => c.partyId ?? c.clienteId!),
    ).size;
    const orfas = vencidas.filter((c) => !c.partyId && !c.clienteId).length;
    const partes = [
      identificados ? `${identificados} ${identificados === 1 ? "cliente" : "clientes"}` : null,
      orfas ? `${orfas} ${orfas === 1 ? "parcela" : "parcelas"} sem cliente vinculado` : null,
      maisAntiga ? `mais antiga há ${diasEntre(maisAntiga.vencimentoIso, hoje)} dias` : null,
    ].filter(Boolean);
    return partes.join(", ");
  })();

  // Inadimplência 90d: do que venceu nos últimos 90 dias, quanto ainda não
  // entrou. Canceladas e renegociadas ficam fora dos dois lados da divisão.
  const venceu90 = todas.filter((c) =>
    c.vencimentoIso >= noventa && c.vencimentoIso <= hoje && c.situacao !== "encerrada");
  const total90 = venceu90.reduce((s, c) => s + c.valorCent, 0);
  const aberto90 = venceu90.reduce((s, c) => s + c.saldoCent, 0);
  const inadimplencia90Pct = total90 > 0 ? Math.round((aberto90 / total90) * 1000) / 10 : null;

  const baixasComVencimento = todas
    .filter((c) => c.recebidaEmIso)
    .map((c) => ({ vencimentoIso: c.vencimentoIso, pagamentoIso: c.recebidaEmIso! }));
  const atrasoMedioDias = atrasoMedio(baixasComVencimento);

  const indicadores: IndicadoresReceber = {
    aVencerCent: soma(aVencer),
    aVencerContexto: aVencer.length
      ? `${aVencer.length} ${aVencer.length === 1 ? "parcela" : "parcelas"}` +
        (aVencer.filter((c) => !c.temCobranca).length
          ? `, ${aVencer.filter((c) => !c.temCobranca).length} sem cobrança` : "")
      : "nada a vencer neste mês",
    recebidoCent: recebidoMesCent,
    recebidoPct: previstoMes > 0 ? Math.round((recebidoMesCent / previstoMes) * 100) : 0,
    recebidoContexto: previstoMes > 0
      ? `${Math.round((recebidoMesCent / previstoMes) * 100)}% de ${brlCheio(previstoMes)} previstos`
      : "nada previsto neste mês",
    vencidoCent: soma(vencidas),
    vencidoContexto,
    inadimplencia90Pct,
    inadimplenciaContexto: inadimplencia90Pct === null
      ? "sem vencimentos nos últimos 90 dias"
      : atrasoMedioDias !== null
        ? `Atraso médio de ${atrasoMedioDias.toFixed(1).replace(".", ",")} dias`
        // Um percentual sozinho não diz sobre quanto ele incide: 100% de R$ 15
        // e 100% de R$ 150.000 pedem reações diferentes.
        : `de ${brlCheio(total90)} vencidos em 90 dias, ${brlCheio(aberto90)} em aberto`,
  };

  /* ── Visões, busca e rodapé (§4.1, §4.2) ──────────────────────────────── */

  const emAberto = doMes.filter((c) => !c.recebida && c.situacao !== "encerrada");
  const recebidas = doMes.filter((c) => c.recebidoCent > 0);
  const visao = filtros.visao ?? "aberto";
  // "Todas" some com o atraso de outro mês daria "Todas 0" ao lado de
  // "Vencidas 2" — a tela parecendo quebrada por causa de um recorte.
  const todasDaVisao = [...doMes, ...vencidas.filter((c) => !doMes.includes(c))];
  const porVisao = (v: string) =>
    v === "vencidas" ? vencidas
    : v === "recebidas" ? recebidas
    : v === "todas" ? todasDaVisao
    : emAberto;

  const busca = (filtros.q ?? "").trim().toLowerCase();
  const filtradas = porVisao(visao)
    .filter((c) => filtros.chip !== "sem-cobranca" || (!c.recebida && !c.temCobranca))
    .filter((c) => !busca ||
      c.cliente.toLowerCase().includes(busca) ||
      c.descricao.toLowerCase().includes(busca) ||
      (c.nf ?? "").toLowerCase().includes(busca) ||
      String(c.valorCent / 100).includes(busca))
    .sort((a, b) =>
      visao === "recebidas"
        ? String(b.recebidaEmIso ?? "").localeCompare(String(a.recebidaEmIso ?? ""))
        // Em aberto: vencidas primeiro, a mais antiga no topo (§4.1).
        : Number(b.vencimentoIso < hoje) - Number(a.vencimentoIso < hoje) ||
          a.vencimentoIso.localeCompare(b.vencimentoIso));

  /* ── Aba Inadimplência (§9) ───────────────────────────────────────────── */

  const faixas = aging(vencidas.map((c) => ({ diasAtraso: c.diasAtraso, valorCent: c.saldoCent })));
  const porCliente = agrupar(vencidas, (c) => c.partyId ?? c.clienteId ?? SEM_CLIENTE);

  const liquidadasPorParty = new Map<string, { vencimentoIso: string; pagamentoIso: string; valorCent: number }[]>();
  for (const c of todas) {
    if (!c.recebidaEmIso) continue;
    const k = c.partyId ?? c.clienteId ?? SEM_CLIENTE;
    liquidadasPorParty.set(k, [...(liquidadasPorParty.get(k) ?? []), {
      vencimentoIso: c.vencimentoIso, pagamentoIso: c.recebidaEmIso, valorCent: c.valorCent,
    }]);
  }
  const quebradasPorParty = new Map<string, number>();
  for (const e of eventos) {
    if (String(e.type) !== "promise_broken") continue;
    const k = String(e.party_id ?? SEM_CLIENTE);
    quebradasPorParty.set(k, (quebradasPorParty.get(k) ?? 0) + 1);
  }

  const perfilDe = (key: string): PerfilPagador => perfilPagador({
    liquidadas: liquidadasPorParty.get(key) ?? [],
    promessasQuebradas: quebradasPorParty.get(key) ?? 0,
  }).perfil;

  const inadimplentes: ClienteInadimplente[] = [...porCliente.entries()].map(([key, lista]) => {
    const party = partyPorId.get(key);
    const maisAntigaDoCliente = [...lista].sort((a, b) => a.vencimentoIso.localeCompare(b.vencimentoIso))[0];
    const diasAtraso = maisAntigaDoCliente.diasAtraso;
    const promessa = promessaPorParty.get(key);
    const meusEventos = eventosPorParty.get(key) ?? [];

    const estado = estadoDaRegua({
      etapas: etapasRegua,
      diasAtraso,
      recebida: false,
      promessaAte: promessa ? String(promessa.promised_date) : null,
      pausadaAte: null,
      hojeIso: hoje,
      cobrancaEnviada: lista.some((c) => c.temCobranca),
    });

    // Etapa manual já atingida e sem evento correspondente: é a pendência que
    // a régua não resolve sozinha e que alguém precisa executar (§9.4).
    const manualPendente = etapasRegua
      .filter((e) => e.modo === "manual" && diasAtraso >= e.offsetDias)
      .find((e) => !meusEventos.some((ev) => String(ev.channel ?? "") === (e.canal ?? "")));

    const vencidoCent = lista.reduce((s, c) => s + c.saldoCent, 0);
    const atualizadoCent = lista.reduce((s, c) => s + c.atualizadoCent, 0);
    const nome = lista[0].cliente;
    const ultimo = meusEventos[0];

    return {
      key,
      partyId: party ? String(party.id) : null,
      nome,
      // Sem módulo de CS e sem responsável em Configurações, não há a quem
      // atribuir — e um nome inventado viraria cobrança para a pessoa errada.
      cs: null,
      vencidoCent,
      atualizadoCent,
      parcelas: lista
        .sort((a, b) => a.vencimentoIso.localeCompare(b.vencimentoIso))
        .map((c) => ({
          id: c.id, descricao: c.descricao, vencimentoLabel: c.vencimentoLabel,
          saldoCent: c.saldoCent, atualizadoCent: c.atualizadoCent,
          // Mesma regra da tabela: só vale dizer "atualizado" se o número
          // exibido for outro — senão parece defeito em vez de encargo.
          atualizadoLabel: brlCheio(c.atualizadoCent) !== brlCheio(c.saldoCent)
            ? `${brlCheio(c.atualizadoCent)} atualizado` : null,
        })),
      diasAtraso,
      faixaKey: faixaDoAtraso(diasAtraso),
      etapaLabel: estado.pausada ? "Régua pausada"
        : estado.etapaAtual ? `D+${estado.etapaAtual.offsetDias} · ${estado.etapaAtual.acao}`
        : "Fora da régua",
      etapaTom: (estado.pausada ? "info" : manualPendente ? "atencao" : "neutro") as
        ClienteInadimplente["etapaTom"],
      proximoPasso: estado.frase,
      ultimoContato: ultimo
        ? `${TIPO_EVENTO[String(ultimo.type)] ?? "Contato"} em ${ddmm(String(ultimo.created_at).slice(0, 10))}`
        : "Nenhum contato registrado",
      perfil: perfilDe(key),
      perfilLabel: PERFIL_LABEL[perfilDe(key)],
      perfilTom: PERFIL_TOM[perfilDe(key)],
      pendenciaManual: manualPendente
        ? (() => {
            // Sem cliente no cadastro não há mensagem a redigir: o texto sairia
            // com "Olá, Cliente não vinculado" e não teria destinatário.
            const mensagem = party
              ? mensagemDeCobranca(nome, atualizadoCent, maisAntigaDoCliente, lista.length)
              : null;
            return {
              etapa: `D+${manualPendente.offsetDias}`,
              acao: manualPendente.acao,
              mensagem,
              whatsapp: mensagem && party?.billing_whatsapp
                ? `https://wa.me/${String(party.billing_whatsapp).replace(/\D/g, "")}?text=` +
                  encodeURIComponent(mensagem)
                : null,
              aviso: !party
                ? "A parcela não está vinculada a nenhum cliente: não há para quem enviar."
                : !party.billing_whatsapp
                  ? "Sem WhatsApp de cobrança no cadastro do cliente."
                  : null,
            };
          })()
        : null,
      eventos: meusEventos.slice(0, 12).map((e) => ({
        id: String(e.id),
        dataLabel: ddmm(String(e.created_at).slice(0, 10)),
        texto: [
          TIPO_EVENTO[String(e.type)] ?? String(e.type),
          e.note ? String(e.note) : null,
          e.automatic ? "(automático)" : null,
        ].filter(Boolean).join(" · "),
        tom: TOM_EVENTO[String(e.type)] ?? "neutro",
      })),
      promessaAte: promessa ? String(promessa.promised_date) : null,
    };
  }).sort((a, b) => b.diasAtraso - a.diasAtraso || b.vencidoCent - a.vencidoCent);

  // Um cliente com parcelas em faixas diferentes aparece em qualquer uma
  // delas (§18) — a faixa filtra parcela, não cliente.
  const faixasDoCliente = new Map<string, Set<string>>();
  for (const c of vencidas) {
    const k = c.partyId ?? c.clienteId ?? SEM_CLIENTE;
    if (!faixasDoCliente.has(k)) faixasDoCliente.set(k, new Set());
    faixasDoCliente.get(k)!.add(faixaDoAtraso(c.diasAtraso));
  }
  const faixaFiltro = filtros.faixa;
  const inadimplentesFiltrados = faixaFiltro
    ? inadimplentes.filter((c) => faixasDoCliente.get(c.key)?.has(faixaFiltro))
    : inadimplentes;

  const agingClientes: Record<string, number> = {};
  const agingSemCliente: Record<string, number> = {};
  for (const f of faixas) {
    const naFaixa = vencidas.filter((c) => faixaDoAtraso(c.diasAtraso) === f.key);
    agingClientes[f.key] = new Set(
      naFaixa.filter((c) => c.partyId ?? c.clienteId).map((c) => c.partyId ?? c.clienteId!),
    ).size;
    agingSemCliente[f.key] = naFaixa.filter((c) => !c.partyId && !c.clienteId).length;
  }

  const regua: EtapaContada[] = etapasRegua.map((e) => ({
    dia: `D${e.offsetDias >= 0 ? "+" : ""}${e.offsetDias}`,
    acao: e.acao,
    modo: e.modo,
    modoLabel: MODO_LABEL[e.modo] ?? e.modo,
    canal: e.canal ?? null,
    // Cliente com promessa ativa ou régua pausada não entra na contagem (§9.2).
    clientes: inadimplentes.filter((c) => !c.promessaAte && c.etapaLabel.startsWith(
      `D${e.offsetDias >= 0 ? "+" : ""}${e.offsetDias} `)).length,
  }));

  /* ── Aba Recorrências (§8) ────────────────────────────────────────────── */

  const clientePorId = new Map(clientes.map((c) => [String(c.id), c]));
  const servicosPorCliente = agrupar(servicosContratados, (s) => String(s.client_id));

  const recorrenciasLinhas: RecorrenciaReceita[] = recorrencias.map((r) => {
    const party = r.party_id ? partyPorId.get(String(r.party_id)) : undefined;
    const cliente = r.client_id ? clientePorId.get(String(r.client_id)) : undefined;
    const status = String(r.status ?? "active");
    const dia = Number(r.due_day ?? 5);
    const proxima = proximoVencimento(hoje, dia);
    return {
      id: String(r.id),
      cliente: texto(party?.name, cliente?.name, "Cliente não vinculado"),
      descricao: String(r.description ?? ""),
      vigencia: [
        r.start_date ? `Desde ${mesCurto(String(r.start_date))}` : null,
        r.end_date ? `até ${mesCurto(String(r.end_date))}` : null,
        r.paused_until ? `pausada até ${ddmm(String(r.paused_until))}` : null,
      ].filter(Boolean).join(", "),
      servicos: (servicosPorCliente.get(String(r.client_id ?? "")) ?? [])
        .map((s) => um<Linha>(s.services)?.label).filter(Boolean).map(String),
      valorCent: cent(r.amount_cents),
      dia,
      proxima: status === "active" ? ddmm(proxima) : "—",
      reajuste: r.adjustment_base_date ? ddmm(String(r.adjustment_base_date)) : "Sem reajuste",
      status,
      statusLabel: STATUS_RECORRENCIA[status]?.label ?? status,
      statusTom: STATUS_RECORRENCIA[status]?.tom ?? "neutro",
    };
  }).sort((a, b) => b.valorCent - a.valorCent);

  const feeContratadoCent = clientes.reduce((s, c) => s + Math.round((Number(c.monthly_fee) || 0) * 100), 0);

  /* ── Aba Clientes (§10) ───────────────────────────────────────────────── */

  const abertoPorParty = new Map<string, number>();
  const vencidoPorParty = new Map<string, number>();
  const recebido12PorParty = new Map<string, number>();
  for (const c of todas) {
    const k = c.partyId ?? (c.clienteId ? String(partyPorCliente.get(c.clienteId)?.id ?? "") : "");
    if (!k) continue;
    if (!c.recebida && c.vencimentoIso >= hoje) abertoPorParty.set(k, (abertoPorParty.get(k) ?? 0) + c.saldoCent);
    if (!c.recebida && c.vencimentoIso < hoje) vencidoPorParty.set(k, (vencidoPorParty.get(k) ?? 0) + c.saldoCent);
    if (c.recebidaEmIso && c.recebidaEmIso >= doze) {
      recebido12PorParty.set(k, (recebido12PorParty.get(k) ?? 0) + c.recebidoCent);
    }
  }

  const mrrPorParty = new Map<string, number>();
  for (const r of recorrencias) {
    if (String(r.status ?? "") !== "active" || !r.party_id) continue;
    const k = String(r.party_id);
    mrrPorParty.set(k, (mrrPorParty.get(k) ?? 0) + cent(r.amount_cents));
  }

  const clientesFinanceiros: ClienteFinanceiro[] = parties
    .filter((p) => ((p.roles ?? []) as string[]).includes("client"))
    .map((p) => {
      const id = String(p.id);
      const cliente = p.client_id ? clientePorId.get(String(p.client_id)) : undefined;
      const servicos = (servicosPorCliente.get(String(p.client_id ?? "")) ?? [])
        .filter((s) => String(s.type ?? "") === "recorrente");
      const liquidadas = liquidadasPorParty.get(id) ?? [];
      const perfil = perfilPagador({
        liquidadas, promessasQuebradas: quebradasPorParty.get(id) ?? 0,
      }).perfil;
      const pendencias: string[] = [];
      if (!String(p.document ?? "").replace(/\D/g, "")) pendencias.push("CPF ou CNPJ");
      if (!p.address) pendencias.push("endereço");
      if (!((p.billing_emails ?? []) as string[]).length) pendencias.push("e-mail de cobrança");

      return {
        id: String(p.client_id ?? p.id),
        partyId: id,
        nome: String(p.name ?? "Cliente"),
        desde: cliente?.created_at
          ? `Desde ${mesCurto(String(cliente.created_at).slice(0, 10))}`
          : p.created_at ? `Desde ${mesCurto(String(p.created_at).slice(0, 10))}` : "",
        mrrCent: mrrPorParty.get(id) ?? 0,
        feeContratadoCent: Math.round((Number(cliente?.monthly_fee) || 0) * 100),
        servicos: servicos.map((s) => um<Linha>(s.services)?.label).filter(Boolean).map(String),
        emAbertoCent: abertoPorParty.get(id) ?? 0,
        vencidoCent: vencidoPorParty.get(id) ?? 0,
        recebido12Cent: recebido12PorParty.get(id) ?? 0,
        atrasoMedioDias: atrasoMedio(liquidadas),
        perfil,
        perfilLabel: PERFIL_LABEL[perfil],
        perfilTom: PERFIL_TOM[perfil],
        pendencias,
      };
    })
    .filter((c) => {
      const q = (filtros.qCliente ?? "").trim().toLowerCase();
      return !q || c.nome.toLowerCase().includes(q);
    })
    .sort((a, b) =>
      b.vencidoCent - a.vencidoCent || b.mrrCent - a.mrrCent ||
      b.feeContratadoCent - a.feeContratadoCent || a.nome.localeCompare(b.nome));

  return {
    semDados: false, pendente: false, hojeIso: hoje, mesIso: mesIni, mesLabel: mesPorExtenso(mesIni),
    base,
    indicadores,
    contas: filtradas,
    totalNoFiltro: filtradas.length,
    rodape: {
      totalCent: soma(filtradas, "valorCent"),
      abertoCent: soma(filtradas.filter((c) => !c.recebida && c.vencimentoIso >= hoje)),
      recebidoCent: soma(filtradas, "recebidoCent"),
      vencidoCent: soma(filtradas.filter((c) => !c.recebida && c.vencimentoIso < hoje)),
    },
    visoes: [
      { key: "aberto", label: "Em aberto", total: emAberto.length },
      { key: "vencidas", label: "Vencidas", total: vencidas.length },
      { key: "recebidas", label: "Recebidas", total: recebidas.length },
      { key: "todas", label: "Todas", total: todasDaVisao.length },
    ],
    semCobranca: semCobranca.length,
    vencidasForaDoMes: vencidas.filter((c) => !doMes.includes(c)).length,
    semClienteVinculado: todas.filter((c) => !c.partyId && !c.clienteId).length,
    recorrencias: recorrenciasLinhas,
    recorrenciasResumo: {
      mrrCent: recorrenciasLinhas.filter((r) => r.status === "active")
        .reduce((s, r) => s + r.valorCent, 0),
      ativas: recorrenciasLinhas.filter((r) => r.status === "active").length,
      pausadas: recorrenciasLinhas.filter((r) => r.status === "paused").length,
      reajustes30: recorrencias.filter((r) => r.adjustment_base_date &&
        String(r.adjustment_base_date) >= hoje && String(r.adjustment_base_date) <= somarDias(hoje, 30)).length,
      encerrando60: recorrencias.filter((r) => r.end_date &&
        String(r.end_date) >= hoje && String(r.end_date) <= somarDias(hoje, 60)).length,
      feeContratadoCent,
      clientesComFee: clientes.filter((c) => Number(c.monthly_fee) > 0).length,
    },
    aging: faixas,
    agingClientes,
    agingSemCliente,
    inadimplencia: {
      totalCent: soma(vencidas),
      contexto: indicadores.vencidoContexto,
      pct: inadimplencia90Pct,
      metaPct: META_INADIMPLENCIA_PCT,
      atrasoMedioDias,
      promessasAtivas: promessas.length,
    },
    regua,
    // Sem job de cobrança rodando (§12), as etapas automáticas não disparam: a
    // faixa mostra em que etapa cada cliente ESTARIA hoje, e a tela diz isso.
    reguaAtiva: false,
    inadimplentes: inadimplentesFiltrados,
    clientes: clientesFinanceiros,
    clientesIncompletos: clientesFinanceiros.filter((c) => c.pendencias.length).length,
    badgeInadimplencia: inadimplentes.length,
  };
}

/* ── Auxiliares ────────────────────────────────────────────────────────── */

function um<T>(v: unknown): T | undefined {
  return (Array.isArray(v) ? v[0] : v) as T | undefined;
}

function texto(...valores: unknown[]): string {
  for (const v of valores) {
    const t = String(v ?? "").trim();
    if (t) return t;
  }
  return "";
}

function numeroOuNulo(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function agrupar<T>(linhas: T[], chave: (t: T) => string): Map<string, T[]> {
  const mapa = new Map<string, T[]>();
  for (const l of linhas) {
    const k = chave(l);
    mapa.set(k, [...(mapa.get(k) ?? []), l]);
  }
  return mapa;
}

const mesDaCompetencia = (c: ContaAReceber) => {
  const [mes, ano] = c.competenciaLabel.split("/");
  const n = MESES.findIndex((m) => m.slice(0, 3) === mes);
  return n > 0 ? `20${ano}-${String(n).padStart(2, "0")}-01` : c.vencimentoIso;
};

function faixaDoAtraso(dias: number): string {
  if (dias <= 7) return "1-7";
  if (dias <= 15) return "8-15";
  if (dias <= 30) return "16-30";
  if (dias <= 60) return "31-60";
  return "60+";
}

/** Próximo vencimento no dia N, respeitando meses curtos (§18). */
function proximoVencimento(hojeIso: string, dia: number): string {
  const [a, m, d] = hojeIso.split("-").map(Number);
  const mes = d <= dia ? m - 1 : m;
  const ultimo = new Date(Date.UTC(a, mes + 1, 0)).getUTCDate();
  const alvo = new Date(Date.UTC(a, mes, Math.min(dia, ultimo)));
  return alvo.toISOString().slice(0, 10);
}

const TIPO_EVENTO: Record<string, string> = {
  charge_sent: "Cobrança enviada",
  reminder: "Lembrete enviado",
  overdue_notice: "Aviso de atraso",
  whatsapp: "WhatsApp enviado",
  cs_triggered: "CS acionado",
  escalation: "Escalado para a diretoria",
  contact: "Contato registrado",
  promise: "Promessa registrada",
  promise_broken: "Promessa quebrada",
  renegotiation: "Renegociação",
  pause: "Régua pausada",
  resume: "Régua retomada",
  write_off: "Registrado como perda",
};

const TOM_EVENTO: Record<string, EventoCobranca["tom"]> = {
  charge_sent: "info", reminder: "info", overdue_notice: "atencao", whatsapp: "info",
  cs_triggered: "atencao", escalation: "ruim", contact: "neutro", promise: "info",
  promise_broken: "ruim", renegotiation: "atencao", pause: "neutro", resume: "neutro",
  write_off: "ruim",
};

const STATUS_RECORRENCIA: Record<string, { label: string; tom: string }> = {
  active: { label: "Ativa", tom: "ok" },
  paused: { label: "Pausada", tom: "atencao" },
  ended: { label: "Encerrada", tom: "neutro" },
  draft: { label: "Rascunho", tom: "roxo" },
};

/** A mensagem pronta da pendência manual (§9.4): quem, quanto, desde quando. */
function mensagemDeCobranca(
  cliente: string,
  atualizadoCent: number,
  maisAntiga: ContaAReceber,
  quantas: number,
): string {
  const parcelas = quantas === 1
    ? `a parcela de ${maisAntiga.vencimentoLabel}`
    : `${quantas} parcelas, a mais antiga de ${maisAntiga.vencimentoLabel}`;
  return `Olá, ${cliente}! Passando para lembrar de ${parcelas}, ` +
    `no valor atualizado de ${brlExato(atualizadoCent)}. ` +
    (maisAntiga.linkPagamento ? `O link para pagamento é ${maisAntiga.linkPagamento}. ` : "") +
    "Se já foi pago, é só avisar que damos baixa por aqui.";
}
