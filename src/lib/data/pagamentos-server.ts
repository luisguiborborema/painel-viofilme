import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config";
import { unstable_cache } from "next/cache";
import { buscarTudo } from "@/lib/data/paginate-server";
import {
  brlCheio, ddmm, diasEntre, hojeSP, limitesDoMes, serieProjecao, somarDias,
} from "@/lib/data/dashboard-financeiro";
import {
  acaoDaLinha, ACAO_LABEL, chipDeSituacao, coberturaDosProximos7, favorecidoDivergente,
  linhaDePagamento, rotuloDaSituacao, SITUACAO_TOM,
  type AcaoLinha, type Cobertura, type DadosDePagamento, type LinhaPagamento,
  type Situacao, type StatusAprovacao, type StatusParcela, type StatusValor,
} from "@/lib/data/pagamentos";

/**
 * Pagamentos — leitura da página 3 (spec) sobre o núcleo transacional.
 *
 * A fonte é `installments` com direção `out`, como o documento-mãe fixa (§4 e
 * invariante §23.1). Nada aqui lê `expenses`: a tabela antiga continua de pé,
 * mas quem manda agora é a parcela.
 *
 * Tudo em centavos. "Hoje", "vencida" e aging no fuso de São Paulo (§24).
 */

type Linha = Record<string, unknown>;
const cent = (v: unknown) => Math.round(Number(v) || 0);

/**
 * `installments` referencia `documents` por duas colunas, então o embed tem de
 * nomear a chave. O alias `doc` é o que os filtros usam.
 */
const DOC_EMBED = "doc:documents!installments_document_id_fkey";

/**
 * Consulta que falhou não pode virar zero na tela.
 *
 * Foi exatamente o que aconteceu: o embed ambíguo devolvia erro, `buscarTudo`
 * entregava lista vazia com `erro` preenchido, e a página mostrava "R$ 0" e
 * "nada a vencer neste mês" com 12 parcelas no banco. Número errado sem aviso
 * é pior que tela quebrada — esta função transforma um no outro.
 */
function exigir<T>(r: { linhas: T[]; erro: { message: string } | null }, onde: string): T[] {
  if (r.erro) throw new Error(`${onde}: ${r.erro.message}`);
  return r.linhas;
}

/** Mesma ideia para as consultas simples, que devolvem { data, error }. */
function exigirDado<T>(r: { data: T | null; error: { message: string } | null }, onde: string): T {
  if (r.error) throw new Error(`${onde}: ${r.error.message}`);
  return (r.data ?? []) as T;
}

/* ── O que a página recebe ─────────────────────────────────────────────── */

export type ContaAPagar = {
  id: string;
  documentId: string;
  vencimentoIso: string;
  vencimentoLabel: string;
  /** "hoje", "em 3 dias", "há 5 dias" — a segunda linha da coluna Vencimento. */
  relativo: string;
  relativoTom: "neutro" | "ruim" | "atencao";
  fornecedor: string;
  fornecedorId: string | null;
  descricao: string;
  categoria: string;
  categoriaKey: string | null;
  cliente: string | null;
  recorrente: boolean;
  parcelaLabel: string | null;
  situacao: Situacao;
  situacaoLabel: string;
  situacaoTom: string;
  linhaPagamento: LinhaPagamento;
  valorCent: number;
  saldoCent: number;
  estimada: boolean;
  /** Texto auxiliar sob o valor: método de estimativa, "pago em dd/mm". */
  subValor: string;
  acao: AcaoLinha;
  acaoLabel: string;
  /** Código de pagamento para o botão Copiar, quando existe. */
  copiavel: string | null;
  aprovacao: StatusAprovacao;
  formaPagamento: string;
  contaSaida: string | null;
  exigeNota: boolean;
  temNota: boolean;
  paga: boolean;
  selecionavel: boolean;
};

export type GrupoDeContas = { nome: string | null; subtitulo: string; contas: ContaAPagar[] };

export type ChipFiltro = { key: string; label: string; total: number };

export type IndicadoresPagamentos = {
  aPagarCent: number;
  aPagarContexto: string;
  pagoCent: number;
  pagoPct: number;
  pagoContexto: string;
  vencidoCent: number;
  vencidoContexto: string;
  proximos7Cent: number;
  cobertura: Cobertura;
  coberturaTexto: string;
};

export type FornecedorLinha = {
  id: string;
  nome: string;
  tipo: string;
  categoriaPrincipal: string;
  gasto12Cent: number;
  variacaoPct: number | null;
  emAbertoCent: number;
  vencido: boolean;
  proximo: string | null;
  formaPadrao: string;
  semDados: boolean;
};

