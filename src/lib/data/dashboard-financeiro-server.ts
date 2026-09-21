import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { buscarTudo } from "@/lib/data/paginate-server";
import { lerNucleoComoLegado } from "@/lib/data/nucleo-adaptador";
import { STATUS_IGNORAR } from "@/lib/data/dre";
import { montarDre, type ImpactType, type TotaisPorImpacto } from "@/lib/data/resultados";
import {
  montarPanorama, PANORAMA_VAZIO, type PanoramaView,
} from "@/lib/data/dashboard-panorama-server";
import {
  aging, atrasoMedio, barraDiaADia, brlCheio, chaveDeExcecao, dataPorExtenso, ddmm, diasEntre,
  emQuantoTempo, ordenarSemana, rotuloDaSemana,
  estaSilenciada, folegoEmMeses, gravidadeCaixaMinimo, gravidadeConciliacao,
  gravidadeRecebimentosVencidos, hojeSP, horaSP, janelaDesdeOntem, limitesDoMes,
  menorSaldo, pagosEmDia, PARAMETROS_PADRAO, progressoDoMes, rotuloDeDia, rotuloDePessoas,
  separarExcecoes, serieProjecao, situacaoDoQueFaltaPagar, somarDias,
  type ColunaDia, type Excecao, type FaixaAging, type ParametrosDashboard,
  type ParcelaAberta, type ProgressoMes, type SituacaoPagar,
} from "@/lib/data/dashboard-financeiro";

/**
 * Leitura do Dashboard Financeiro (spec da página 1, partes §4 a §7).
 *
 * A spec descreve um modelo de títulos e parcelas com direção `in`/`out`. Aqui
 * ele já existe, repartido em duas tabelas: `payments` é a parcela `in`
 * (Asaas e manual) e `expenses` é a `out`. Este módulo traduz uma na outra e
 * entrega os dois painéis com a MESMA forma, que é o que a spec pede em §7.
 *
 * Três coisas do documento-mãe o banco ainda não tem, e a tela diz isso em vez
 * de mostrar meia conta:
 *  • `scheduled_payment_date` — a data programada de pagamento. Enquanto não
 *    existir, "programado" é a despesa já aprovada e não vencida;
 *  • recorrência de receita com reajuste — por isso não há exceção I4;
 *  • baixa parcial. `open_balance` é o valor cheio enquanto a parcela está
 *    aberta, e zero depois.
 *
 * Tudo em centavos; as tabelas guardam reais em numeric(12,2) e a conversão
 * acontece na fronteira.
 */

const paraCent = (reais: unknown) => Math.round((Number(reais) || 0) * 100);

/**
 * Primeiro valor que realmente tem texto.
 *
 * `?? "fallback"` não basta: no banco o campo vazio costuma ser string vazia,
 * não null, e foi assim que "O mais antigo é , há 81 dias" chegou à tela.
 */
const primeiroTexto = (...valores: unknown[]): string => {
  for (const v of valores) {
    const t = String(v ?? "").trim();
    if (t) return t;
  }
  return "";
};

/** Status do Asaas que significam dinheiro na conta. */
const RECEBIDO = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "DUNNING_RECEIVED"]);

const semMigracao = (e: unknown) => {
  const c = (e as { code?: string })?.code;
  const m = e instanceof Error ? e.message : String(e ?? "");
  return c === "42P01" || c === "42703" || /does not exist/i.test(m);
};

/* ── O que a página recebe ─────────────────────────────────────────────── */

export type ContaNoPopover = {
  id: string;
  nome: string;
  saldoCent: number;
  /** Gateway liquida em D+1: o saldo existe, mas ainda não dá para gastar. */
  liquidezD1: boolean;
  /** Dias desde a última importação de extrato, quando a conta exige uma. */
  diasSemExtrato: number | null;
};

export type ProximoLancamento = {
  pessoa: string;
  quando: string;
  valorCent: number;
  nota: string;
} | null;

export type PainelFluxo = {
  progresso: ProgressoMes;
  ultimos7: { valorCent: number; qtd: number };
  proximos7: { valorCent: number; qtd: number };
  vencido: { valorCent: number; qtd: number; detalhe: string };
  barra: ColunaDia[];
  barraDe: string;
  barraAte: string;
  proximo: ProximoLancamento;
};

export type PainelRecebimentos = PainelFluxo & {
  aging: FaixaAging[];
  atrasoMedioDias: number | null;
  inadimplencia90Pct: number | null;
};

export type PainelPagamentos = PainelFluxo & {
  situacao: SituacaoPagar;
  aprovacaoLigada: boolean;
  pagosEmDiaPct: number | null;
  maiorSaidaPrevista: { descricao: string; dataIso: string; valorCent: number } | null;
};

/** Uma linha de "Esta semana" (§8.2). */
export type LancamentoSemana = {
  id: string;
  /** `in` é parcela de `payments`; `out`, de `expenses`. */
  direcao: "in" | "out";
  dataIso: string;
  dataLabel: string;
  hoje: boolean;
  pessoa: string;
  descricao: string;
  /** O selo da coluna Situação. */
  situacao: string;
  situacaoTom: "ok" | "atencao" | "neutro" | "info";
  conta: string;
  valorCent: number;
  /** O botão contextual da linha (§8.3). */
  acao: "baixa" | "aprovar" | "ver-cobranca" | "nenhuma";
  acaoLabel: string;
};

export type SemanaView = {
  ateIso: string;
  ateLabel: string;
  lancamentos: LancamentoSemana[];
};

/** Um passo do checklist de implantação (§11), derivado dos dados. */
export type PassoImplantacao = {
  n: number;
  titulo: string;
  detalhe: string;
  feito: boolean;
  href: string;
};

export type DashboardFinanceiro = {
  /** Supabase fora do ar ou não configurado: a página não inventa número. */
  semDados: boolean;
  /** Falta a migração 0148. A página funciona, mas avisa. */
  pendente: boolean;
  hojeIso: string;
  dataLabel: string;
  atualizadoEm: string;
  parametros: ParametrosDashboard;
  /** Existe conta que depende de importação manual de extrato (§4). */
  podeImportarExtrato: boolean;
  desdeOntem: {
    label: string;
    entradas: { valorCent: number; qtd: number };
    saidas: { valorCent: number; qtd: number };
    destaque: string | null;
    href: string;
  } | null;
  excecoes: { principais: Excecao[]; avisos: Excecao[]; totalPrincipais: number };
  /** Só faz sentido no estado vazio "Tudo em dia" (§5.3 regra 7). */
  tudoEmDia: { ultimaConciliacao: string | null; proximaSaida: string | null };
  saldo: {
    totalCent: number;
    folegoMeses: number | null;
    contas: ContaNoPopover[];
    foraDoDisponivel: ContaNoPopover[];
    semContas: boolean;
  };
  caixa30: {
    saldoCent: number;
    menorCent: number | null;
    menorEm: string | null;
    abaixoDaReserva: boolean;
  };
  resultado: {
    liquidoCent: number;
    margemPct: number | null;
    pctRealizado: number;
    volumeCent: number;
    mesLabel: string;
  };
  receita: {
    mrrCent: number;
    pontualCent: number;
    recorrenteFaturadoCent: number;
    totalCent: number;
    pctRecorrente: number;
    deltaMrr30Cent: number | null;
  };
  recebimentos: PainelRecebimentos;
  pagamentos: PainelPagamentos;
  semana: SemanaView;
  panorama: PanoramaView;
  /**
   * Passos 1 ou 4 incompletos: a página vira o checklist (§11). Sem conta com
   * saldo e sem receita recorrente não há saldo, projeção, MRR nem resultado —
   * mostrar os blocos zerados pareceria empresa quebrada, não implantação.
   */
  primeiroUso: { ativo: boolean; passos: PassoImplantacao[]; feitos: number };
};