export type RecorrenciaLinha = {
  id: string;
  fornecedor: string;
  descricao: string;
  vigencia: string;
  categoria: string;
  valorCent: number;
  estimada: boolean;
  metodoLabel: string;
  dia: number;
  forma: string;
  status: string;
};

export type ColaboradorFolha = {
  id: string;
  nome: string;
  subtitulo: string;
  centroDeCusto: string;
  contratoCent: number;
  ajustesCent: number;
  ajustesDescricao: string;
  totalCent: number;
  temNota: boolean;
  notaLabel: string;
  pagamentoLabel: string;
  pago: boolean;
};

export type PagamentosView = {
  semDados: boolean;
  /** Opções do drawer de nova despesa (§10). */
  opcoes: {
    fornecedores: { id: string; nome: string }[];
    categorias: { key: string; label: string }[];
    contas: { id: string; nome: string }[];
  };
  /** Falta a migração 0149 — sem o núcleo, a página não tem o que ler. */
  pendente: boolean;
  hojeIso: string;
  mesIso: string;
  mesLabel: string;
  indicadores: IndicadoresPagamentos;
  grupos: GrupoDeContas[];
  totalNoFiltro: number;
  rodape: { totalCent: number; abertoCent: number; pagoCent: number; vencidoCent: number };
  visoes: { key: string; label: string; total: number }[];
  chips: ChipFiltro[];
  fornecedores: FornecedorLinha[];
  fornecedoresSemDados: number;
  recorrencias: RecorrenciaLinha[];
  custoFixoCent: number;
  folha: {
    grupos: { nome: string; subtitulo: string; pessoas: ColaboradorFolha[] }[];
    totalCent: number;
    notasRecebidas: string;
    pagos: string;
    semEquipe: boolean;
  };
  /** Contadores das abas. */
  notasPendentes: number;
};

export type FiltrosPagamentos = {
  visao?: string;
  mes?: string;
  agrupar?: string;
  chip?: string;
  q?: string;
};

/* ── Estado vazio ──────────────────────────────────────────────────────── */

function vazio(hojeIso: string, semDados: boolean, pendente = false): PagamentosView {
  const { primeiro } = limitesDoMes(hojeIso);
  return {
    semDados, pendente, hojeIso, mesIso: primeiro, mesLabel: mesPorExtenso(primeiro),
    indicadores: {
      aPagarCent: 0, aPagarContexto: "nenhuma conta neste mês",
      pagoCent: 0, pagoPct: 0, pagoContexto: "nada pago ainda",
      vencidoCent: 0, vencidoContexto: "nada em atraso",
      proximos7Cent: 0,
      cobertura: { coberto: true, saldoMinimoCent: 0 },
      coberturaTexto: "Nada a pagar nos próximos 7 dias",
    },
    grupos: [], totalNoFiltro: 0,
    rodape: { totalCent: 0, abertoCent: 0, pagoCent: 0, vencidoCent: 0 },
    visoes: [], chips: [],
    fornecedores: [], fornecedoresSemDados: 0,
    recorrencias: [], custoFixoCent: 0,
    folha: { grupos: [], totalCent: 0, notasRecebidas: "0 de 0", pagos: "0 de 0", semEquipe: true },
    notasPendentes: 0,
    opcoes: { fornecedores: [], categorias: [], contas: [] },
  };
}

const MESES = [
  "", "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const mesPorExtenso = (iso: string) =>
  `${MESES[Number(iso.slice(5, 7))]} de ${iso.slice(0, 4)}`;

const semTabela = (e: unknown) => {
  const c = (e as { code?: string })?.code;
  const m = e instanceof Error ? e.message : String(e ?? "");
  return c === "42P01" || c === "42703" || /does not exist|installments|documents/i.test(m);
};

/* ── Leitura ───────────────────────────────────────────────────────────── */

const getPagamentosCached = unstable_cache(
  async (token: string, filtrosStr: string, hoje: string) => {
    const filtros = JSON.parse(filtrosStr) as FiltrosPagamentos;
    const db = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    try {
      return await montar(db, filtros, hoje);
    } catch (e) {
      if (semTabela(e)) return { ...vazio(hoje, false), pendente: true };
      throw e;
    }
  },
  ["pagamentos-dados"],
  { tags: ["financeiro"] }
);

export async function getPagamentos(
  filtros: FiltrosPagamentos = {},
  agora: Date = new Date(),
): Promise<PagamentosView> {
  const hoje = hojeSP(agora);
  if (!isSupabaseConfigured()) return vazio(hoje, true);
  
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ...vazio(hoje, true), pendente: true };

  return getPagamentosCached(token, JSON.stringify(filtros), hoje);
}

async function montar(
  db: SupabaseClient,
  filtros: FiltrosPagamentos,
  hoje: string,
): Promise<PagamentosView> {
  const mesBase = /^\d{4}-\d{2}/.test(filtros.mes ?? "") ? `${filtros.mes}-01` : hoje;
  const { primeiro: mesIni, ultimo: mesFim } = limitesDoMes(mesBase);
  const mais7 = somarDias(hoje, 7);
  const mais30 = somarDias(hoje, 30);

  // As parcelas de saída: as do mês, mais TODAS as vencidas em aberto (o
  // atraso não pertence a um mês — ele acompanha quem não pagou).
  const [saidas, entradasAbertas, categorias, contas, partiesRes, recorrenciasRes, colaboradores] =
    await Promise.all([
      buscarTudo<Linha>((a, b) => db.from("installments")
        .select(
          "id, document_id, number, total_number, due_date, competence_month, amount_cents, " +
          "open_balance_cents, status, approval_status, scheduled_payment_date, amount_status, " +
          "estimated_amount_cents, payment_details, " +
          // A FK precisa vir nomeada: `installments` aponta para `documents`
          // por duas colunas (document_id e renegotiated_to), e sem escolher
          // uma o PostgREST recusa o embed inteiro.
          `${DOC_EMBED}!inner(id, direction, description, party_id, client_id, recurrence_id, ` +
          "invoice_number, party:parties!documents_party_id_fkey(id, name, document, payment_method, pix_key), " +
          "clients(name))",
        )
        .eq("doc.direction", "out")
        .or(`and(due_date.gte.${mesIni},due_date.lte.${mesFim}),and(due_date.lt.${hoje},open_balance_cents.gt.0)`)
        .range(a, b)),

      // Entradas em aberto: alimentam a projeção da cobertura (§4.1).
      buscarTudo<Linha>((a, b) => db.from("installments")
        .select(`due_date, open_balance_cents, ${DOC_EMBED}!inner(direction)`)
        .eq("doc.direction", "in").gt("open_balance_cents", 0)
        .lte("due_date", mais30).range(a, b)),

      db.from("expense_categories").select("key, label, impact_type, requires_invoice, requires_receipt"),
      db.from("financial_accounts").select("id, name, kind, opening_balance, counts_as_available").eq("active", true),
      db.from("parties").select("id, name, roles, document, payment_method, pix_key, bank_account, default_category_key, status"),
      db.from("recurrences").select("id, description, amount_cents, due_day, estimation_method, payment_method, category_key, status, party_id, direction, kind")
        .eq("direction", "out"),
      db.from("collaborators").select("id, name, role, squad, contract_type, salary"),
    ]);

  const categoriasLinhas = exigirDado<Linha[]>(categorias, "categorias");
  const contasLinhas = exigirDado<Linha[]>(contas, "contas financeiras");
  const parties = exigirDado<Linha[]>(partiesRes, "fornecedores");
  const saidasLinhas = exigir(saidas, "parcelas a pagar");
  const entradasLinhas = exigir(entradasAbertas, "parcelas a receber");

  const categoriaDe = new Map(
    categoriasLinhas.map((c) => [String(c.key), {
      label: String(c.label ?? c.key),
      impacto: String(c.impact_type ?? ""),
      exigeNota: Boolean(c.requires_invoice),
    }]),
  );
  const nomeDaConta = new Map(
    contasLinhas.map((c) => [String(c.id), String(c.name ?? "Conta")]),
  );

  const ids = saidasLinhas.map((p) => String(p.id));
  const [itensRes, baixasRes, anexosRes] = await Promise.all([
    ids.length
      ? db.from("document_items").select("document_id, amount_cents, category_key, client_id, clients(name)")
          .in("document_id", [...new Set(saidasLinhas.map((p) => String(p.document_id)))].slice(0, 500))
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? db.from("settlements").select("installment_id, date, principal_cents, financial_account_id, reversed_at")
          .in("installment_id", ids.slice(0, 500))
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? db.from("attachments").select("installment_id, document_id, kind").in("installment_id", ids.slice(0, 500))
      : Promise.resolve({ data: [], error: null }),
  ]);

  const itensPorDoc = new Map<string, Linha[]>();
  for (const i of ((itensRes.data ?? []) as Linha[])) {
    const k = String(i.document_id);
    itensPorDoc.set(k, [...(itensPorDoc.get(k) ?? []), i]);
  }
  const baixasPorParcela = new Map<string, Linha[]>();
  for (const s of ((baixasRes.data ?? []) as Linha[])) {
    const k = String(s.installment_id);
    baixasPorParcela.set(k, [...(baixasPorParcela.get(k) ?? []), s]);
  }
  const anexosPorParcela = new Map<string, Set<string>>();
  for (const a of ((anexosRes.data ?? []) as Linha[])) {
    const k = String(a.installment_id);
    if (!anexosPorParcela.has(k)) anexosPorParcela.set(k, new Set());
    anexosPorParcela.get(k)!.add(String(a.kind));
  }

  /* ── Cada parcela vira uma linha da tabela (§5.3) ─────────────────────── */

  const todas: ContaAPagar[] = saidasLinhas.map((p) => {
    const doc = (Array.isArray(p.doc) ? p.doc[0] : p.doc) as Linha | undefined;
    const party = doc ? (Array.isArray(doc.party) ? doc.party[0] : doc.party) as Linha | undefined : undefined;
    const cliente = doc ? (Array.isArray(doc.clients) ? doc.clients[0] : doc.clients) as Linha | undefined : undefined;

    const itens = itensPorDoc.get(String(p.document_id)) ?? [];
    const catKey = itens[0]?.category_key ? String(itens[0].category_key) : null;
    const cat = catKey ? categoriaDe.get(catKey) : undefined;

    const baixas = (baixasPorParcela.get(String(p.id)) ?? []).filter((s) => !s.reversed_at);
    const ultimaBaixa = [...baixas].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    const anexos = anexosPorParcela.get(String(p.id)) ?? new Set<string>();

    const status = String(p.status ?? "open") as StatusParcela;
    const paga = status === "settled";
    const saldoCent = cent(p.open_balance_cents);
    const vencimentoIso = String(p.due_date ?? hoje);
    const estimada = String(p.amount_status ?? "confirmed") === "estimated";
    const detalhes = (p.payment_details ?? null) as DadosDePagamento;
    const aprovacao = String(p.approval_status ?? "not_required") as StatusAprovacao;

    const debitoAutomatico = String(detalhes?.method ?? party?.payment_method ?? "") === "debito_automatico";
    const exigeNota = Boolean(cat?.exigeNota);
    const temNota = anexos.has("invoice_nf");

    const situacao = chipDeSituacao({
      status, dueDateIso: vencimentoIso, saldoCent, aprovacao,
      valorStatus: String(p.amount_status ?? "confirmed") as StatusValor,
      programadaParaIso: p.scheduled_payment_date ? String(p.scheduled_payment_date) : null,
    }, hoje);

    const dias = diasEntre(hoje, vencimentoIso);
    const total = Number(p.total_number ?? 1);

    return {
      id: String(p.id),
      documentId: String(p.document_id),
      vencimentoIso,
      vencimentoLabel: ddmm(vencimentoIso),
      relativo: paga && ultimaBaixa
        ? `Paga em ${ddmm(String(ultimaBaixa.date))}`
        : dias === 0 ? "hoje"
        : dias > 0 ? `em ${dias} ${dias === 1 ? "dia" : "dias"}`
        : `há ${-dias} ${dias === -1 ? "dia" : "dias"}`,
      relativoTom: paga ? "neutro" : dias < 0 ? "ruim" : dias <= 7 ? "atencao" : "neutro",
      // Sem fornecedor cadastrado, admitir a falta é melhor que repetir a
      // descrição ao lado dela — e é acionável: a aba Fornecedores explica.
      fornecedor: texto(party?.name, "Não informado"),
      fornecedorId: party?.id ? String(party.id) : null,
      descricao: texto(doc?.description, "Despesa"),
      categoria: cat?.label ?? "Sem categoria",
      categoriaKey: catKey,
      cliente: cliente?.name ? String(cliente.name) : null,
      recorrente: Boolean(doc?.recurrence_id),
      parcelaLabel: total > 1 ? `${Number(p.number ?? 1)}/${total}` : null,
      situacao,
      situacaoLabel: rotuloDaSituacao(situacao, {
        status, dueDateIso: vencimentoIso, saldoCent, aprovacao,
        valorStatus: String(p.amount_status ?? "confirmed") as StatusValor,
        programadaParaIso: p.scheduled_payment_date ? String(p.scheduled_payment_date) : null,
      }, hoje),
      situacaoTom: SITUACAO_TOM[situacao],
      linhaPagamento: linhaDePagamento({
        detalhes, debitoAutomatico, estimada, paga,
        temComprovante: anexos.has("receipt"),
        exigeNota, temNota,
        favorecidoDivergente: favorecidoDivergente(
          detalhes ? { nome: detalhes.payeeName, documento: detalhes.payeeDocument } : null,
          { nome: texto(party?.name, ""), documento: party?.document as string | undefined },
        ),
      }),
      valorCent: cent(p.amount_cents),
      saldoCent,
      estimada,
      subValor: estimada && p.estimated_amount_cents
        ? `estimado, ${brlCheio(cent(p.estimated_amount_cents))}`
        : ultimaBaixa ? `pago em ${ddmm(String(ultimaBaixa.date))}` : "",
      acao: acaoDaLinha({ aprovacao, estimada, debitoAutomatico, paga }),
      acaoLabel: ACAO_LABEL[acaoDaLinha({ aprovacao, estimada, debitoAutomatico, paga })],
      copiavel: detalhes?.barcode ?? detalhes?.pixKey ?? null,
      aprovacao,
      formaPagamento: rotuloDaForma(String(detalhes?.method ?? party?.payment_method ?? "")),
      contaSaida: ultimaBaixa?.financial_account_id
        ? nomeDaConta.get(String(ultimaBaixa.financial_account_id)) ?? null
        : null,
      exigeNota, temNota, paga,
      selecionavel: !paga && aprovacao !== "pending",
    };
  });

  /* ── Indicadores (§4) ─────────────────────────────────────────────────── */

  const doMes = todas.filter((c) => c.vencimentoIso >= mesIni && c.vencimentoIso <= mesFim);
  const vencidas = todas.filter((c) => !c.paga && c.vencimentoIso < hoje && c.saldoCent > 0);
  const aPagarMes = doMes.filter((c) => !c.paga && c.vencimentoIso >= hoje);
  const pagasMes = doMes.filter((c) => c.paga);
  const prox7 = todas.filter((c) => !c.paga && c.vencimentoIso >= hoje && c.vencimentoIso <= mais7);

  const soma = (l: ContaAPagar[], campo: "saldoCent" | "valorCent" = "saldoCent") =>
    l.reduce((s, c) => s + c[campo], 0);

  // Projeção para a cobertura: mesma regra do Dashboard (§4.1) — entrada
  // vencida não entra, saída vencida conta como saída de hoje.
  // "O saldo nunca é digitado: saldo = saldo inicial + movimentações" (§23.2).
  // Só a abertura seria metade da conta — e a metade que não muda.
  const idsDisponiveis = contasLinhas
    .filter((c) => c.counts_as_available !== false)
    .map((c) => String(c.id));
  const movimentos = idsDisponiveis.length
    ? exigirDado<Linha[]>(
        await db.from("transactions").select("amount_cents, financial_account_id")
          .in("financial_account_id", idsDisponiveis).eq("confirmation_status", "confirmed"),
        "movimentações",
      )
    : [];
  const saldoDisponivelCent =
    contasLinhas
      .filter((c) => c.counts_as_available !== false)
      .reduce((s, c) => s + Math.round((Number(c.opening_balance) || 0) * 100), 0) +
    movimentos.reduce((s, m) => s + cent(m.amount_cents), 0);
  const projecao = serieProjecao(
    saldoDisponivelCent,
    entradasLinhas.map((e) => ({
      dataIso: String(e.due_date ?? hoje), valorCent: cent(e.open_balance_cents),
    })),
    todas.filter((c) => !c.paga).map((c) => ({ dataIso: c.vencimentoIso, valorCent: c.saldoCent })),
    hoje, 30,
  );
  const cobertura = coberturaDosProximos7(projecao, hoje);

  const semProgramacao = aPagarMes.filter((c) => c.situacao !== "programada").length;
  const estimadasMes = doMes.filter((c) => c.estimada).length;
  const previstoMes = soma(doMes, "valorCent");
  const pagoMesCent = soma(pagasMes, "valorCent");
  const fornecedoresVencidos = new Set(vencidas.map((c) => c.fornecedor));

  const indicadores: IndicadoresPagamentos = {
    aPagarCent: soma(aPagarMes),
    aPagarContexto: aPagarMes.length
      ? `${aPagarMes.length} ${aPagarMes.length === 1 ? "conta" : "contas"}` +
        (semProgramacao ? `, ${semProgramacao} sem programação` : "") +
        (estimadasMes ? `, ${estimadasMes} estimada${estimadasMes > 1 ? "s" : ""}` : "")
      : "nada a vencer neste mês",
    pagoCent: pagoMesCent,
    pagoPct: previstoMes > 0 ? Math.round((pagoMesCent / previstoMes) * 100) : 0,
    pagoContexto: previstoMes > 0
      ? `${Math.round((pagoMesCent / previstoMes) * 100)}% de ${brlCheio(previstoMes)} previstos`
      : "nada previsto neste mês",
    vencidoCent: soma(vencidas),
    vencidoContexto: vencidas.length
      ? `${vencidas.length} ${vencidas.length === 1 ? "conta" : "contas"}, ${fornecedoresVencidos.size} ${
          fornecedoresVencidos.size === 1 ? "fornecedor" : "fornecedores"}`
      : "nada em atraso",
    proximos7Cent: soma(prox7),
    cobertura,
    coberturaTexto: !prox7.length
      ? "Nada a pagar nos próximos 7 dias"
      : cobertura.coberto
        ? `Saldo disponível de ${brlCheio(cobertura.saldoMinimoCent)} cobre`
        : `Faltam ${brlCheio(cobertura.faltaCent)} em ${ddmm(cobertura.dataIso)}`,
  };

  /* ── Visões, chips e filtros (§5.1, §5.2) ─────────────────────────────── */

  const emAberto = todas.filter((c) => !c.paga);
  const aAprovar = todas.filter((c) => c.aprovacao === "pending");

  const visao = filtros.visao ?? "aberto";
  const porVisao = (v: string) =>
    v === "vencidas" ? vencidas
    : v === "pagas" ? todas.filter((c) => c.paga)
    : v === "todas" ? todas
    : v === "aprovar" ? aAprovar
    : emAberto;

  const chipsDef: { key: string; label: string; filtra: (c: ContaAPagar) => boolean }[] = [
    { key: "sem-programacao", label: "Sem programação",
      filtra: (c) => !c.paga && c.situacao !== "programada" && c.linhaPagamento.texto !== "Débito automático" },
    { key: "estimadas", label: "Estimadas", filtra: (c) => c.estimada },
    { key: "sem-dados", label: "Sem dados de pagamento",
      filtra: (c) => !c.paga && c.linhaPagamento.texto === "Sem dados de pagamento" },
    { key: "sem-comprovante", label: "Sem comprovante",
      filtra: (c) => c.paga && c.linhaPagamento.texto === "Sem comprovante" },
    { key: "impostos", label: "Impostos e obrigações",
      filtra: (c) => (c.categoriaKey ?? "").includes("imposto") ||
        (categoriaDe.get(c.categoriaKey ?? "")?.impacto === "revenue_deduction") },
  ];

  const baseDaVisao = porVisao(visao);
  const chipAtivo = chipsDef.find((c) => c.key === filtros.chip);
  const busca = (filtros.q ?? "").trim().toLowerCase();

  const filtradas = baseDaVisao
    .filter((c) => !chipAtivo || chipAtivo.filtra(c))
    .filter((c) => !busca ||
      c.fornecedor.toLowerCase().includes(busca) ||
      c.descricao.toLowerCase().includes(busca) ||
      c.categoria.toLowerCase().includes(busca) ||
      String(c.valorCent / 100).includes(busca))
    // Em aberto: vencidas primeiro, depois pela data efetiva (§5.1).
    .sort((a, b) =>
      visao === "pagas"
        ? b.vencimentoIso.localeCompare(a.vencimentoIso)
        : Number(b.vencimentoIso < hoje) - Number(a.vencimentoIso < hoje) ||
          a.vencimentoIso.localeCompare(b.vencimentoIso) ||
          b.saldoCent - a.saldoCent);

  const grupos = agrupar(filtradas, filtros.agrupar ?? "nenhum");

  /* ── Fornecedores (§13) ───────────────────────────────────────────────── */

  const gastoPorParty = new Map<string, number>();
  const abertoPorParty = new Map<string, number>();
  for (const c of todas) {
    if (!c.fornecedorId) continue;
    if (c.paga) gastoPorParty.set(c.fornecedorId, (gastoPorParty.get(c.fornecedorId) ?? 0) + c.valorCent);
    else abertoPorParty.set(c.fornecedorId, (abertoPorParty.get(c.fornecedorId) ?? 0) + c.saldoCent);
  }

  const fornecedores: FornecedorLinha[] = parties
    .filter((p) => {
      const r = (p.roles ?? []) as string[];
      return r.includes("supplier") || r.includes("freelancer") || r.includes("government");
    })
    .map((p) => {
      const id = String(p.id);
      const semDados = !p.pix_key && !p.bank_account;
      const proxima = todas
        .filter((c) => c.fornecedorId === id && !c.paga && c.vencimentoIso >= hoje)
        .sort((a, b) => a.vencimentoIso.localeCompare(b.vencimentoIso))[0];
      return {
        id, nome: String(p.name ?? "Fornecedor"),
        tipo: ((p.roles ?? []) as string[]).includes("freelancer") ? "Freelancer"
          : ((p.roles ?? []) as string[]).includes("government") ? "Órgão público" : "Fornecedor",
        categoriaPrincipal: categoriaDe.get(String(p.default_category_key ?? ""))?.label ?? "—",
        gasto12Cent: gastoPorParty.get(id) ?? 0,
        // Sem 12 meses de histórico no núcleo ainda, a variação fica honesta em null.
        variacaoPct: null,
        emAbertoCent: abertoPorParty.get(id) ?? 0,
        vencido: todas.some((c) => c.fornecedorId === id && !c.paga && c.vencimentoIso < hoje),
        proximo: proxima ? `${ddmm(proxima.vencimentoIso)} · ${brlCheio(proxima.saldoCent)}` : null,
        formaPadrao: rotuloDaForma(String(p.payment_method ?? "")),
        semDados,
      };
    })
    .sort((a, b) => b.gasto12Cent - a.gasto12Cent || a.nome.localeCompare(b.nome));

  /* ── Recorrências (§12) ───────────────────────────────────────────────── */

  const nomeDaParty = new Map(parties.map((p) => [String(p.id), String(p.name ?? "")]));
  const recorrencias: RecorrenciaLinha[] = ((recorrenciasRes.data ?? []) as Linha[])
    // A folha é gerida na aba Folha e não aparece aqui (§12.2).
    .filter((r) => String(r.kind ?? "standard") !== "team")
    .map((r) => ({
      id: String(r.id),
      fornecedor: nomeDaParty.get(String(r.party_id ?? "")) ?? "—",
      descricao: String(r.description ?? ""),
      vigencia: "Assinatura mensal",
      categoria: categoriaDe.get(String(r.category_key ?? ""))?.label ?? "Sem categoria",
      valorCent: cent(r.amount_cents),
      estimada: String(r.estimation_method ?? "fixed") !== "fixed",
      metodoLabel: String(r.estimation_method ?? "fixed"),
      dia: Number(r.due_day ?? 1),
      forma: rotuloDaForma(String(r.payment_method ?? "")),
      status: String(r.status ?? "active"),
    }))
    .sort((a, b) => b.valorCent - a.valorCent);

  /* ── Folha (§11) ──────────────────────────────────────────────────────── */

  const equipe = (colaboradores.data ?? []) as Linha[];
  const porCentro = new Map<string, ColaboradorFolha[]>();

  let notasPjRecebidas = 0;
  let pjsCadastrados = 0;
  let pessoasPagas = 0;

  for (const c of equipe) {
    const isPj = String(c.contract_type ?? "clt") === "pj";
    const nomeColab = String(c.name ?? "").toLowerCase();
    
    const contasDoColab = todas.filter(
      (conta) => conta.fornecedor.toLowerCase() === nomeColab
    );

    const contratoCent = Math.round((Number(c.salary) || 0) * 100);
    const centro = String(c.squad ?? "") || "Sem centro de custo";

    let totalCent = contratoCent;
    let ajustesCent = 0;
    let ajustesDescricao = "—";
    let temNota = !isPj;
    let pago = false;
    let pagamentoLabel = "Não programado";

    if (contasDoColab.length > 0) {
      totalCent = contasDoColab.reduce((s, conta) => s + conta.valorCent, 0);
      ajustesCent = totalCent - contratoCent;
      ajustesDescricao = ajustesCent !== 0 ? (ajustesCent > 0 ? "+" : "") + brlCheio(ajustesCent) : "—";
      
      if (isPj) {
        temNota = contasDoColab.some((conta) => conta.temNota);
      }
      pago = contasDoColab.every((conta) => conta.paga);
      const aPagar = contasDoColab.filter(conta => !conta.paga);
      if (pago) {
         pagamentoLabel = contasDoColab.length > 1 ? "Pago (múltiplas)" : contasDoColab[0].relativo;
      } else {
         pagamentoLabel = aPagar.length > 0 ? aPagar[0].relativo : "Pendente";
      }
    }

    if (isPj) {
      pjsCadastrados++;
      if (temNota) notasPjRecebidas++;
    }
    if (pago) pessoasPagas++;

    const linha: ColaboradorFolha = {
      id: String(c.id),
      nome: String(c.name ?? ""),
      subtitulo: [c.role, c.squad].filter(Boolean).join(", "),
      centroDeCusto: centro,
      contratoCent,
      ajustesCent,
      ajustesDescricao,
      totalCent,
      temNota,
      notaLabel: isPj ? (temNota ? "Recebida" : "Pendente") : "Não se aplica",
      pagamentoLabel,
      pago,
    };
    porCentro.set(centro, [...(porCentro.get(centro) ?? []), linha]);
  }

  const gruposFolha = [...porCentro.entries()].map(([nome, pessoas]) => ({
    nome,
    subtitulo: `${pessoas.length} ${pessoas.length === 1 ? "pessoa" : "pessoas"} · ${
      brlCheio(pessoas.reduce((s, p) => s + p.totalCent, 0))}`,
    pessoas,
  }));
  const totalFolha = equipe.reduce((s, c) => s + Math.round((Number(c.salary) || 0) * 100), 0);

  const custoFixoCent = recorrencias
    .filter((r) => r.status === "active")
    .reduce((s, r) => s + r.valorCent, 0) + totalFolha;

  return {
    semDados: false, pendente: false, hojeIso: hoje, mesIso: mesIni, mesLabel: mesPorExtenso(mesIni),
    indicadores,
    grupos,
    totalNoFiltro: filtradas.length,
    rodape: {
      totalCent: soma(filtradas, "valorCent"),
      abertoCent: soma(filtradas.filter((c) => !c.paga)),
      pagoCent: soma(filtradas.filter((c) => c.paga), "valorCent"),
      vencidoCent: soma(filtradas.filter((c) => !c.paga && c.vencimentoIso < hoje)),
    },
    visoes: [
      { key: "aberto", label: "Em aberto", total: emAberto.length },
      { key: "vencidas", label: "Vencidas", total: vencidas.length },
      { key: "pagas", label: "Pagas", total: todas.filter((c) => c.paga).length },
      { key: "todas", label: "Todas", total: todas.length },
      ...(aAprovar.length ? [{ key: "aprovar", label: "A aprovar", total: aAprovar.length }] : []),
    ],
    chips: chipsDef.map((c) => ({
      key: c.key, label: c.label, total: baseDaVisao.filter(c.filtra).length,
    })),
    fornecedores,
    fornecedoresSemDados: fornecedores.filter((f) => f.semDados).length,
    recorrencias,
    custoFixoCent,
    folha: {
      grupos: gruposFolha,
      totalCent: totalFolha,
      notasRecebidas: `${notasPjRecebidas} de ${pjsCadastrados}`,
      pagos: `${pessoasPagas} de ${equipe.length}`,
      semEquipe: equipe.length === 0,
    },
    notasPendentes: todas.filter((c) => !c.paga && c.exigeNota && !c.temNota).length,
    opcoes: {
      fornecedores: fornecedores.map((f) => ({ id: f.id, nome: f.nome })),
      categorias: [...categoriaDe.entries()].map(([key, c]) => ({ key, label: c.label })),
      contas: contasLinhas.map((c) => ({ id: String(c.id), nome: String(c.name ?? "Conta") })),
    },
  };
}