/* ── Estado vazio ──────────────────────────────────────────────────────── */

const PAINEL_VAZIO: PainelFluxo = {
  progresso: progressoDoMes(0, 0, 0),
  ultimos7: { valorCent: 0, qtd: 0 },
  proximos7: { valorCent: 0, qtd: 0 },
  vencido: { valorCent: 0, qtd: 0, detalhe: "" },
  barra: [],
  barraDe: "",
  barraAte: "",
  proximo: null,
};

function vazio(hojeIso: string, semDados: boolean): DashboardFinanceiro {
  const { primeiro } = limitesDoMes(hojeIso);
  return {
    semDados,
    pendente: false,
    hojeIso,
    dataLabel: dataPorExtenso(hojeIso),
    atualizadoEm: horaSP(),
    parametros: PARAMETROS_PADRAO,
    podeImportarExtrato: false,
    desdeOntem: null,
    excecoes: { principais: [], avisos: [], totalPrincipais: 0 },
    tudoEmDia: { ultimaConciliacao: null, proximaSaida: null },
    saldo: { totalCent: 0, folegoMeses: null, contas: [], foraDoDisponivel: [], semContas: true },
    caixa30: { saldoCent: 0, menorCent: null, menorEm: null, abaixoDaReserva: false },
    resultado: {
      liquidoCent: 0, margemPct: null, pctRealizado: 0, volumeCent: 0,
      mesLabel: mesPorExtenso(primeiro),
    },
    receita: {
      mrrCent: 0, pontualCent: 0, recorrenteFaturadoCent: 0, totalCent: 0,
      pctRecorrente: 0, deltaMrr30Cent: null,
    },
    semana: { ateIso: somarDias(hojeIso, 7), ateLabel: ddmm(somarDias(hojeIso, 7)), lancamentos: [] },
    panorama: PANORAMA_VAZIO,
    primeiroUso: { ativo: false, passos: [], feitos: 0 },
    recebimentos: { ...PAINEL_VAZIO, aging: aging([]), atrasoMedioDias: null, inadimplencia90Pct: null },
    pagamentos: {
      ...PAINEL_VAZIO,
      situacao: situacaoDoQueFaltaPagar([], hojeIso, false),
      aprovacaoLigada: false, pagosEmDiaPct: null, maiorSaidaPrevista: null,
    },
  };
}

const MESES = [
  "", "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function mesPorExtenso(iso: string): string {
  return MESES[Number(iso.slice(5, 7))] ?? "";
}

/* ── Destinos (§2: todo número leva a algum lugar) ─────────────────────── */

const R = "/gerencial/financeiro";

/**
 * Cada destino já leva o filtro (§2). As chaves de URL são as que a tela de
 * destino lê — sem elas o clique abriria a página certa na aba errada, que é
 * o mesmo que não levar a lugar nenhum.
 */
const DESTINO = {
  recebimentos: `${R}/recebimentos`,
  recebimentosVencidos: `${R}/recebimentos?visao=vencidas`,
  recebimentosSemCobranca: `${R}/recebimentos?chip=sem-cobranca`,
  pagamentos: `${R}/pagamentos`,
  pagamentosVencidos: `${R}/pagamentos?visao=vencidas`,
  pagamentosDoDia: `${R}/pagamentos`,
  aprovacoes: `${R}/pagamentos?visao=aprovar`,
  caixa: `${R}/caixa?aba=extrato`,
  conciliacao: `${R}/caixa?aba=conciliacao`,
  fluxo: `${R}/caixa`,
  extrato: `${R}/caixa?aba=extrato`,
  dre: `${R}/resultados`,
  receita: `${R}/resultados?aba=receita`,
  orcamento: `${R}/planejamento`,
  fechamento: `${R}/configuracoes`,
};

/* ── Leitura ───────────────────────────────────────────────────────────── */

type Linha = Record<string, unknown>;
/** Os parâmetros de §13, tolerantes à ausência da 0148. */
async function lerParametros(db: SupabaseClient): Promise<{
  parametros: ParametrosDashboard;
  aprovacaoLigada: boolean;
  fechadoAte: string | null;
  pendente: boolean;
}> {
  const base = {
    parametros: PARAMETROS_PADRAO,
    aprovacaoLigada: false,
    fechadoAte: null as string | null,
    pendente: true,
  };
  // Em degraus, como o resto do módulo: sem a 0148 ainda dá para ler alçada e
  // fechamento, que vêm de migrações anteriores.
  const novo = await db
    .from("finance_settings")
    .select(
      "approval_threshold, closed_until, min_cash_reserve, charge_lead_days, " +
      "stale_statement_days, unconfirmed_days, reconcile_max_open, reconcile_max_days, " +
      "budget_tolerance, closing_due_day",
    )
    .eq("id", 1)
    .maybeSingle();

  if (novo.error) {
    const antigo = await db
      .from("finance_settings")
      .select("approval_threshold, closed_until")
      .eq("id", 1)
      .maybeSingle();
    const r = (antigo.data ?? {}) as Linha;
    return {
      ...base,
      aprovacaoLigada: Number(r.approval_threshold ?? 0) > 0,
      fechadoAte: (r.closed_until as string) ?? null,
    };
  }

  const r = (novo.data ?? {}) as Linha;
  return {
    pendente: false,
    aprovacaoLigada: Number(r.approval_threshold ?? 0) > 0,
    fechadoAte: (r.closed_until as string) ?? null,
    parametros: {
      reservaMinimaCent: paraCent(r.min_cash_reserve ?? 0),
      diasAntecedenciaCobranca: Number(r.charge_lead_days ?? 5),
      diasSemExtrato: Number(r.stale_statement_days ?? 7),
      diasBaixaSemConfirmacao: Number(r.unconfirmed_days ?? 7),
      limiteConciliacaoQtd: Number(r.reconcile_max_open ?? 20),
      limiteConciliacaoDias: Number(r.reconcile_max_days ?? 7),
      toleranciaOrcamentoPct: Number(r.budget_tolerance ?? 110),
      diaCobrancaFechamento: Number(r.closing_due_day ?? 10),
    },
  };
}

/** Contas ativas, com as duas flags da 0148 (ausentes: disponível e sem extrato). */
async function lerContas(db: SupabaseClient) {
  const completo = await db
    .from("financial_accounts")
    .select("id, name, kind, opening_balance, counts_as_available, requires_statement_confirmation")
    .eq("active", true)
    .order("position");
  const base = completo.error
    ? await db.from("financial_accounts").select("id, name, kind, opening_balance").eq("active", true)
    : completo;
  return ((base.data ?? []) as Linha[]).map((c) => ({
    id: String(c.id),
    nome: String(c.name ?? "Conta"),
    kind: String(c.kind ?? "banco"),
    aberturaCent: paraCent(c.opening_balance),
    disponivel: c.counts_as_available === undefined ? true : Boolean(c.counts_as_available),
    exigeExtrato:
      c.requires_statement_confirmation === undefined
        ? String(c.kind ?? "banco") === "banco"
        : Boolean(c.requires_statement_confirmation),
  }));
}