/* ── Auxiliares ────────────────────────────────────────────────────────── */

function texto(...valores: unknown[]): string {
  for (const v of valores) {
    const t = String(v ?? "").trim();
    if (t) return t;
  }
  return "";
}

const FORMAS: Record<string, string> = {
  boleto: "Boleto",
  pix: "PIX",
  transferencia: "Transferência",
  credit_card: "Cartão de crédito",
  debito_automatico: "Débito automático",
  dinheiro: "Dinheiro",
};
const rotuloDaForma = (k: string) => FORMAS[k] ?? (k ? k : "Não definida");

/** Agrupa por categoria ou por forma (§5.2). Cada grupo traz qtd e subtotal. */
function agrupar(contas: ContaAPagar[], modo: string): GrupoDeContas[] {
  if (modo === "nenhum" || !contas.length) {
    return [{ nome: null, subtitulo: "", contas }];
  }
  const chave = (c: ContaAPagar) => (modo === "forma" ? c.formaPagamento : c.categoria);
  const mapa = new Map<string, ContaAPagar[]>();
  for (const c of contas) {
    const k = chave(c);
    mapa.set(k, [...(mapa.get(k) ?? []), c]);
  }
  return [...mapa.entries()]
    .map(([nome, lista]) => ({
      nome,
      subtitulo: `${lista.length} ${lista.length === 1 ? "conta" : "contas"} · ${
        brlCheio(lista.reduce((s, c) => s + (c.paga ? c.valorCent : c.saldoCent), 0))}`,
      contas: lista,
    }))
    .sort((a, b) => b.contas.length - a.contas.length);
}