export async function getDashboardFinanceiro(
  userId?: string | null,
  agora: Date = new Date(),
): Promise<DashboardFinanceiro> {
  const hoje = hojeSP(agora);
  if (!isSupabaseConfigured()) return vazio(hoje, true);

  try {
    return await montar(await createClient(), userId ?? null, hoje, agora);
  } catch (e) {
    // Tabela que falta é caso conhecido; o resto sobe, porque esconder erro de
    // consulta aqui viraria um dashboard silenciosamente errado.
    if (semMigracao(e)) return { ...vazio(hoje, false), pendente: true };
    throw e;
  }
}

async function montar(
  db: SupabaseClient,
  userId: string | null,
  hoje: string,
  agora: Date,
): Promise<DashboardFinanceiro> {
  const { primeiro: mesIni, ultimo: mesFim } = limitesDoMes(hoje);
  const ontem = somarDias(hoje, -1);
  const menos7 = somarDias(hoje, -7);
  const menos90 = somarDias(hoje, -90);
  const mais7 = somarDias(hoje, 7);
  const mais30 = somarDias(hoje, 30);

  const cfg = await lerParametros(db);
  const p = cfg.parametros;
  const contas = await lerContas(db);
  const idsContas = contas.map((c) => c.id);

  // A fonte é o NÚCLEO (§23.1 do documento-mãe), não mais `payments` e
  // `expenses`. O adaptador devolve as linhas no formato antigo para a lógica
  // já verificada abaixo continuar valendo — ver nucleo-adaptador.ts.
  const nucleo = await lerNucleoComoLegado(db, {
    hoje, mesIni, mesFim, menos90, mais30, idsContas,
  });
  const comoPaginado = (linhas: Linha[]) => ({ linhas, truncado: false, erro: null });
  const saldoEntradas = comoPaginado(nucleo.saldoEntradas);
  const saldoSaidas = comoPaginado(nucleo.saldoSaidas);
  const recLiquidados = comoPaginado(nucleo.recLiquidados);
  const recAbertos = comoPaginado(nucleo.recAbertos);
  const recMes = comoPaginado(nucleo.recMes);
  const recVencidos90 = comoPaginado(nucleo.recVencidos90);
  const despLiquidadas = comoPaginado(nucleo.despLiquidadas);
  const despAbertas = comoPaginado(nucleo.despAbertas);
  const despMes = comoPaginado(nucleo.despMes);

  const [transferencias, categorias, orcamentos, clientes, movimentosMrr] = await Promise.all([
    idsContas.length
      ? buscarTudo<Linha>((a, b) => db.from("account_transfers")
          .select("amount, from_account, to_account").range(a, b))
      : Promise.resolve({ linhas: [] as Linha[], truncado: false, erro: null }),
    db.from("expense_categories").select("key, label, impact_type"),
    db.from("budgets").select("category_key, amount").eq("month", mesIni),
    db.from("clients").select("monthly_fee, status"),
    db.from("mrr_movements").select("amount_cents, type, effective_date").gte("effective_date", somarDias(hoje, -30)),
  ]);

  /* ── Saldo por conta (§6.1) ──────────────────────────────────────────── */

  const saldoDaConta = new Map(contas.map((c) => [c.id, c.aberturaCent]));
  const soma = (id: unknown, delta: number) => {
    const k = String(id ?? "");
    if (saldoDaConta.has(k)) saldoDaConta.set(k, (saldoDaConta.get(k) ?? 0) + delta);
  };
  for (const r of saldoEntradas.linhas) {
    if (RECEBIDO.has(String(r.status ?? ""))) soma(r.account_id, paraCent(r.value));
  }
  for (const d of saldoSaidas.linhas) {
    if (d.status === "paid") soma(d.account_id, -paraCent(d.amount));
  }
  for (const t of transferencias.linhas) {
    const v = paraCent(t.amount);
    soma(t.to_account, v);
    soma(t.from_account, -v);
  }

  // Última importação de extrato por conta (I1 e o selo do popover).
  const ultimoExtrato = new Map<string, string>();
  let temTabelaExtrato = true;
  {
    const r = await db
      .from("bank_statements")
      .select("account_id, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (r.error) temTabelaExtrato = false;
    for (const s of ((r.data ?? []) as Linha[])) {
      const k = String(s.account_id ?? "");
      if (k && !ultimoExtrato.has(k)) ultimoExtrato.set(k, String(s.created_at ?? "").slice(0, 10));
    }
  }

  const paraPopover = (c: (typeof contas)[number]): ContaNoPopover => {
    const ultimo = ultimoExtrato.get(c.id);
    return {
      id: c.id,
      nome: c.nome,
      saldoCent: saldoDaConta.get(c.id) ?? 0,
      liquidezD1: c.kind === "gateway",
      diasSemExtrato:
        c.exigeExtrato && temTabelaExtrato ? (ultimo ? diasEntre(ultimo, hoje) : null) : null,
    };
  };

  const disponiveis = contas.filter((c) => c.disponivel).map(paraPopover);
  const foraDoDisponivel = contas.filter((c) => !c.disponivel).map(paraPopover);
  const saldoCent = disponiveis.reduce((s, c) => s + c.saldoCent, 0);
  const podeImportarExtrato = contas.some((c) => c.exigeExtrato) && temTabelaExtrato;

  /* ── Parcelas abertas, nas duas direções ─────────────────────────────── */

  const aberto = (r: Linha) => {
    const s = String(r.status ?? "");
    return !RECEBIDO.has(s) && !STATUS_IGNORAR.has(s);
  };

  const entradasAbertas = recAbertos.linhas
    .filter(aberto)
    .map((r) => ({
      id: String(r.id),
      dataIso: String(r.due_date ?? ""),
      valorCent: paraCent(r.value),
      clienteId: r.client_id ? String(r.client_id) : null,
      descricao: primeiroTexto(r.description, "Recebimento sem descrição"),
      temCobranca: Boolean(r.invoice_url),
      contaId: r.account_id ? String(r.account_id) : null,
      // Cobrança do Asaas não se baixa aqui: quem manda no status dela é o
      // gateway, e a API de recebíveis recusa a edição (por bom motivo).
      doAsaas: String(r.source ?? "asaas") === "asaas",
    }))
    .filter((r) => r.dataIso);

  const saidasAbertas = despAbertas.linhas
    .filter((d) => d.status !== "paid")
    .map((d) => ({
      id: String(d.id),
      dataIso: String(d.due_date ?? ""),
      valorCent: paraCent(d.amount),
      pessoa: primeiroTexto(d.vendor, d.description, "Pagamento sem descrição"),
      descricao: primeiroTexto(d.description, d.vendor, "Pagamento sem descrição"),
      // Sem `scheduled_payment_date` no banco, a conta escolhida é o sinal
      // equivalente: quem já decidiu de onde o dinheiro sai, programou.
      temConta: Boolean(d.account_id),
      contaId: d.account_id ? String(d.account_id) : null,
      aguardandoAprovacao: String(d.approval_status ?? "approved") === "pending",
    }))
    .filter((d) => d.dataIso);

  const entradasVencidas = entradasAbertas.filter((r) => r.dataIso < hoje);
  const saidasVencidas = saidasAbertas.filter((d) => d.dataIso < hoje);

  const paraProjecao = (l: { dataIso: string; valorCent: number }): ParcelaAberta => ({
    dataIso: l.dataIso, valorCent: l.valorCent,
  });

  /* ── Pulso: caixa em 30 dias (§6, §12) ───────────────────────────────── */

  const serie = serieProjecao(
    saldoCent, entradasAbertas.map(paraProjecao), saidasAbertas.map(paraProjecao), hoje, 30,
  );
  const menor = menorSaldo(serie);
  // O card de 30 dias é o último ponto da própria série: duas contas separadas
  // para o mesmo número é exatamente como elas começam a divergir.
  const saldo30 = serie[serie.length - 1]?.saldoCent ?? saldoCent;

  /* ── Pulso: resultado do mês (§6.3) ──────────────────────────────────── */

  const impactoDa = new Map<string, ImpactType>();
  for (const c of ((categorias.data ?? []) as Linha[])) {
    if (c.impact_type) impactoDa.set(String(c.key), c.impact_type as ImpactType);
  }

  const totais: TotaisPorImpacto = {};
  const somaImpacto = (i: ImpactType, v: number) => { totais[i] = (totais[i] ?? 0) + v; };

  let receitaMesCent = 0;
  let recorrenteFaturadoCent = 0;
  let receitaRealizadaCent = 0;
  const pontuaisBrutos: { clienteId: string | null; descricao: string; valorCent: number }[] = [];
  for (const r of recMes.linhas) {
    const s = String(r.status ?? "");
    if (STATUS_IGNORAR.has(s)) continue;
    const v = paraCent(r.value);
    receitaMesCent += v;
    if (RECEBIDO.has(s)) receitaRealizadaCent += v;
    // `raw.subscription` é o `recurrence_id` deste modelo: o Asaas marca assim
    // a cobrança gerada por assinatura. Sem ele, o título é pontual (§6.2).
    const raw = (r.raw ?? null) as { subscription?: string } | null;
    if (raw?.subscription) recorrenteFaturadoCent += v;
    else {
      pontuaisBrutos.push({
        clienteId: r.client_id ? String(r.client_id) : null,
        descricao: primeiroTexto(r.description, "Receita pontual"),
        valorCent: v,
      });
    }
  }
  somaImpacto("operating_revenue", receitaMesCent);

  let saidasResultadoCent = 0;
  let saidasRealizadasCent = 0;
  const realizadoPorCategoria = new Map<string, number>();
  for (const d of despMes.linhas) {
    const imp = impactoDa.get(String(d.category ?? ""));
    const v = paraCent(d.amount);
    realizadoPorCategoria.set(
      String(d.category ?? ""), (realizadoPorCategoria.get(String(d.category ?? "")) ?? 0) + v,
    );
    if (!imp) continue;
    somaImpacto(imp, v);
    // Só o que entra na DRE conta como "saída de resultado" (§12).
    if (imp !== "investment" && imp !== "equity_financing") {
      saidasResultadoCent += v;
      if (d.status === "paid") saidasRealizadasCent += v;
    }
  }

  const dre = montarDre(totais);
  const volumeCent = receitaMesCent + saidasResultadoCent;
  const realizadoCent = receitaRealizadaCent + saidasRealizadasCent;

  /* ── Pulso: MRR e pontual (§6.2) ─────────────────────────────────────── */

  const clientesLinhas = (clientes.data ?? []) as Linha[];
  const mrrCent = clientesLinhas
    .filter((c) => String(c.status ?? "") !== "churn")
    .reduce((s, c) => s + paraCent(c.monthly_fee), 0);
  const pontualCent = Math.max(0, receitaMesCent - recorrenteFaturadoCent);
  const deltaMrr30Cent = movimentosMrr.error
    ? null
    : ((movimentosMrr.data ?? []) as Linha[]).reduce((s, m) => {
        const v = Math.round(Number(m.amount_cents) || 0);
        const perda = ["contraction", "churn", "pause"].includes(String(m.type ?? ""));
        return s + (perda ? -Math.abs(v) : Math.abs(v));
      }, 0);

  /* ── Bloco 3: os dois painéis (§7) ───────────────────────────────────── */

  const nomeDoCliente = new Map<string, string>();
  {
    const ids = [...new Set(entradasAbertas.map((e) => e.clienteId).filter(Boolean))] as string[];
    if (ids.length) {
      const r = await db.from("clients").select("id, name").in("id", ids.slice(0, 500));
      for (const c of ((r.data ?? []) as Linha[])) nomeDoCliente.set(String(c.id), String(c.name ?? ""));
    }
  }

  const baixasEntrada = recLiquidados.linhas
    .filter((r) => RECEBIDO.has(String(r.status ?? "")))
    .map((r) => ({
      dataIso: String(r.payment_date ?? "").slice(0, 10),
      vencimentoIso: String(r.due_date ?? "").slice(0, 10),
      valorCent: paraCent(r.value),
      naoConfirmada: !r.reconciled_at,
      pessoa: primeiroTexto(nomeDoCliente.get(String(r.client_id ?? "")), r.description, "Cliente"),
    }))
    .filter((r) => r.dataIso);

  const baixasSaida = despLiquidadas.linhas
    .filter((d) => d.status === "paid")
    .map((d) => ({
      dataIso: String(d.paid_date ?? "").slice(0, 10),
      vencimentoIso: String(d.due_date ?? "").slice(0, 10),
      valorCent: paraCent(d.amount),
      naoConfirmada: !d.reconciled_at,
      pessoa: primeiroTexto(d.vendor, d.description, "Fornecedor"),
    }))
    .filter((d) => d.dataIso);

  const noIntervalo = <T extends { dataIso: string }>(l: T[], de: string, ate: string) =>
    l.filter((x) => x.dataIso >= de && x.dataIso <= ate);

  function painel(
    baixas: typeof baixasEntrada,
    abertas: { dataIso: string; valorCent: number }[],
    mesTotalCent: number,
    mesBaixadoCent: number,
  ): PainelFluxo {
    const ult7 = noIntervalo(baixas, menos7, ontem);
    const prox7 = noIntervalo(abertas, hoje, mais7);
    const vencidas = abertas.filter((a) => a.dataIso < hoje);
    const barra = barraDiaADia(
      baixas.map((b) => ({ dataIso: b.dataIso, valorCent: b.valorCent })),
      abertas.map((a) => ({ dataIso: a.dataIso, valorCent: a.valorCent })),
      hoje,
    );
    return {
      progresso: progressoDoMes(
        mesBaixadoCent, vencidas.reduce((s, v) => s + v.valorCent, 0), mesTotalCent,
      ),
      ultimos7: { valorCent: ult7.reduce((s, x) => s + x.valorCent, 0), qtd: ult7.length },
      proximos7: { valorCent: prox7.reduce((s, x) => s + x.valorCent, 0), qtd: prox7.length },
      vencido: {
        valorCent: vencidas.reduce((s, x) => s + x.valorCent, 0),
        qtd: vencidas.length,
        detalhe: "",
      },
      barra,
      barraDe: ddmm(somarDias(hoje, -7)),
      barraAte: ddmm(mais7),
      proximo: null,
    };
  }

  // Recebimentos ---------------------------------------------------------
  const despesaMesTotal = despMes.linhas.reduce((s, d) => s + paraCent(d.amount), 0);
  const despesaMesPaga = despMes.linhas
    .filter((d) => d.status === "paid")
    .reduce((s, d) => s + paraCent(d.amount), 0);

  const painelIn = painel(
    baixasEntrada, entradasAbertas.map(paraProjecao), receitaMesCent, receitaRealizadaCent,
  );
  const clientesVencidos = new Set(
    entradasVencidas.map((e) => e.clienteId ?? e.descricao),
  );
  const maisAntigo = [...entradasVencidas].sort((a, b) => a.dataIso.localeCompare(b.dataIso))[0];
  painelIn.vencido.detalhe = clientesVencidos.size
    ? `${clientesVencidos.size} ${clientesVencidos.size === 1 ? "cliente" : "clientes"}`
    : "";

  const proximaEntrada = [...entradasAbertas]
    .filter((e) => e.dataIso >= hoje)
    .sort((a, b) => a.dataIso.localeCompare(b.dataIso))[0];
  if (proximaEntrada) {
    painelIn.proximo = {
      pessoa: primeiroTexto(nomeDoCliente.get(proximaEntrada.clienteId ?? ""), proximaEntrada.descricao),
      quando: rotuloDeDia(proximaEntrada.dataIso, hoje),
      valorCent: proximaEntrada.valorCent,
      nota: proximaEntrada.temCobranca ? "cobrança enviada" : "sem cobrança",
    };
  }

  const baixas90In = baixasEntrada.filter((b) => b.vencimentoIso);
  const recebimentos: PainelRecebimentos = {
    ...painelIn,
    aging: aging(entradasVencidas.map((e) => ({
      diasAtraso: diasEntre(e.dataIso, hoje), valorCent: e.valorCent,
    }))),
    atrasoMedioDias: atrasoMedio(
      baixas90In.map((b) => ({ vencimentoIso: b.vencimentoIso, pagamentoIso: b.dataIso })),
    ),
    // Inadimplência 90d: do que venceu nos últimos 90 dias, quanto ainda não
    // entrou. Canceladas e estornadas ficam fora dos dois lados da divisão.
    inadimplencia90Pct: (() => {
      const venceu = recVencidos90.linhas.filter((r) => !STATUS_IGNORAR.has(String(r.status ?? "")));
      const total = venceu.reduce((s, r) => s + paraCent(r.value), 0);
      if (total <= 0) return null;
      const naoPago = venceu
        .filter((r) => !RECEBIDO.has(String(r.status ?? "")))
        .reduce((s, r) => s + paraCent(r.value), 0);
      return Math.round((naoPago / total) * 1000) / 10;
    })(),
  };

  // Pagamentos -----------------------------------------------------------
  const painelOut = painel(
    baixasSaida, saidasAbertas.map(paraProjecao), despesaMesTotal, despesaMesPaga,
  );
  const maisAntigaSaida = [...saidasVencidas].sort((a, b) => a.dataIso.localeCompare(b.dataIso))[0];
  painelOut.vencido.detalhe = maisAntigaSaida
    ? `${saidasVencidas.length} ${saidasVencidas.length === 1 ? "conta" : "contas"}, há ${diasEntre(maisAntigaSaida.dataIso, hoje)} dias`
    : "";

  const proximasSaidas = [...saidasAbertas]
    .filter((d) => d.dataIso >= hoje)
    .sort((a, b) => a.dataIso.localeCompare(b.dataIso));
  const diaDaProxima = proximasSaidas[0]?.dataIso;
  const doMesmoDia = proximasSaidas.filter((d) => d.dataIso === diaDaProxima);
  if (doMesmoDia.length) {
    const semProgramacao = doMesmoDia.filter((d) => d.aguardandoAprovacao).length;
    painelOut.proximo = {
      pessoa: rotuloDePessoas(doMesmoDia.map((d) => d.pessoa)),
      quando: rotuloDeDia(diaDaProxima, hoje),
      valorCent: doMesmoDia.reduce((s, d) => s + d.valorCent, 0),
      nota: cfg.aprovacaoLigada && semProgramacao
        ? `${semProgramacao} aguardando aprovação`
        : "",
    };
  }

  const saidasDoMesAbertas = saidasAbertas.filter(
    (d) => d.dataIso >= mesIni && d.dataIso <= mesFim,
  );
  const maiorPrevista = [...saidasAbertas]
    .filter((d) => d.dataIso >= hoje && d.dataIso <= mais30)
    .sort((a, b) => b.valorCent - a.valorCent)[0];

  const pagamentos: PainelPagamentos = {
    ...painelOut,
    situacao: situacaoDoQueFaltaPagar(
      saidasDoMesAbertas.map((d) => ({
        valorCent: d.valorCent,
        vencimentoIso: d.dataIso,
        programadaParaIso: d.temConta ? d.dataIso : null,
        aguardandoAprovacao: d.aguardandoAprovacao,
      })),
      hoje,
      cfg.aprovacaoLigada,
    ),
    aprovacaoLigada: cfg.aprovacaoLigada,
    pagosEmDiaPct: pagosEmDia(
      baixasSaida
        .filter((b) => b.vencimentoIso)
        .map((b) => ({ vencimentoIso: b.vencimentoIso, pagamentoIso: b.dataIso, valorCent: b.valorCent })),
    ),
    maiorSaidaPrevista: maiorPrevista
      ? { descricao: maiorPrevista.pessoa, dataIso: maiorPrevista.dataIso, valorCent: maiorPrevista.valorCent }
      : null,
  };

  /* ── Bloco 1: as exceções (§5.1) ─────────────────────────────────────── */

  const excecoes: Excecao[] = [];
  const add = (e: Excecao) => excecoes.push(e);

  // E1 — pagamento vencido.
  if (saidasVencidas.length) {
    const total = saidasVencidas.reduce((s, d) => s + d.valorCent, 0);
    const pior = [...saidasVencidas].sort((a, b) => a.dataIso.localeCompare(b.dataIso))[0];
    add({
      chave: chaveDeExcecao("E1"), tipo: "E1", gravidade: "critico", valorCent: total,
      titulo: `${brlCheio(total)} em pagamento vencido`,
      detalhe: saidasVencidas.length === 1
        ? `${pior.pessoa}, venceu há ${diasEntre(pior.dataIso, hoje)} dias`
        : `${rotuloDePessoas(saidasVencidas.map((d) => d.pessoa))}. A mais antiga é ${
            pior.pessoa}, há ${diasEntre(pior.dataIso, hoje)} dias`,
      destino: "Pagamentos, vencidos", href: DESTINO.pagamentosVencidos,
    });
  }

  // E2 — caixa abaixo do mínimo.
  if (menor && menor.saldoCent < p.reservaMinimaCent) {
    const dias = diasEntre(hoje, menor.dataIso);
    add({
      chave: chaveDeExcecao("E2"), tipo: "E2", gravidade: gravidadeCaixaMinimo(dias),
      valorCent: Math.abs(p.reservaMinimaCent - menor.saldoCent),
      titulo: `Caixa chega a ${brlCheio(menor.saldoCent)} em ${ddmm(menor.dataIso)}`,
      detalhe: p.reservaMinimaCent > 0
        ? `Abaixo da reserva mínima de ${brlCheio(p.reservaMinimaCent)}, ${emQuantoTempo(dias)}`
        : `Saldo projetado fica negativo ${emQuantoTempo(dias)}`,
      destino: "Caixa, fluxo no dia", href: DESTINO.fluxo,
    });
  }

  // E3 — recebimentos vencidos.
  if (entradasVencidas.length && maisAntigo) {
    const total = entradasVencidas.reduce((s, e) => s + e.valorCent, 0);
    const atraso = diasEntre(maisAntigo.dataIso, hoje);
    add({
      chave: chaveDeExcecao("E3"), tipo: "E3",
      gravidade: gravidadeRecebimentosVencidos(atraso), valorCent: total,
      titulo: `${brlCheio(total)} em recebimentos vencidos`,
      detalhe: (() => {
        const quem = primeiroTexto(nomeDoCliente.get(maisAntigo.clienteId ?? ""), maisAntigo.descricao);
        return clientesVencidos.size === 1
          ? `${quem}, há ${atraso} dias`
          : `${clientesVencidos.size} clientes. O mais antigo é ${quem}, há ${atraso} dias`;
      })(),
      destino: "Recebimentos, vencidos", href: DESTINO.recebimentosVencidos,
    });
  }

  // E4 — pagamentos de hoje e amanhã.
  const hojeEAmanha = saidasAbertas.filter((d) => d.dataIso === hoje || d.dataIso === somarDias(hoje, 1));
  if (hojeEAmanha.length) {
    const total = hojeEAmanha.reduce((s, d) => s + d.valorCent, 0);
    const pendentes = hojeEAmanha.filter((d) => d.aguardandoAprovacao).length;
    add({
      chave: chaveDeExcecao("E4"), tipo: "E4", gravidade: "atencao", valorCent: total,
      titulo: `${brlCheio(total)} vencem hoje e amanhã`,
      detalhe: `${hojeEAmanha.length} ${hojeEAmanha.length === 1 ? "conta a pagar" : "contas a pagar"}${
        cfg.aprovacaoLigada && pendentes ? `, ${pendentes} aguardando aprovação` : ""}`,
      destino: "Pagamentos, hoje e amanhã", href: DESTINO.pagamentosDoDia,
    });
  }

  // E5 — cobrança não enviada. `invoice_url` é a cobrança ativa deste modelo.
  const semCobranca = entradasAbertas.filter(
    (e) => !e.temCobranca && e.dataIso >= hoje && e.dataIso <= somarDias(hoje, p.diasAntecedenciaCobranca),
  );
  if (semCobranca.length) {
    const total = semCobranca.reduce((s, e) => s + e.valorCent, 0);
    const ultima = [...semCobranca].sort((a, b) => b.dataIso.localeCompare(a.dataIso))[0];
    add({
      chave: chaveDeExcecao("E5"), tipo: "E5", gravidade: "atencao", valorCent: total,
      titulo: `${semCobranca.length} ${semCobranca.length === 1 ? "cobrança não enviada" : "cobranças não enviadas"}`,
      detalhe: `${rotuloDePessoas(
        semCobranca.map((e) => primeiroTexto(nomeDoCliente.get(e.clienteId ?? ""), e.descricao)),
        "clientes",
      )}, ${semCobranca.length === 1 ? "vence" : "vencem"} até ${ddmm(ultima.dataIso)}`,
      destino: "Recebimentos, emitir cobranças", href: DESTINO.recebimentosSemCobranca,
    });
  }

  // E6 — aprovações pendentes. Só existe se a alçada estiver ligada.
  if (cfg.aprovacaoLigada) {
    const aprovar = saidasAbertas.filter((d) => d.aguardandoAprovacao);
    if (aprovar.length) {
      const total = aprovar.reduce((s, d) => s + d.valorCent, 0);
      add({
        chave: chaveDeExcecao("E6"), tipo: "E6", gravidade: "atencao", valorCent: total,
        titulo: `${brlCheio(total)} aguardando aprovação`,
        detalhe: `${aprovar.length} ${aprovar.length === 1 ? "despesa" : "despesas"} acima da alçada`,
        destino: "Pagamentos, a aprovar", href: DESTINO.aprovacoes,
      });
    }
  }

  // E7 — conciliação pendente.
  const naoConciliadas = await db
    .from("bank_entries")
    .select("date")
    .is("matched_id", null)
    .eq("ignored", false)
    .order("date")
    .limit(1000);
  if (!naoConciliadas.error) {
    const linhas = (naoConciliadas.data ?? []) as Linha[];
    if (linhas.length) {
      const maisVelha = String(linhas[0].date ?? hoje);
      const dias = diasEntre(maisVelha, hoje);
      add({
        chave: chaveDeExcecao("E7"), tipo: "E7",
        gravidade: gravidadeConciliacao(linhas.length, dias, p), valorCent: linhas.length,
        titulo: `${linhas.length} ${linhas.length === 1 ? "movimentação não conciliada" : "movimentações não conciliadas"}`,
        detalhe: `A mais antiga é de ${dias} ${dias === 1 ? "dia" : "dias"} atrás`,
        destino: "Caixa, conciliação", href: DESTINO.conciliacao,
      });
    }
  }

  // E8 — baixa sem confirmação no extrato.
  const limiteConfirmacao = somarDias(hoje, -p.diasBaixaSemConfirmacao);
  const semConfirmar = [...baixasEntrada, ...baixasSaida].filter(
    (b) => b.naoConfirmada && b.dataIso < limiteConfirmacao,
  );
  if (semConfirmar.length && temTabelaExtrato) {
    const total = semConfirmar.reduce((s, b) => s + b.valorCent, 0);
    add({
      chave: chaveDeExcecao("E8"), tipo: "E8", gravidade: "atencao", valorCent: total,
      titulo: `${semConfirmar.length} ${semConfirmar.length === 1 ? "baixa" : "baixas"} sem confirmação no extrato`,
      detalhe: `${brlCheio(total)} marcados como liquidados há mais de ${p.diasBaixaSemConfirmacao} dias`,
      destino: "Caixa, não confirmadas", href: DESTINO.conciliacao,
    });
  }

  // I1 — extrato desatualizado, uma exceção por conta (o escopo está na chave).
  for (const c of contas) {
    if (!c.exigeExtrato || !temTabelaExtrato) continue;
    const ultimo = ultimoExtrato.get(c.id);
    const dias = ultimo ? diasEntre(ultimo, hoje) : null;
    if (dias === null || dias <= p.diasSemExtrato) continue;
    add({
      chave: chaveDeExcecao("I1", `conta-${c.id}`), tipo: "I1", gravidade: "aviso", valorCent: dias,
      titulo: `Extrato do ${c.nome} sem importação há ${dias} dias`,
      detalhe: `Último arquivo em ${ddmm(ultimo as string)}`,
      destino: "Importar extrato", href: DESTINO.extrato,
    });
  }

  // I2 — orçamento estourando.
  if (!orcamentos.error) {
    const rotuloDa = new Map(
      ((categorias.data ?? []) as Linha[]).map((c) => [String(c.key), String(c.label ?? c.key)]),
    );
    for (const o of ((orcamentos.data ?? []) as Linha[])) {
      const orcadoCent = paraCent(o.amount);
      if (orcadoCent <= 0) continue;
      const key = String(o.category_key ?? "");
      const gastoCent = realizadoPorCategoria.get(key) ?? 0;
      const pct = (gastoCent / orcadoCent) * 100;
      if (pct <= p.toleranciaOrcamentoPct) continue;
      add({
        chave: chaveDeExcecao("I2", key), tipo: "I2", gravidade: "aviso", valorCent: gastoCent - orcadoCent,
        titulo: `${rotuloDa.get(key) ?? key} em ${Math.round(pct)}% do orçado`,
        detalhe: `${brlCheio(gastoCent)} de ${brlCheio(orcadoCent)} no mês`,
        destino: "Ver orçamento", href: DESTINO.orcamento,
      });
    }
  }

  // I3 — fechamento pendente do mês anterior.
  const mesAnteriorFim = somarDias(mesIni, -1);
  const diaDoMes = Number(hoje.slice(8, 10));
  if (diaDoMes >= p.diaCobrancaFechamento && (!cfg.fechadoAte || cfg.fechadoAte < mesAnteriorFim)) {
    add({
      chave: chaveDeExcecao("I3", mesAnteriorFim.slice(0, 7)), tipo: "I3", gravidade: "aviso", valorCent: 0,
      titulo: `Fechamento de ${mesPorExtenso(mesAnteriorFim)} pendente`,
      detalhe: `O mês fechou em ${ddmm(mesAnteriorFim)} e ainda está aberto`,
      destino: "Abrir checklist", href: DESTINO.fechamento,
    });
  }

  // I4 (reajustes próximos) não existe: o banco ainda não guarda recorrência de
  // receita com data de reajuste. Inventar um número aqui seria pior que a
  // ausência dele.

  /* ── Bloco 4: Esta semana (§8) ───────────────────────────────────────── */

  const nomeDaConta = new Map(contas.map((c) => [c.id, c.nome]));
  const ateSemana = mais7;

  const semanaEntradas = entradasAbertas
    .filter((e) => e.dataIso >= hoje && e.dataIso <= ateSemana)
    .map((e) => ({
      id: e.id, direcao: "in" as const, dataIso: e.dataIso, entrada: true,
      valorCent: e.valorCent,
      pessoa: primeiroTexto(nomeDoCliente.get(e.clienteId ?? ""), e.descricao),
      descricao: e.descricao,
      situacao: e.temCobranca ? "Cobrança enviada" : "Sem cobrança",
      situacaoTom: (e.temCobranca ? "ok" : "atencao") as "ok" | "atencao",
      conta: nomeDaConta.get(e.contaId ?? "") ?? "Não definida",
      // Sem emissão de cobrança implementada (ver nota no fim do arquivo), a
      // ação de uma entrada é a baixa — ou o link, quando é do Asaas.
      acao: (e.doAsaas ? "ver-cobranca" : "baixa") as "ver-cobranca" | "baixa",
      acaoLabel: e.doAsaas ? "Ver cobrança" : "Registrar recebimento",
    }));

  const semanaSaidas = saidasAbertas
    .filter((d) => d.dataIso >= hoje && d.dataIso <= ateSemana)
    .map((d) => {
      const aguardando = cfg.aprovacaoLigada && d.aguardandoAprovacao;
      return {
        id: d.id, direcao: "out" as const, dataIso: d.dataIso, entrada: false,
        valorCent: d.valorCent,
        pessoa: d.pessoa,
        descricao: d.descricao,
        situacao: aguardando ? "Aguardando aprovação" : d.temConta ? "Programado" : "Sem programação",
        situacaoTom: (aguardando ? "atencao" : d.temConta ? "info" : "neutro") as
          "atencao" | "info" | "neutro",
        conta: nomeDaConta.get(d.contaId ?? "") ?? "Não definida",
        acao: (aguardando ? "aprovar" : "baixa") as "aprovar" | "baixa",
        acaoLabel: aguardando ? "Aprovar" : "Registrar pagamento",
      };
    });

  const semana: SemanaView = {
    ateIso: ateSemana,
    ateLabel: ddmm(ateSemana),
    // Vencidas não entram: já estão no Bloco 1, e repeti-las aqui faria a
    // mesma dívida parecer duas (§8.1).
    lancamentos: ordenarSemana([...semanaEntradas, ...semanaSaidas]).map((l) => ({
      id: l.id,
      direcao: l.direcao,
      dataIso: l.dataIso,
      dataLabel: rotuloDaSemana(l.dataIso, hoje),
      hoje: l.dataIso === hoje,
      pessoa: l.pessoa,
      descricao: l.descricao,
      situacao: l.situacao,
      situacaoTom: l.situacaoTom,
      conta: l.conta,
      valorCent: l.valorCent,
      acao: l.acao,
      acaoLabel: l.acaoLabel,
    })),
  };

  /* ── Bloco 5: Panorama (§9) ──────────────────────────────────────────── */

  // Os três maiores pontuais do mês, já com o nome do cliente resolvido: é a
  // lista do Slide 2 que explica de onde veio a receita fora de contrato.
  const pontuaisDoMes = [...pontuaisBrutos]
    .sort((a, b) => b.valorCent - a.valorCent)
    .slice(0, 3)
    .map((x) => {
      const cliente = nomeDoCliente.get(x.clienteId ?? "");
      return {
        nome: cliente ? `${cliente}, ${x.descricao.toLowerCase()}` : x.descricao,
        valorCent: x.valorCent,
      };
    });

  const orcadoPorCategoria = new Map<string, number>();
  if (!orcamentos.error) {
    for (const o of ((orcamentos.data ?? []) as Linha[])) {
      orcadoPorCategoria.set(String(o.category_key ?? ""), paraCent(o.amount));
    }
  }
  const labelDa = new Map(
    ((categorias.data ?? []) as Linha[]).map((c) => [String(c.key), String(c.label ?? c.key)]),
  );

  const panorama = await montarPanorama(db, {
    hoje, mesIni, mesFim, mesLabel: mesPorExtenso(mesIni),
    serie,
    saldoHojeCent: saldoCent,
    reservaCent: p.reservaMinimaCent,
    entradasAbertas: entradasAbertas.map((e) => ({
      dataIso: e.dataIso, valorCent: e.valorCent,
      pessoa: primeiroTexto(nomeDoCliente.get(e.clienteId ?? ""), e.descricao),
    })),
    saidasAbertas: saidasAbertas.map((d) => ({
      dataIso: d.dataIso, valorCent: d.valorCent, pessoa: d.pessoa,
    })),
    entradasVencidasCent: entradasVencidas.reduce((s, e) => s + e.valorCent, 0),
    receitaMesCent, recorrenteFaturadoCent, pontualCent,
    deltaMrr30Cent,
    pontuaisDoMes,
    impactoDa, labelDa, realizadoPorCategoria, orcadoPorCategoria,
    toleranciaOrcamentoPct: p.toleranciaOrcamentoPct,
    destinos: { fluxo: DESTINO.fluxo, receita: DESTINO.receita, dre: DESTINO.dre },
  });

  /* ── Primeiro uso (§11) ──────────────────────────────────────────────── */

  const primeiroUso = await montarPrimeiroUso(db, contas);

  /* ── Silêncios e separação (§5.3) ────────────────────────────────────── */

  let silencios: { chave: string; ateIso: string }[] = [];
  if (userId) {
    const r = await db
      .from("dashboard_silences")
      .select("exception_key, silenced_until")
      .eq("user_id", userId);
    if (!r.error) {
      silencios = ((r.data ?? []) as Linha[]).map((s) => ({
        chave: String(s.exception_key), ateIso: String(s.silenced_until ?? ""),
      }));
    }
  }
  const visiveis = excecoes.filter(
    (e) => e.gravidade !== "aviso" || !estaSilenciada(e.chave, silencios, hoje),
  );

  /* ── Faixa "Desde ontem" (§4) ────────────────────────────────────────── */

  let ultimaVisita: string | null = null;
  if (userId) {
    const r = await db.from("dashboard_visits").select("last_seen_at").eq("user_id", userId).maybeSingle();
    if (!r.error && r.data) ultimaVisita = String((r.data as Linha).last_seen_at ?? "").slice(0, 10) || null;
  }
  const janela = janelaDesdeOntem(hoje, ultimaVisita);
  const entradasNaJanela = baixasEntrada.filter((b) => b.dataIso >= janela.desdeIso);
  const saidasNaJanela = baixasSaida.filter((b) => b.dataIso >= janela.desdeIso);
  const quitouVencida = entradasNaJanela.find((b) => b.vencimentoIso && b.vencimentoIso < b.dataIso);

  const desdeOntem = entradasNaJanela.length || saidasNaJanela.length
    ? {
        label: janela.label,
        entradas: {
          valorCent: entradasNaJanela.reduce((s, b) => s + b.valorCent, 0),
          qtd: entradasNaJanela.length,
        },
        saidas: {
          valorCent: saidasNaJanela.reduce((s, b) => s + b.valorCent, 0),
          qtd: saidasNaJanela.length,
        },
        destaque: quitouVencida ? `${quitouVencida.pessoa} quitou uma fatura vencida` : null,
        href: DESTINO.caixa,
      }
    : null;

  /* ── Estado vazio do Bloco 1 (§5.3 regra 7) ──────────────────────────── */

  const ultimaConciliacao = [...baixasEntrada, ...baixasSaida]
    .filter((b) => !b.naoConfirmada)
    .sort((a, b) => b.dataIso.localeCompare(a.dataIso))[0];

  const separadas = separarExcecoes(visiveis);

  return {
    semDados: false,
    pendente: cfg.pendente,
    hojeIso: hoje,
    dataLabel: dataPorExtenso(hoje),
    atualizadoEm: horaSP(agora),
    parametros: p,
    podeImportarExtrato,
    desdeOntem,
    excecoes: separadas,
    tudoEmDia: {
      ultimaConciliacao: ultimaConciliacao ? ddmm(ultimaConciliacao.dataIso) : null,
      proximaSaida: maiorPrevista
        ? `${maiorPrevista.pessoa}, ${brlCheio(maiorPrevista.valorCent)} em ${ddmm(maiorPrevista.dataIso)}`
        : null,
    },
    saldo: {
      totalCent: saldoCent,
      // Fôlego: o disponível dividido pela saída média dos últimos 90 dias.
      folegoMeses: folegoEmMeses(
        saldoCent,
        Math.round(baixasSaida.reduce((s, b) => s + b.valorCent, 0) / 3),
      ),
      contas: disponiveis,
      foraDoDisponivel,
      semContas: contas.length === 0,
    },
    caixa30: {
      saldoCent: saldo30,
      menorCent: menor?.saldoCent ?? null,
      menorEm: menor ? ddmm(menor.dataIso) : null,
      abaixoDaReserva: Boolean(menor && menor.saldoCent < p.reservaMinimaCent),
    },
    resultado: {
      liquidoCent: dre.resultadoLiquidoCent,
      margemPct: dre.receitaLiquidaCent > 0
        ? Math.round((dre.resultadoLiquidoCent / dre.receitaLiquidaCent) * 1000) / 10
        : null,
      // "Já realizado" é o peso do que já passou pelo caixa dentro de todo o
      // movimento do mês — receita mais saídas. Sobre o resultado líquido o
      // percentual explodiria sempre que o mês fechasse perto do zero.
      pctRealizado: volumeCent > 0 ? Math.round((realizadoCent / volumeCent) * 100) : 0,
      volumeCent,
      mesLabel: mesPorExtenso(mesIni),
    },
    receita: {
      mrrCent,
      pontualCent,
      recorrenteFaturadoCent,
      totalCent: receitaMesCent,
      pctRecorrente: receitaMesCent > 0
        ? Math.round((recorrenteFaturadoCent / receitaMesCent) * 100)
        : 0,
      deltaMrr30Cent,
    },
    recebimentos,
    pagamentos,
    semana,
    panorama,
    primeiroUso,
  };
}

/* ── Checklist de implantação (§11) ────────────────────────────────────── */

/**
 * Cada passo é DERIVADO dos dados, sem flag manual: a única forma de um
 * checklist não mentir é ele não ter estado próprio.
 *
 * A página só troca de cara pelos passos 1 e 4 — sem conta com saldo e sem
 * receita recorrente não há saldo, projeção, MRR nem resultado, e mostrar os
 * blocos zerados pareceria empresa quebrada em vez de implantação pela metade.
 */
async function montarPrimeiroUso(
  db: SupabaseClient,
  contas: { aberturaCent: number }[],
): Promise<{ ativo: boolean; passos: PassoImplantacao[]; feitos: number }> {
  /** Quantidade, ou 0 se a consulta falhar — o checklist nunca derruba a página. */
  const quantos = async (p: PromiseLike<{ count: number | null; error: unknown }>) => {
    try {
      const r = await p;
      return r.error ? 0 : (r.count ?? 0);
    } catch {
      return 0;
    }
  };
  const contar = (tabela: string) => db.from(tabela).select("id", { count: "exact", head: true });

  const [categorias, pessoas, recorrentesIn, recorrentesOut] = await Promise.all([
    quantos(contar("expense_categories").eq("active", true)),
    quantos(contar("clients")),
    // Recorrência de receita, neste modelo: cliente ativo com fee mensal — é
    // de onde o MRR sai, então é ele que o passo 4 precisa ver existindo.
    quantos(contar("clients").gt("monthly_fee", 0).neq("status", "churn")),
    quantos(contar("expenses").eq("recurring", true)),
  ]);

  const comSaldo = contas.some((c) => c.aberturaCent !== 0);
  const R = "/gerencial/financeiro";
  const passos: PassoImplantacao[] = [
    {
      n: 1, titulo: "Cadastrar contas financeiras e saldo inicial",
      detalhe: "Base de todo saldo e de toda projeção",
      feito: contas.length > 0 && comSaldo, href: `${R}/configuracoes`,
    },
    {
      n: 2, titulo: "Revisar o plano de categorias",
      detalhe: "Já vem com o padrão de agência carregado",
      feito: categorias > 0, href: `${R}/configuracoes`,
    },
    {
      n: 3, titulo: "Cadastrar clientes e fornecedores",
      detalhe: "Manualmente ou por importação de CSV",
      feito: pessoas > 0, href: "/gerencial/clientes",
    },
    {
      n: 4, titulo: "Criar as recorrências de receita",
      detalhe: "Os contratos atuais. Liberam MRR e projeção de caixa",
      feito: recorrentesIn > 0, href: "/gerencial/clientes",
    },
    {
      n: 5, titulo: "Criar as recorrências de despesa",
      detalhe: "Folha, aluguel, softwares e o que mais se repete",
      feito: recorrentesOut > 0, href: `${R}/pagamentos?aba=recorrencias`,
    },
  ];

  const feitos = passos.filter((x) => x.feito).length;
  const ativo = !passos[0].feito || !passos[3].feito;
  return { ativo, passos, feitos };
}
