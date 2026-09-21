import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { buscarTudo } from "@/lib/data/paginate-server";
import { hojeSP } from "@/lib/data/dashboard-financeiro";
import {
  churnDeMrr, concentracao, custoPorVaga, deslocarPeriodo, explicarVariacao, LIMITE_CONCENTRACAO_PCT,
  montarDre, MOVIMENTOS_MRR, paraCadaCem, periodoDe, periodoPadrao, ponteFechaComCaixa,
  ratearItemPorParcelas, rentabilidadeFechaComDre, saudeDaMargem, seloDoPeriodo,
  type Dre, type Granularidade, type ImpactType, type ImpactoNaVariacao, type LinhaConcentracao,
  type Periodo, type Saude, type SegmentoCem, type Selo, type TipoMovimentoMrr,
  type TotaisPorImpacto,
} from "@/lib/data/resultados";

/**
 * Resultados — leitura da página 5 (spec) sobre o núcleo transacional.
 *
 * A fonte é `document_items` por COMPETÊNCIA, como o documento-mãe fixa (§11 e
 * invariante §23.1): o item é distribuído entre as parcelas do título, e a
 * competência de cada parcela decide o mês. Receita é o que foi vendido no
 * período; custo é o que foi consumido nele. O Caixa mostra o dinheiro; esta
 * página mostra o desempenho.
 *
 * Onde cada categoria aparece na DRE é decidido pelo `impact_type` dela (§10),
 * nunca pelo nome.
 *
 * Tudo em centavos.
 */

type Linha = Record<string, unknown>;
const cent = (v: unknown) => Math.round(Number(v) || 0);

function exigir<T>(r: { linhas: T[]; erro: { message: string } | null }, onde: string): T[] {
  if (r.erro) throw new Error(`${onde}: ${r.erro.message}`);
  return r.linhas;
}

/**
 * `data: unknown` de propósito: sem tipos gerados do banco, o supabase-js não
 * infere a forma de um select com embed e devolve um tipo de erro estático.
 */
function exigirDado<T>(r: { data: unknown; error: { message: string } | null }, onde: string): T {
  if (r.error) throw new Error(`${onde}: ${r.error.message}`);
  return (r.data ?? []) as T;
}

/* ── O que a página recebe ─────────────────────────────────────────────── */

export type CelulaMes = { mes: string; label: string; valorCent: number; pctRl: number | null };

export type LinhaDre = {
  key: string;
  label: string;
  nivel: "grupo" | "total" | "categoria";
  /** Grupo ao qual a categoria pertence (para recolher). */
  grupo: string | null;
  valorCent: number;
  realizadoCent: number;
  previstoCent: number;
  comparacaoCent: number;
  deltaCent: number;
  deltaPct: number | null;
  pctRl: number | null;
  /** +1 soma no resultado, −1 subtrai. Decide a cor do Δ. */
  sinal: 1 | -1;
  /** Categoria abre os lançamentos; grupo e total, não. */
  clicavel: boolean;
  ajustada: boolean;
  meses: CelulaMes[];
};

export type IndicadorResultado = {
  key: string;
  label: string;
  valor: string;
  delta: string;
  deltaTom: "bom" | "ruim" | "neutro";
  contexto: string;
};

export type BarraPonte = {
  label: string;
  valorCent: number;
  tipo: "inicio" | "delta" | "fim";
  /** Altura e topo em % da área do gráfico — a tela não recalcula. */
  topoPct: number;
  alturaPct: number;
};

export type ItemVariacao = ImpactoNaVariacao & { nota: string | null };

export type ResultadosView = {
  semDados: boolean;
  /** Falta rodar 0147 (impact_type) ou 0149 (núcleo). */
  pendente: boolean;
  pendenteMotivo: string | null;
  hojeIso: string;
  periodo: { gran: Granularidade; iso: string; label: string; inicio: string; fim: string };
  comparacaoKey: string;
  comparacaoLabel: string;
  /** Orçado só existe com versão aprovada no Planejamento. */
  orcadoDisponivel: boolean;
  /** Por que a comparação com o orçado está desligada. */
  orcadoMotivo: string;
  selo: Selo;
  ajustes: { linha: string; valor: string; texto: string }[];
  modo: "periodo" | "evo";
  /** Mês aberto ganha as colunas Realizado e Previsto (§5.2). */
  mesAberto: boolean;
  colunas: string[];
  indicadores: IndicadorResultado[];
  cem: { segmentos: SegmentoCem[]; prejuizoCent: number | null; subtitulo: string };
  dre: Dre;
  dreComparacao: Dre;
  linhas: LinhaDre[];
  gruposAbertos: string[];
  variacao: { subtitulo: string; totalCent: number; itens: ItemVariacao[]; demaisCent: number };
  fora: { investimentosCent: number; sociosCent: number };
  ponte: {
    barras: BarraPonte[];
    confere: boolean;
    diferencaCent: number;
    /** Sem conta com saldo, não há o que conferir — e a tela diz isso. */
    semCaixa: boolean;
  };
  /** Categorias sem tipo de impacto: ficam fora da DRE e a tela avisa. */
  semImpacto: string[];
  mesesEvolucao: { mes: string; label: string }[];
  rentabilidade: RentabilidadeView;
  receita: ReceitaView;
};

export type LinhaRentabilidade = {
  id: string;
  nome: string;
  detalhe: string;
  receitaCent: number;
  deducoesCent: number;
  equipeCent: number;
  custosDiretosCent: number;
  margemCent: number;
  margemPct: number | null;
  vagas: number;
  saude: Saude;
  saudeLabel: string;
  /** Receita sem equipe alocada infla a margem — a linha avisa (§16). */
  aviso: string | null;
};

export type PontoMatriz = {
  id: string;
  nome: string;
  receitaCent: number;
  margemPct: number;
  vagas: number;
  saude: Saude;
  /** Posição em % da área do gráfico; a tela não recalcula escala. */
  x: number;
  y: number;
  tamanho: number;
  comRotulo: boolean;
};

export type RentabilidadeView = {
  dimensao: "clientes" | "servicos" | "projetos" | "squads";
  prova: {
    margemClientesCent: number;
    ociosidadeCent: number;
    operacaoGeralCent: number;
    estruturaCent: number;
    financeiroCent: number;
    resultadoCent: number;
    resultadoDreCent: number;
    confere: boolean;
    diferencaCent: number;
    causas: string[];
  };
  alertas: { texto: string; cta: string }[];
  linhas: LinhaRentabilidade[];
  rodape: { carteira: LinhaRentabilidade; operacaoGeralCent: number; ociosidadeCent: number };
  matriz: { pontos: PontoMatriz[]; mediaReceitaX: number; mediaMargemY: number; zeroY: number };
  ocupacao: { funcao: string; usadas: number; capacidade: number; pct: number; estado: string }[];
  /** O que falta para a aba responder de verdade. */
  lacunas: string[];
};

export type MovimentoMrr = {
  id: string;
  tipo: TipoMovimentoMrr;
  tipoLabel: string;
  tom: "bom" | "ruim" | "neutro";
  cliente: string;
  motivo: string;
  valorCent: number;
};

export type ReceitaView = {
  indicadores: IndicadorResultado[];
  ponteMrr: BarraPonte[];
  ponteMrrSub: string;
  movimentos: MovimentoMrr[];
  evolucao: {
    mes: string; label: string; recorrenteCent: number; pontualCent: number;
    mrrCent: number; alturaRec: number; alturaPon: number; noPeriodo: boolean;
  }[];
  concentracao: { linhas: LinhaConcentracao[]; nota: string; alerta: boolean };
  porServico: {
    nome: string; recorrenteCent: number; pontualCent: number; totalCent: number;
    pct: number; deltaCent: number;
  }[];
  lacunas: string[];
};

export type FiltrosResultados = {
  gran?: string;
  periodo?: string;
  comp?: string;
  modo?: string;
  dim?: string;
};

const MESES_CURTO = [
  "", "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez",
];
const mesCurto = (iso: string) => `${MESES_CURTO[Number(iso.slice(5, 7))]}/${iso.slice(2, 4)}`;

const brl = (c: number) =>
  (c < 0 ? "−" : "") + Math.abs(Math.round(c / 100)).toLocaleString("pt-BR", {
    style: "currency", currency: "BRL", maximumFractionDigits: 0,
  });

const pctTexto = (n: number | null) =>
  n === null ? "—" : `${n.toFixed(1).replace(".", ",")}%`;

/* ── Estado vazio ──────────────────────────────────────────────────────── */

function vazio(hoje: string, semDados: boolean, pendente = false, motivo: string | null = null): ResultadosView {
  const p = periodoDe("mes", `${hoje.slice(0, 7)}-01`);
  const dre = montarDre({});
  return {
    semDados, pendente, pendenteMotivo: motivo, hojeIso: hoje,
    periodo: { gran: "mes", iso: p.inicio, label: p.label, inicio: p.inicio, fim: p.fim },
    comparacaoKey: "ant", comparacaoLabel: "período anterior",
    orcadoDisponivel: false, orcadoMotivo: "sem orçamento aprovado para o ano",
    selo: { estado: "aberto", texto: "Em aberto, 0% realizado", tom: "atencao" },
    ajustes: [], modo: "periodo", mesAberto: true, colunas: [],
    indicadores: [], cem: { segmentos: [], prejuizoCent: null, subtitulo: "" },
    dre, dreComparacao: dre, linhas: [], gruposAbertos: ["direct_cost"],
    variacao: { subtitulo: "", totalCent: 0, itens: [], demaisCent: 0 },
    fora: { investimentosCent: 0, sociosCent: 0 },
    ponte: { barras: [], confere: true, diferencaCent: 0, semCaixa: true },
    semImpacto: [], mesesEvolucao: [],
    rentabilidade: rentabilidadeVazia(),
    receita: receitaVazia(),
  };
}

function rentabilidadeVazia(): RentabilidadeView {
  const linhaZero: LinhaRentabilidade = {
    id: "carteira", nome: "Carteira", detalhe: "", receitaCent: 0, deducoesCent: 0,
    equipeCent: 0, custosDiretosCent: 0, margemCent: 0, margemPct: null, vagas: 0,
    saude: "sem-dados", saudeLabel: "Sem dados", aviso: null,
  };
  return {
    dimensao: "clientes",
    prova: {
      margemClientesCent: 0, ociosidadeCent: 0, operacaoGeralCent: 0, estruturaCent: 0,
      financeiroCent: 0, resultadoCent: 0, resultadoDreCent: 0, confere: true,
      diferencaCent: 0, causas: [],
    },
    alertas: [], linhas: [],
    rodape: { carteira: linhaZero, operacaoGeralCent: 0, ociosidadeCent: 0 },
    matriz: { pontos: [], mediaReceitaX: 50, mediaMargemY: 50, zeroY: 100 },
    ocupacao: [], lacunas: [],
  };
}

function receitaVazia(): ReceitaView {
  return {
    indicadores: [], ponteMrr: [], ponteMrrSub: "", movimentos: [], evolucao: [],
    concentracao: { linhas: [], nota: "", alerta: false }, porServico: [], lacunas: [],
  };
}

const semTabela = (e: unknown) => {
  const c = (e as { code?: string })?.code;
  const m = e instanceof Error ? e.message : String(e ?? "");
  return c === "42P01" || c === "42703" || /does not exist|schema cache|impact_type/i.test(m);
};

/* ── Leitura ───────────────────────────────────────────────────────────── */

export async function getResultados(
  filtros: FiltrosResultados = {},
  agora: Date = new Date(),
): Promise<ResultadosView> {
  const hoje = hojeSP(agora);
  if (!isSupabaseConfigured()) return vazio(hoje, true);
  try {
    return await montar(await createClient(), filtros, hoje);
  } catch (e) {
    if (semTabela(e)) {
      return vazio(hoje, false, true,
        "Resultados lê o núcleo transacional (0149) e o tipo de impacto das categorias (0147).");
    }
    throw e;
  }
}

/** Uma fatia de item já resolvida por competência, pronta para somar. */
type Fatia = {
  mes: string;
  valorCent: number;
  realizadoCent: number;
  impacto: ImpactType | null;
  categoriaKey: string;
  categoriaLabel: string;
  recorrente: boolean;
  direcao: "in" | "out";
  clienteId: string | null;
  serviceId: string | null;
  documentId: string;
  descricao: string;
};

async function montar(
  db: SupabaseClient,
  filtros: FiltrosResultados,
  hoje: string,
): Promise<ResultadosView> {
  const cfgRes = await db.from("finance_settings")
    .select("closed_until, healthy_margin_pct, attention_margin_pct, concentration_limit_pct, churn_alert_pct")
    .eq("id", 1).maybeSingle();
  const cfg = (cfgRes.data ?? {}) as Linha;
  const fechadoAte = cfg.closed_until ? String(cfg.closed_until) : null;

  const gran: Granularidade = filtros.gran === "tri" ? "tri" : "mes";
  const ancora = /^\d{4}-\d{2}/.test(filtros.periodo ?? "")
    ? `${filtros.periodo}-01`
    : periodoPadrao(hoje, fechadoAte);
  const periodo = periodoDe(gran, ancora);
  const modo = filtros.modo === "evo" ? "evo" : "periodo";

  // A comparação decide o que "Δ" significa; o orçado só existe se houver
  // versão aprovada no Planejamento, senão a opção fica desligada (§3.2).
  const comp = ["ant", "yoy"].includes(filtros.comp ?? "") ? filtros.comp! : "ant";
  const anterior = comp === "yoy"
    ? deslocarPeriodo(periodo, gran === "tri" ? -4 : -12)
    : deslocarPeriodo(periodo, -1);

  // Janela: 12 meses até o fim do período (evolução) e o período de comparação.
  const doze = deslocarPeriodo(periodoDe("mes", periodo.meses[periodo.meses.length - 1]), -11);
  const janelaIni = [doze.inicio, anterior.inicio, periodo.inicio].sort()[0];
  const janelaFim = [periodo.fim, anterior.fim].sort().reverse()[0];

  const [parcelasRes, catsRes] = await Promise.all([
    buscarTudo<Linha>((a, b) => db.from("installments")
      .select("id, document_id, competence_month, amount_cents, open_balance_cents, status")
      .gte("competence_month", janelaIni).lte("competence_month", janelaFim).range(a, b)),
    db.from("expense_categories").select("key, label, impact_type"),
  ]);

  const parcelasJanela = exigir(parcelasRes, "parcelas do período");
  const cats = exigirDado<Linha[]>(catsRes, "categorias");
  const catDe = new Map(cats.map((c) => [String(c.key), {
    label: String(c.label ?? c.key),
    impacto: (c.impact_type ? String(c.impact_type) : null) as ImpactType | null,
  }]));
  const semImpacto = cats.filter((c) => !c.impact_type).map((c) => String(c.label ?? c.key));

  const docIds = [...new Set(parcelasJanela.map((p) => String(p.document_id)))];

  // Todas as parcelas dos títulos envolvidos: o rateio precisa do denominador
  // inteiro, e parcela fora da janela também pesa nele.
  const [todasParcelasRes, itensRes, docsRes] = await Promise.all([
    docIds.length
      ? buscarTudo<Linha>((a, b) => db.from("installments")
          .select("id, document_id, competence_month, amount_cents, open_balance_cents, status")
          .in("document_id", docIds.slice(0, 500)).range(a, b))
      : Promise.resolve({ linhas: [] as Linha[], truncado: false, erro: null }),
    docIds.length
      ? buscarTudo<Linha>((a, b) => db.from("document_items")
          .select("id, document_id, amount_cents, category_key, client_id, service_id, description")
          .in("document_id", docIds.slice(0, 500)).range(a, b))
      : Promise.resolve({ linhas: [] as Linha[], truncado: false, erro: null }),
    docIds.length
      ? buscarTudo<Linha>((a, b) => db.from("documents")
          .select("id, direction, description, recurrence_id, client_id, party_id")
          .in("id", docIds.slice(0, 500)).range(a, b))
      : Promise.resolve({ linhas: [] as Linha[], truncado: false, erro: null }),
  ]);

  const todasParcelas = exigir(todasParcelasRes, "parcelas dos títulos");
  const itens = exigir(itensRes, "itens dos títulos");
  const docs = exigir(docsRes, "títulos");

  const docDe = new Map(docs.map((d) => [String(d.id), d]));
  const parcelasPorDoc = new Map<string, Linha[]>();
  for (const p of todasParcelas) {
    const k = String(p.document_id);
    parcelasPorDoc.set(k, [...(parcelasPorDoc.get(k) ?? []), p]);
  }

  /* ── Cada item vira fatias por competência (§4) ───────────────────────── */

  const fatias: Fatia[] = [];
  for (const it of itens) {
    const doc = docDe.get(String(it.document_id));
    if (!doc) continue;
    const parcelas = (parcelasPorDoc.get(String(it.document_id)) ?? []).map((p) => ({
      competenciaMes: String(p.competence_month ?? "").slice(0, 10),
      valorCent: cent(p.amount_cents),
      liquidadoCent: cent(p.amount_cents) - cent(p.open_balance_cents),
      encerrada: ["cancelled", "renegotiated"].includes(String(p.status ?? "")),
    }));

    const catKey = String(it.category_key ?? "");
    const cat = catDe.get(catKey);
    const direcao = String(doc.direction ?? "out") === "in" ? "in" : "out";
    const recorrente = Boolean(doc.recurrence_id);

    // Sem categoria, a direção decide: entrada é receita operacional, saída é
    // despesa. É o palpite mínimo que mantém o item dentro da DRE em vez de
    // sumir com ele — e a tela mostra a categoria como "Sem categoria".
    const impacto: ImpactType | null = cat?.impacto
      ?? (direcao === "in" ? "operating_revenue" : "operating_expense");

    for (const f of ratearItemPorParcelas(cent(it.amount_cents), parcelas)) {
      fatias.push({
        mes: f.mes, valorCent: f.valorCent, realizadoCent: f.realizadoCent,
        impacto,
        categoriaKey: catKey || (direcao === "in"
          ? (recorrente ? "__recorrente__" : "__pontual__")
          : "__sem_categoria__"),
        categoriaLabel: cat?.label ?? (direcao === "in"
          ? (recorrente ? "Mensalidades (recorrente)" : "Projetos e pontuais")
          : "Sem categoria"),
        recorrente, direcao,
        clienteId: it.client_id ? String(it.client_id) : doc.client_id ? String(doc.client_id) : null,
        serviceId: it.service_id ? String(it.service_id) : null,
        documentId: String(it.document_id),
        descricao: String(it.description ?? doc.description ?? ""),
      });
    }
  }

  const doPeriodo = (p: Periodo) => fatias.filter((f) => p.meses.includes(f.mes));

  const totaisDe = (lista: Fatia[]): TotaisPorImpacto => {
    const t: TotaisPorImpacto = {};
    for (const f of lista) {
      if (!f.impacto) continue;
      t[f.impacto] = (t[f.impacto] ?? 0) + f.valorCent;
    }
    return t;
  };

  const doAtual = doPeriodo(periodo);
  const doAnterior = doPeriodo(anterior);

  const orcadoMotivo = await motivoDoOrcado(db, periodo);

  const dre = montarDre(totaisDe(doAtual));
  const dreComparacao = montarDre(totaisDe(doAnterior));

  /* ── Selo, ajustes e indicadores ──────────────────────────────────────── */

  const receitaCent = doAtual.filter((f) => f.impacto === "operating_revenue")
    .reduce((s, f) => s + f.valorCent, 0);
  const receitaRealizadaCent = doAtual.filter((f) => f.impacto === "operating_revenue")
    .reduce((s, f) => s + f.realizadoCent, 0);

  const ajustes = await lerAjustes(db, periodo, fechadoAte);
  const selo = seloDoPeriodo({
    fim: periodo.fim, fechadoAte, receitaCent, receitaRealizadaCent, ajustes: ajustes.length,
  });

  const compLabel = comp === "yoy" ? `${anterior.label} (ano anterior)` : anterior.label;

  const delta = (atual: number, base: number, inverter = false) => {
    const d = atual - base;
    const tom: "bom" | "ruim" | "neutro" =
      Math.abs(d) < 100 ? "neutro" : (inverter ? d < 0 : d > 0) ? "bom" : "ruim";
    const pct = base !== 0 ? Math.round((d / Math.abs(base)) * 1000) / 10 : null;
    // Comparar R$ 15.000 com R$ 15 dá "+99.900%", que lido de relance parece
    // defeito. Acima de 999% o número absoluto diz mais e não assusta à toa.
    const texto = pct === null ? "—"
      : Math.abs(pct) >= 1000 ? `${d >= 0 ? "+" : "−"}${brl(Math.abs(d))}`
      : `${d >= 0 ? "+" : "−"}${pctTexto(Math.abs(pct))}`;
    return { texto, tom };
  };

  const dMargem = (() => {
    const a = dre.margemBrutaPct, b = dreComparacao.margemBrutaPct;
    if (a === null || b === null) return { texto: "—", tom: "neutro" as const };
    const d = Math.round((a - b) * 10) / 10;
    return {
      texto: `${d >= 0 ? "+" : "−"}${Math.abs(d).toFixed(1).replace(".", ",")} p.p.`,
      tom: (Math.abs(d) < 0.1 ? "neutro" : d > 0 ? "bom" : "ruim") as "bom" | "ruim" | "neutro",
    };
  })();

  const dRl = delta(dre.receitaLiquidaCent, dreComparacao.receitaLiquidaCent);
  const dRo = delta(dre.resultadoOperacionalCent, dreComparacao.resultadoOperacionalCent);
  const dRliq = delta(dre.resultadoLiquidoCent, dreComparacao.resultadoLiquidoCent);

  const indicadores: IndicadorResultado[] = [
    { key: "rl", label: "Receita líquida", valor: brl(dre.receitaLiquidaCent),
      delta: dRl.texto, deltaTom: dRl.tom, contexto: `vs. ${compLabel}` },
    { key: "mb", label: "Margem bruta", valor: pctTexto(dre.margemBrutaPct),
      delta: dMargem.texto, deltaTom: dMargem.tom, contexto: brl(dre.margemBrutaCent) },
    { key: "ro", label: "Resultado operacional", valor: brl(dre.resultadoOperacionalCent),
      delta: dRo.texto, deltaTom: dRo.tom,
      contexto: `margem de ${pctTexto(dre.margemOperacionalPct)}` },
    { key: "rliq", label: "Resultado líquido", valor: brl(dre.resultadoLiquidoCent),
      delta: dRliq.texto, deltaTom: dRliq.tom, contexto: `vs. ${compLabel}` },
  ];

  /* ── Tabela da DRE (§5.2) ─────────────────────────────────────────────── */

  const mesesEvolucao = Array.from({ length: 12 }, (_, i) =>
    deslocarPeriodo(periodoDe("mes", periodo.meses[periodo.meses.length - 1]), i - 11).inicio,
  ).map((m) => ({ mes: m, label: mesCurto(m) }));

  const dreDoMes = new Map(
    mesesEvolucao.map((m) => [m.mes, montarDre(totaisDe(fatias.filter((f) => f.mes === m.mes)))]),
  );

  const somaCat = (lista: Fatia[], key: string, campo: "valorCent" | "realizadoCent" = "valorCent") =>
    lista.filter((f) => f.categoriaKey === key).reduce((s, f) => s + f[campo], 0);

  const GRUPOS: { key: string; label: string; impacto: ImpactType; sinal: 1 | -1;
    total: (d: Dre) => number; totalLabel: string; totalKey: string; forte?: boolean }[] = [
    // A ordem é a do documento-mãe §11: a receita líquida vem DEPOIS das
    // deduções, porque é o que sobra delas.
    { key: "operating_revenue", label: "Receita bruta", impacto: "operating_revenue", sinal: 1,
      total: () => 0, totalLabel: "", totalKey: "" },
    { key: "revenue_deduction", label: "(−) Deduções", impacto: "revenue_deduction", sinal: -1,
      total: (d) => d.receitaLiquidaCent, totalLabel: "= Receita líquida", totalKey: "rl" },
    { key: "direct_cost", label: "(−) Custos diretos", impacto: "direct_cost", sinal: -1,
      total: (d) => d.margemBrutaCent, totalLabel: "= Margem bruta", totalKey: "mb" },
    { key: "operating_expense", label: "(−) Despesas operacionais", impacto: "operating_expense", sinal: -1,
      total: (d) => d.resultadoOperacionalCent, totalLabel: "= Resultado operacional", totalKey: "ro" },
    { key: "financial_result", label: "(±) Resultado financeiro", impacto: "financial_result", sinal: 1,
      total: (d) => d.resultadoLiquidoCent, totalLabel: "= Resultado líquido", totalKey: "rliq", forte: true },
  ];

  const valorDoGrupo = (d: Dre, imp: ImpactType) =>
    imp === "operating_revenue" ? d.receitaBrutaCent
    : imp === "revenue_deduction" ? d.deducoesCent
    : imp === "direct_cost" ? d.custosDiretosCent
    : imp === "operating_expense" ? d.despesasOperacionaisCent
    : d.resultadoFinanceiroCent;

  const catsAjustadas = new Set(ajustes.map((a) => a.linha));
  const linhas: LinhaDre[] = [];

  const celulaMeses = (fn: (d: Dre) => number, filtro?: (f: Fatia) => boolean): CelulaMes[] =>
    mesesEvolucao.map((m) => {
      const d = dreDoMes.get(m.mes)!;
      const valor = filtro
        ? fatias.filter((f) => f.mes === m.mes && filtro(f)).reduce((s, f) => s + f.valorCent, 0)
        : fn(d);
      return {
        mes: m.mes, label: m.label, valorCent: valor,
        pctRl: d.receitaLiquidaCent ? Math.round((valor / d.receitaLiquidaCent) * 1000) / 10 : null,
      };
    });

  for (const g of GRUPOS) {
    const atualG = valorDoGrupo(dre, g.impacto);
    const compG = valorDoGrupo(dreComparacao, g.impacto);
    linhas.push(montarLinha({
      key: g.key, label: g.label, nivel: "grupo", grupo: null,
      valorCent: atualG, realizadoCent: 0, previstoCent: 0,
      comparacaoCent: compG, sinal: g.sinal, clicavel: false, ajustada: false,
      rlCent: dre.receitaLiquidaCent,
      meses: celulaMeses((d) => valorDoGrupo(d, g.impacto)),
    }));

    const doGrupo = doAtual.filter((f) => f.impacto === g.impacto);
    const chaves = [...new Set(doGrupo.map((f) => f.categoriaKey))];
    for (const key of chaves) {
      const label = doGrupo.find((f) => f.categoriaKey === key)?.categoriaLabel ?? key;
      const valor = somaCat(doAtual, key);
      const realizado = somaCat(doAtual, key, "realizadoCent");
      linhas.push(montarLinha({
        key: `${g.key}:${key}`, label, nivel: "categoria", grupo: g.key,
        valorCent: valor, realizadoCent: realizado, previstoCent: valor - realizado,
        comparacaoCent: somaCat(doAnterior, key),
        sinal: g.sinal, clicavel: true, ajustada: catsAjustadas.has(label),
        rlCent: dre.receitaLiquidaCent,
        meses: celulaMeses(() => 0, (f) => f.categoriaKey === key),
      }));
    }

    if (g.totalLabel) {
      linhas.push(montarLinha({
        key: g.totalKey, label: g.totalLabel, nivel: "total", grupo: null,
        valorCent: g.total(dre), realizadoCent: 0, previstoCent: 0,
        comparacaoCent: g.total(dreComparacao), sinal: 1, clicavel: false, ajustada: false,
        rlCent: dre.receitaLiquidaCent,
        meses: celulaMeses((d) => g.total(d)),
      }));
    }
  }

  /* ── O que explica a variação (§5.3) ──────────────────────────────────── */

  const chavesTodas = [...new Set([...doAtual, ...doAnterior].map((f) => f.categoriaKey))];
  const baseComparacao: Record<string, number> = {};
  for (const key of chavesTodas) {
    baseComparacao[key] = somaCat(doAnterior, key);
  }
  const impactos = explicarVariacao(
    chavesTodas.map((key) => {
      const f = [...doAtual, ...doAnterior].find((x) => x.categoriaKey === key)!;
      return {
        key,
        label: f.categoriaLabel,
        valorCent: somaCat(doAtual, key),
        impacto: f.impacto ?? "operating_expense",
      };
    }),
    baseComparacao,
  );

  const notas = montarNotas(doAtual, doAnterior);
  const variacao = {
    subtitulo: `Resultado líquido vs. ${compLabel}`,
    totalCent: dre.resultadoLiquidoCent - dreComparacao.resultadoLiquidoCent,
    itens: impactos.top.map((i) => ({ ...i, nota: notas.get(i.key) ?? null })),
    demaisCent: impactos.demaisCent,
  };

  /* ── Do resultado ao caixa (§5.5) ─────────────────────────────────────── */

  const ponte = await montarPonte(db, periodo, dre, fatias);

  const dimensao = (["clientes", "servicos", "projetos", "squads"].includes(filtros.dim ?? "")
    ? filtros.dim : "clientes") as RentabilidadeView["dimensao"];
  const [rentabilidade, receita] = await Promise.all([
    montarRentabilidade(db, periodo, doAtual, dre, dimensao),
    montarReceita(db, periodo, fatias, mesesEvolucao, dre, dreComparacao, compLabel),
  ]);

  const mesAberto = !fechadoAte || fechadoAte < periodo.fim;
  const colunas = modo === "evo"
    ? mesesEvolucao.map((m) => m.label)
    : mesAberto
      ? ["Realizado", "Previsto", "Total", "% RL", "Comparação", "Δ"]
      : ["Valor", "% RL", "Comparação", "Δ", "Δ%"];

  return {
    semDados: false, pendente: false, pendenteMotivo: null, hojeIso: hoje,
    periodo: {
      gran, iso: periodo.inicio.slice(0, 7), label: periodo.label,
      inicio: periodo.inicio, fim: periodo.fim,
    },
    comparacaoKey: comp, comparacaoLabel: compLabel,
    orcadoDisponivel: false, orcadoMotivo,
    selo, ajustes,
    modo, mesAberto, colunas,
    indicadores,
    cem: {
      ...paraCadaCem(totaisDe(doAtual)),
      subtitulo: `Receita bruta de ${brl(dre.receitaBrutaCent)} em ${periodo.label}`,
    },
    dre, dreComparacao, linhas,
    // Custos diretos aberto, os demais fechados (§5.2).
    gruposAbertos: ["direct_cost"],
    variacao,
    fora: { investimentosCent: dre.investimentosCent, sociosCent: dre.sociosCent },
    ponte,
    semImpacto,
    mesesEvolucao,
    rentabilidade,
    receita,
  };
}

/* ── Auxiliares ────────────────────────────────────────────────────────── */

function montarLinha(i: {
  key: string; label: string; nivel: LinhaDre["nivel"]; grupo: string | null;
  valorCent: number; realizadoCent: number; previstoCent: number; comparacaoCent: number;
  sinal: 1 | -1; clicavel: boolean; ajustada: boolean; rlCent: number; meses: CelulaMes[];
}): LinhaDre {
  const deltaCent = i.valorCent - i.comparacaoCent;
  return {
    ...i,
    deltaCent,
    deltaPct: i.comparacaoCent !== 0
      ? Math.round((deltaCent / Math.abs(i.comparacaoCent)) * 1000) / 10
      : null,
    pctRl: i.rlCent ? Math.round((Math.abs(i.valorCent) / i.rlCent) * 1000) / 10 : null,
  };
}

/**
 * A nota automática de §5.3: o que existe num período e não no outro.
 *
 * Determinística, sem IA: lista até três contrapartes que explicam a maior
 * parte da diferença. "Subiu R$ 3.000" sozinho manda o usuário procurar; com
 * a nota, ele já sabe onde olhar.
 */
function montarNotas(atual: Fatia[], anterior: Fatia[]): Map<string, string> {
  const notas = new Map<string, string>();
  const chaves = [...new Set([...atual, ...anterior].map((f) => f.categoriaKey))];

  for (const key of chaves) {
    const porDescricao = new Map<string, number>();
    for (const f of atual.filter((x) => x.categoriaKey === key)) {
      const d = f.descricao.trim() || "sem descrição";
      porDescricao.set(d, (porDescricao.get(d) ?? 0) + f.valorCent);
    }
    for (const f of anterior.filter((x) => x.categoriaKey === key)) {
      const d = f.descricao.trim() || "sem descrição";
      porDescricao.set(d, (porDescricao.get(d) ?? 0) - f.valorCent);
    }
    const relevantes = [...porDescricao.entries()]
      .filter(([, v]) => Math.abs(v) >= 100)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 3)
      .map(([d]) => d);
    if (relevantes.length) notas.set(key, relevantes.join("; "));
  }
  return notas;
}

/** Ajustes depois do fechamento (§3.3), a partir da auditoria. */
async function lerAjustes(
  db: SupabaseClient,
  periodo: Periodo,
  fechadoAte: string | null,
): Promise<{ linha: string; valor: string; texto: string }[]> {
  if (!fechadoAte || fechadoAte < periodo.fim) return [];
  const { data } = await db.from("audit_events")
    .select("action, area, detail, user_name, created_at")
    .ilike("area", "%inanceiro%")
    .gt("created_at", `${fechadoAte}T23:59:59Z`)
    .order("created_at", { ascending: false })
    .limit(20);
  return ((data ?? []) as Linha[])
    .filter((e) => ["edit", "update", "delete"].includes(String(e.action ?? "")))
    .map((e) => ({
      linha: String(e.area ?? "Financeiro"),
      valor: "",
      texto: `${String(e.detail ?? e.action)} — ${String(e.user_name ?? "sistema")} em ` +
        String(e.created_at).slice(0, 10).split("-").reverse().join("/"),
    }));
}

/**
 * Comparar com o orçado (§3.2) ainda não é possível, e a opção diz isso.
 *
 * O orçamento do Planejamento é guardado como PREMISSAS (`budget_assumptions`),
 * não como linhas mensais por categoria: quem transforma uma em outra é o motor
 * de simulação. Ligar a opção antes disso compararia a DRE com zero e chamaria
 * o resultado de "desvio do orçado".
 */
async function motivoDoOrcado(db: SupabaseClient, periodo: Periodo): Promise<string> {
  const ano = Number(periodo.inicio.slice(0, 4));
  const { data, error } = await db.from("budget_versions")
    .select("id").eq("year", ano).eq("status", "approved").limit(1);
  if (error || !((data ?? []) as Linha[]).length) return "sem orçamento aprovado para o ano";
  return "o orçamento é por premissas e ainda não vira linha da DRE";
}

/**
 * A cascata do resultado ao caixa (§5.5).
 *
 * O resultado é competência; o caixa é dinheiro. A ponte mostra exatamente
 * onde os dois se separam: o que foi vendido e não recebido, o que foi
 * consumido e não pago, e o que saiu do caixa sem passar pela DRE.
 */
async function montarPonte(
  db: SupabaseClient,
  periodo: Periodo,
  dre: Dre,
  fatias: Fatia[],
): Promise<ResultadosView["ponte"]> {
  const saldoEm = async (dataIso: string, direcao: "in" | "out") => {
    const { data } = await db.from("installments")
      .select("open_balance_cents, due_date, doc:documents!installments_document_id_fkey!inner(direction)")
      .eq("doc.direction", direcao)
      .lte("due_date", dataIso);
    return ((data ?? []) as Linha[]).reduce((s, p) => s + cent(p.open_balance_cents), 0);
  };

  const antesIso = new Date(Date.UTC(
    Number(periodo.inicio.slice(0, 4)), Number(periodo.inicio.slice(5, 7)) - 1, 0,
  )).toISOString().slice(0, 10);

  const [recIni, recFim, pagIni, pagFim, contasRes] = await Promise.all([
    saldoEm(antesIso, "in"), saldoEm(periodo.fim, "in"),
    saldoEm(antesIso, "out"), saldoEm(periodo.fim, "out"),
    db.from("financial_accounts").select("id").eq("active", true).eq("counts_as_available", true),
  ]);

  const contas = ((contasRes.data ?? []) as Linha[]).map((c) => String(c.id));
  let variacaoCaixa = 0;
  if (contas.length) {
    const { data } = await db.from("transactions")
      .select("amount_cents, date")
      .in("financial_account_id", contas)
      .gte("date", periodo.inicio).lte("date", periodo.fim)
      .eq("confirmation_status", "confirmed");
    variacaoCaixa = ((data ?? []) as Linha[]).reduce((s, t) => s + cent(t.amount_cents), 0);
  }

  const doPeriodo = fatias.filter((f) => periodo.meses.includes(f.mes));
  const investimentos = -doPeriodo.filter((f) => f.impacto === "investment")
    .reduce((s, f) => s + f.valorCent, 0);
  const socios = -doPeriodo.filter((f) => f.impacto === "equity_financing")
    .reduce((s, f) => s + f.valorCent, 0);

  // Recebível que cresce segura dinheiro; conta a pagar que cresce o adia.
  const deltas: { label: string; valorCent: number }[] = [
    { label: "Recebíveis", valorCent: -(recFim - recIni) },
    { label: "Contas a pagar", valorCent: pagFim - pagIni },
    { label: "Investimentos", valorCent: investimentos },
    { label: "Sócios e financiamento", valorCent: socios },
  ].filter((d) => Math.abs(d.valorCent) >= 100);

  const fim = dre.resultadoLiquidoCent + deltas.reduce((s, d) => s + d.valorCent, 0);
  const prova = ponteFechaComCaixa(
    dre.resultadoLiquidoCent, deltas.map((d) => d.valorCent), variacaoCaixa,
  );

  const pontos: { label: string; valorCent: number; tipo: BarraPonte["tipo"]; de: number; ate: number }[] = [];
  let corrente = dre.resultadoLiquidoCent;
  pontos.push({ label: "Resultado líquido", valorCent: corrente, tipo: "inicio", de: 0, ate: corrente });
  for (const d of deltas) {
    pontos.push({ label: d.label, valorCent: d.valorCent, tipo: "delta", de: corrente, ate: corrente + d.valorCent });
    corrente += d.valorCent;
  }
  pontos.push({ label: "Variação do caixa", valorCent: fim, tipo: "fim", de: 0, ate: fim });

  const todos = pontos.flatMap((p) => [p.de, p.ate]).concat(0);
  const maior = Math.max(...todos);
  const menor = Math.min(...todos);
  const faixa = maior - menor || 1;
  const y = (v: number) => ((maior - v) / faixa) * 100;

  return {
    barras: pontos.map((p) => ({
      label: p.label, valorCent: p.valorCent, tipo: p.tipo,
      topoPct: Math.min(y(p.de), y(p.ate)),
      alturaPct: Math.max(1.5, Math.abs(y(p.de) - y(p.ate))),
    })),
    confere: prova.confere,
    diferencaCent: prova.diferencaCent,
    semCaixa: contas.length === 0,
  };
}

export { brl as formatarBrl };

/* ── Aba Rentabilidade (§6) ────────────────────────────────────────────── */

const SAUDE_LABEL: Record<Saude, string> = {
  saudavel: "Saudável", atencao: "Atenção", critica: "Crítica", "sem-dados": "Sem dados",
};

/**
 * Margem de contribuição por dimensão (§15.3 do documento-mãe).
 *
 * Receita − deduções proporcionais − equipe alocada − custos diretos do
 * cliente. Estrutura NÃO entra: ratear aluguel por cliente produz número que
 * leva a decisão errada, como cortar o cliente que ajudava a pagar a estrutura.
 *
 * A prova de fechamento é a razão de a aba existir junto da DRE: se as duas
 * não baterem, uma das duas está mentindo, e a spec é explícita — divergência
 * é bug, não arredondamento.
 */
async function montarRentabilidade(
  db: SupabaseClient,
  periodo: Periodo,
  doPeriodo: Fatia[],
  dre: Dre,
  dimensao: RentabilidadeView["dimensao"],
): Promise<RentabilidadeView> {
  const [alocRes, colabRes, clientesRes, squadsRes, servicosRes, projetosRes] = await Promise.all([
    db.from("team_allocations")
      .select("month, employee_id, client_id, project_id, service_id, weight, capacity, cost_cents")
      .in("month", periodo.meses),
    db.from("collaborators").select("id, name, role, squad"),
    db.from("clients").select("id, name, squad_id"),
    db.from("squads").select("id, name"),
    db.from("services").select("id, label"),
    db.from("projects").select("id, name, client_id, status, contract_value_cents, budget_cost_cents"),
  ]);

  const alocacoes = ((alocRes.data ?? []) as Linha[]);
  const colaboradores = ((colabRes.data ?? []) as Linha[]);
  const clientes = ((clientesRes.data ?? []) as Linha[]);
  const squads = ((squadsRes.data ?? []) as Linha[]);
  const servicos = ((servicosRes.data ?? []) as Linha[]);
  const projetos = ((projetosRes.data ?? []) as Linha[]);

  const nomeCliente = new Map(clientes.map((c) => [String(c.id), String(c.name ?? "Cliente")]));
  const squadDoCliente = new Map(clientes.map((c) => [String(c.id), c.squad_id ? String(c.squad_id) : null]));
  const nomeSquad = new Map(squads.map((s) => [String(s.id), String(s.name ?? "Squad")]));
  const nomeServico = new Map(servicos.map((s) => [String(s.id), String(s.label ?? "Serviço")]));
  const funcaoDe = new Map(colaboradores.map((c) => [String(c.id), String(c.role ?? c.squad ?? "Equipe")]));

  /* Custo por vaga, por colaborador e mês (§15.1). */
  const vagasPorColabMes = new Map<string, number>();
  for (const a of alocacoes) {
    const k = `${a.employee_id}|${a.month}`;
    vagasPorColabMes.set(k, (vagasPorColabMes.get(k) ?? 0) + Number(a.weight ?? 1));
  }
  const custoVaga = new Map<string, number>();
  let ociosidadeCent = 0;
  const ocupacaoPorFuncao = new Map<string, { usadas: number; capacidade: number }>();

  for (const [k, usadas] of vagasPorColabMes) {
    const [empId, mes] = k.split("|");
    const alocacao = alocacoes.find((a) => String(a.employee_id) === empId && String(a.month) === mes);
    const custo = cent(alocacao?.cost_cents);
    const capacidade = Number(alocacao?.capacity ?? 0);
    const r = custoPorVaga(custo, capacidade, usadas);
    custoVaga.set(k, r.custoVagaCent);
    ociosidadeCent += r.ociosidadeCent;

    const funcao = funcaoDe.get(empId) ?? "Equipe";
    const atual = ocupacaoPorFuncao.get(funcao) ?? { usadas: 0, capacidade: 0 };
    ocupacaoPorFuncao.set(funcao, {
      usadas: atual.usadas + usadas,
      capacidade: atual.capacidade + capacidade,
    });
  }

  /* Alíquota efetiva do período: deduções ÷ receita bruta (§9). */
  const aliquota = dre.receitaBrutaCent > 0 ? dre.deducoesCent / dre.receitaBrutaCent : 0;

  /** A chave da dimensão para uma fatia e para uma alocação. */
  const chaveDaFatia = (f: Fatia): { id: string; nome: string } | null => {
    if (dimensao === "servicos") {
      return f.serviceId
        ? { id: f.serviceId, nome: nomeServico.get(f.serviceId) ?? "Serviço" }
        : null;
    }
    if (dimensao === "squads") {
      const sq = f.clienteId ? squadDoCliente.get(f.clienteId) : null;
      return sq ? { id: sq, nome: nomeSquad.get(sq) ?? "Squad" } : null;
    }
    if (dimensao === "projetos") return null; // resolvido por `projects`, abaixo
    return f.clienteId
      ? { id: f.clienteId, nome: nomeCliente.get(f.clienteId) ?? "Cliente" }
      : null;
  };

  const chaveDaAlocacao = (a: Linha): string | null => {
    const cli = a.client_id ? String(a.client_id) : null;
    if (dimensao === "servicos") return a.service_id ? String(a.service_id) : null;
    if (dimensao === "projetos") return a.project_id ? String(a.project_id) : null;
    if (dimensao === "squads") return cli ? squadDoCliente.get(cli) ?? null : null;
    return cli;
  };

  type Acc = {
    id: string; nome: string; receitaCent: number; equipeCent: number;
    custosDiretosCent: number; vagas: number; servicos: Set<string>;
  };
  const acc = new Map<string, Acc>();
  const pegar = (id: string, nome: string): Acc => {
    const a = acc.get(id) ?? {
      id, nome, receitaCent: 0, equipeCent: 0, custosDiretosCent: 0, vagas: 0, servicos: new Set<string>(),
    };
    acc.set(id, a);
    return a;
  };

  if (dimensao === "projetos") {
    for (const p of projetos) {
      const a = pegar(String(p.id), String(p.name ?? "Projeto"));
      a.nome = String(p.name ?? "Projeto");
      if (p.client_id) a.servicos.add(nomeCliente.get(String(p.client_id)) ?? "");
    }
  }

  let receitaSemCliente = 0;
  for (const f of doPeriodo) {
    const chave = chaveDaFatia(f);
    if (f.impacto === "operating_revenue") {
      if (!chave) { receitaSemCliente += f.valorCent; continue; }
      const a = pegar(chave.id, chave.nome);
      a.receitaCent += f.valorCent;
      if (f.serviceId) a.servicos.add(nomeServico.get(f.serviceId) ?? "");
    } else if (f.impacto === "direct_cost" && chave) {
      pegar(chave.id, chave.nome).custosDiretosCent += f.valorCent;
    }
  }

  // Custo direto sem dimensão é "Operação geral": linha própria, nunca
  // distribuída (§9). Distribuí-la por critério inventado é como ratear
  // estrutura — dá número que leva a decisão errada.
  const operacaoGeralCent = doPeriodo
    .filter((f) => f.impacto === "direct_cost" && !chaveDaFatia(f))
    .reduce((s, f) => s + f.valorCent, 0);

  for (const a of alocacoes) {
    const id = chaveDaAlocacao(a);
    if (!id) continue;
    const k = `${a.employee_id}|${a.month}`;
    const peso = Number(a.weight ?? 1);
    const nome = dimensao === "clientes" ? nomeCliente.get(id) ?? "Cliente"
      : dimensao === "servicos" ? nomeServico.get(id) ?? "Serviço"
      : dimensao === "squads" ? nomeSquad.get(id) ?? "Squad"
      : projetos.find((p) => String(p.id) === id)?.name as string ?? "Projeto";
    const alvo = pegar(id, String(nome));
    alvo.equipeCent += Math.round((custoVaga.get(k) ?? 0) * peso);
    alvo.vagas += peso;
  }

  const linhas: LinhaRentabilidade[] = [...acc.values()]
    .filter((a) => a.receitaCent > 0 || a.equipeCent > 0 || a.custosDiretosCent > 0)
    .map((a) => {
      const deducoes = Math.round(a.receitaCent * aliquota);
      const liquida = a.receitaCent - deducoes;
      const margem = liquida - a.equipeCent - a.custosDiretosCent;
      const pct = liquida > 0 ? Math.round((margem / liquida) * 1000) / 10 : null;
      const saude = saudeDaMargem(pct);
      return {
        id: a.id, nome: a.nome,
        detalhe: [...a.servicos].filter(Boolean).join(", "),
        receitaCent: a.receitaCent, deducoesCent: deducoes, equipeCent: a.equipeCent,
        custosDiretosCent: a.custosDiretosCent, margemCent: margem, margemPct: pct,
        vagas: Math.round((a.vagas / periodo.meses.length) * 10) / 10,
        saude, saudeLabel: SAUDE_LABEL[saude],
        // Receita sem equipe alocada dá margem artificialmente alta (§16).
        aviso: a.receitaCent > 0 && a.equipeCent === 0 ? "sem equipe alocada" : null,
      };
    })
    // Pior primeiro: a lista existe para achar o cliente que dá prejuízo.
    .sort((a, b) => (a.margemPct ?? 999) - (b.margemPct ?? 999));

  const margemClientesCent = linhas.reduce((s, l) => s + l.margemCent, 0);
  const prova = rentabilidadeFechaComDre({
    margemClientesCent,
    ociosidadeCent,
    operacaoGeralCent,
    despesasOperacionaisCent: dre.despesasOperacionaisCent,
    resultadoFinanceiroCent: dre.resultadoFinanceiroCent,
    resultadoLiquidoDreCent: dre.resultadoLiquidoCent,
  });

  const causas: string[] = [];
  if (!prova.confere) {
    if (receitaSemCliente > 0) {
      causas.push(
        `${brl(receitaSemCliente)} de receita sem ${dimensao === "clientes" ? "cliente" : "dimensão"} no item`,
      );
    }
    const custoSemAlocacao = doPeriodo
      .filter((f) => f.impacto === "direct_cost" && !chaveDaFatia(f))
      .reduce((s, f) => s + f.valorCent, 0);
    if (custoSemAlocacao > 0 && operacaoGeralCent === 0) {
      causas.push(`${brl(custoSemAlocacao)} de custo direto sem cliente`);
    }
    if (!alocacoes.length) causas.push("nenhuma alocação de equipe no período");
  }

  const alertas: { texto: string; cta: string }[] = [];
  for (const [funcao, o] of ocupacaoPorFuncao) {
    if (o.capacidade > 0 && o.usadas > o.capacidade) {
      alertas.push({
        texto: `${funcao} acima da capacidade: ${o.usadas} vagas usadas de ${o.capacidade}. ` +
          "O custo por vaga cai, mas a equipe está sobrecarregada.",
        cta: "Ver alocação",
      });
    }
  }
  const semAlocacaoComCusto = colaboradores.filter(
    (c) => !alocacoes.some((a) => String(a.employee_id) === String(c.id)),
  );
  if (semAlocacaoComCusto.length && colaboradores.length) {
    alertas.push({
      texto: `${semAlocacaoComCusto.length} ${semAlocacaoComCusto.length === 1
        ? "colaborador sem alocação" : "colaboradores sem alocação"} no período: ` +
        "o custo deles não é distribuído entre clientes.",
      cta: "Alocar",
    });
  }

  /* Matriz (§6.4): receita × margem, tamanho pelas vagas. */
  const comReceita = linhas.filter((l) => l.receitaCent > 0 && l.margemPct !== null);
  const maiorReceita = Math.max(1, ...comReceita.map((l) => l.receitaCent));
  const margens = comReceita.map((l) => l.margemPct!);
  const minY = Math.min(-20, ...margens) - 5;
  const maxY = 100;
  const posY = (pct: number) => ((maxY - pct) / (maxY - minY)) * 100;
  const receitaTotalDim = comReceita.reduce((s, l) => s + l.receitaCent, 0);
  const liquidaTotal = comReceita.reduce((s, l) => s + (l.receitaCent - l.deducoesCent), 0);
  const margemMedia = liquidaTotal > 0
    ? (comReceita.reduce((s, l) => s + l.margemCent, 0) / liquidaTotal) * 100
    : 0;
  const maiores = new Set(
    [...comReceita].sort((a, b) => b.receitaCent - a.receitaCent).slice(0, 4).map((l) => l.id),
  );

  const matriz = {
    pontos: comReceita.map((l) => ({
      id: l.id, nome: l.nome, receitaCent: l.receitaCent, margemPct: l.margemPct!,
      vagas: l.vagas, saude: l.saude,
      x: (l.receitaCent / maiorReceita) * 92 + 4,
      y: posY(l.margemPct!),
      tamanho: Math.min(36, 12 + l.vagas * 3),
      // Só os quatro maiores e os críticos ganham rótulo: o resto polui.
      comRotulo: maiores.has(l.id) || l.saude === "critica",
    })),
    mediaReceitaX: comReceita.length
      ? ((receitaTotalDim / comReceita.length) / maiorReceita) * 92 + 4
      : 50,
    mediaMargemY: posY(margemMedia),
    zeroY: posY(0),
  };

  const carteira: LinhaRentabilidade = {
    id: "carteira", nome: "Carteira", detalhe: "",
    receitaCent: linhas.reduce((s, l) => s + l.receitaCent, 0),
    deducoesCent: linhas.reduce((s, l) => s + l.deducoesCent, 0),
    equipeCent: linhas.reduce((s, l) => s + l.equipeCent, 0),
    custosDiretosCent: linhas.reduce((s, l) => s + l.custosDiretosCent, 0),
    margemCent: margemClientesCent,
    margemPct: liquidaTotal > 0 ? Math.round((margemClientesCent / liquidaTotal) * 1000) / 10 : null,
    vagas: linhas.reduce((s, l) => s + l.vagas, 0),
    saude: "sem-dados", saudeLabel: "", aviso: null,
  };

  const lacunas: string[] = [];
  if (!colaboradores.length) {
    lacunas.push("Nenhum colaborador cadastrado: sem custo de equipe, não há vaga para ratear.");
  } else if (!alocacoes.length) {
    lacunas.push(
      `Nenhuma alocação de equipe em ${periodo.label}: a margem sai como receita menos custo direto, ` +
      "que é outra coisa.",
    );
  }
  if (receitaSemCliente > 0) {
    lacunas.push(
      `${brl(receitaSemCliente)} de receita sem ${dimensao === "clientes" ? "cliente" : "essa dimensão"} ` +
      "no item: esse valor não entra em nenhuma linha.",
    );
  }
  if (dimensao === "projetos" && !projetos.length) {
    lacunas.push("Nenhum projeto cadastrado.");
  }

  return {
    dimensao, prova: {
      margemClientesCent, ociosidadeCent, operacaoGeralCent,
      estruturaCent: dre.despesasOperacionaisCent,
      financeiroCent: dre.resultadoFinanceiroCent,
      resultadoCent: margemClientesCent - ociosidadeCent - operacaoGeralCent -
        dre.despesasOperacionaisCent + dre.resultadoFinanceiroCent,
      resultadoDreCent: dre.resultadoLiquidoCent,
      confere: prova.confere, diferencaCent: prova.diferencaCent, causas,
    },
    alertas, linhas,
    rodape: { carteira, operacaoGeralCent, ociosidadeCent },
    matriz,
    ocupacao: [...ocupacaoPorFuncao.entries()].map(([funcao, o]) => {
      const pct = o.capacidade > 0 ? Math.round((o.usadas / o.capacidade) * 100) : 0;
      return {
        funcao, usadas: o.usadas, capacidade: o.capacidade, pct,
        estado: pct > 100 ? "Acima da capacidade"
          : pct >= 95 ? "No limite"
          : `Espaço para ${Math.floor(o.capacidade - o.usadas)} vaga(s)`,
      };
    }),
    lacunas,
  };
}

/* ── Aba Receita (§7) ──────────────────────────────────────────────────── */

/**
 * Receita, MRR e concentração.
 *
 * O MRR é CONTRATUAL, não faturado (documento-mãe, §16): é a soma do valor
 * mensal das recorrências ativas. Estimá-lo pela receita do mês confundiria
 * um cliente que atrasou com um que saiu — que é exatamente a diferença que
 * a ponte do MRR existe para mostrar.
 */
async function montarReceita(
  db: SupabaseClient,
  periodo: Periodo,
  fatias: Fatia[],
  mesesEvolucao: { mes: string; label: string }[],
  dre: Dre,
  dreComparacao: Dre,
  compLabel: string,
): Promise<ReceitaView> {
  const [recorrRes, movRes, clientesRes, servicosRes] = await Promise.all([
    db.from("recurrences")
      .select("id, direction, status, amount_cents, party_id, client_id, start_date, end_date")
      .eq("direction", "in"),
    db.from("mrr_movements")
      .select("id, month, client_id, type, amount_cents, reason, effective_date")
      .gte("month", periodo.inicio).lte("month", periodo.fim),
    db.from("clients").select("id, name"),
    db.from("services").select("id, label"),
  ]);

  const recorrencias = ((recorrRes.data ?? []) as Linha[]);
  const movimentosBrutos = ((movRes.data ?? []) as Linha[]);
  const clientes = ((clientesRes.data ?? []) as Linha[]);
  const servicos = ((servicosRes.data ?? []) as Linha[]);
  const nomeCliente = new Map(clientes.map((c) => [String(c.id), String(c.name ?? "Cliente")]));
  const nomeServico = new Map(servicos.map((s) => [String(s.id), String(s.label ?? "Serviço")]));

  const ativas = recorrencias.filter((r) => String(r.status ?? "") === "active");
  const mrrFimCent = ativas.reduce((s, r) => s + cent(r.amount_cents), 0);

  const doPeriodo = fatias.filter((f) => periodo.meses.includes(f.mes));
  const receita = (lista: Fatia[]) =>
    lista.filter((f) => f.impacto === "operating_revenue").reduce((s, f) => s + f.valorCent, 0);
  const receitaCent = receita(doPeriodo);
  const recorrenteCent = doPeriodo
    .filter((f) => f.impacto === "operating_revenue" && f.recorrente)
    .reduce((s, f) => s + f.valorCent, 0);

  const movimentoCent = (tipo: TipoMovimentoMrr) =>
    movimentosBrutos.filter((m) => String(m.type) === tipo)
      .reduce((s, m) => s + cent(m.amount_cents), 0);

  const variacaoMrr = movimentosBrutos.reduce((s, m) => s + cent(m.amount_cents), 0);
  const mrrInicioCent = mrrFimCent - variacaoMrr;
  const churn = churnDeMrr(movimentoCent("churn"), mrrInicioCent);

  const clientesComRecorrencia = new Set(
    ativas.map((r) => String(r.client_id ?? r.party_id ?? "")).filter(Boolean),
  ).size;

  /* Concentração por cliente (§7.5). */
  const porCliente = new Map<string, number>();
  for (const f of doPeriodo) {
    if (f.impacto !== "operating_revenue" || !f.clienteId) continue;
    porCliente.set(f.clienteId, (porCliente.get(f.clienteId) ?? 0) + f.valorCent);
  }
  const linhasConc: LinhaConcentracao[] = concentracao(
    [...porCliente.entries()].map(([id, v]) => ({
      nome: nomeCliente.get(id) ?? "Cliente", receitaCent: v,
    })),
  );
  const maior = linhasConc[0];
  const concentracaoBloco = {
    linhas: linhasConc,
    nota: !maior
      ? "Nenhum item de receita tem cliente vinculado: não há como medir concentração."
      : maior.acima
        ? `${maior.nome} passa de ${LIMITE_CONCENTRACAO_PCT}% da receita do período.`
        : `Nenhum cliente acima de ${LIMITE_CONCENTRACAO_PCT}%. O maior é ${maior.nome}, com ${maior.pct}%.`,
    alerta: Boolean(maior?.acima),
  };

  /* Evolução em 12 meses (§7.4). */
  const porMes = mesesEvolucao.map((m) => {
    const doMes = fatias.filter((f) => f.mes === m.mes && f.impacto === "operating_revenue");
    const rec = doMes.filter((f) => f.recorrente).reduce((s, f) => s + f.valorCent, 0);
    const pon = doMes.filter((f) => !f.recorrente).reduce((s, f) => s + f.valorCent, 0);
    return { ...m, recorrenteCent: rec, pontualCent: pon, mrrCent: 0 };
  });
  const maiorMes = Math.max(1, ...porMes.map((m) => m.recorrenteCent + m.pontualCent));
  const evolucao = porMes.map((m) => ({
    ...m,
    alturaRec: (m.recorrenteCent / maiorMes) * 100,
    alturaPon: (m.pontualCent / maiorMes) * 100,
    noPeriodo: periodo.meses.includes(m.mes),
  }));

  /* Ponte do MRR (§7.2). */
  const passos = ([
    { label: "Início", valorCent: mrrInicioCent, tipo: "inicio" },
    { label: "Novos", valorCent: movimentoCent("new") + movimentoCent("reactivation"), tipo: "delta" },
    { label: "Expansão", valorCent: movimentoCent("expansion") + movimentoCent("resume"), tipo: "delta" },
    { label: "Contração", valorCent: movimentoCent("contraction"), tipo: "delta" },
    { label: "Churn", valorCent: movimentoCent("churn"), tipo: "delta" },
    { label: "Pausas", valorCent: movimentoCent("pause"), tipo: "delta" },
    { label: "Fim", valorCent: mrrFimCent, tipo: "fim" },
  ] as { label: string; valorCent: number; tipo: BarraPonte["tipo"] }[])
    .filter((p) => p.tipo !== "delta" || Math.abs(p.valorCent) >= 100);

  const ponteMrr = escadaDeBarras(passos);

  /* Receita por serviço (§7.6). */
  const chavesServico = [...new Set(doPeriodo
    .filter((f) => f.impacto === "operating_revenue")
    .map((f) => f.serviceId ?? "__sem__"))];
  const anteriorPorServico = new Map<string, number>();
  for (const f of fatias.filter((f) => f.impacto === "operating_revenue" && !periodo.meses.includes(f.mes))) {
    const k = f.serviceId ?? "__sem__";
    anteriorPorServico.set(k, (anteriorPorServico.get(k) ?? 0) + f.valorCent);
  }
  const porServico = chavesServico.map((k) => {
    const lista = doPeriodo.filter(
      (f) => f.impacto === "operating_revenue" && (f.serviceId ?? "__sem__") === k,
    );
    const rec = lista.filter((f) => f.recorrente).reduce((s, f) => s + f.valorCent, 0);
    const pon = lista.filter((f) => !f.recorrente).reduce((s, f) => s + f.valorCent, 0);
    return {
      nome: k === "__sem__" ? "Sem serviço no item" : nomeServico.get(k) ?? "Serviço",
      recorrenteCent: rec, pontualCent: pon, totalCent: rec + pon,
      pct: receitaCent > 0 ? Math.round(((rec + pon) / receitaCent) * 1000) / 10 : 0,
      deltaCent: 0,
    };
  }).sort((a, b) => b.totalCent - a.totalCent);

  const pctRecorrente = receitaCent > 0
    ? Math.round((recorrenteCent / receitaCent) * 1000) / 10 : null;

  const indicadores: IndicadorResultado[] = [
    { key: "mrr", label: "MRR", valor: mrrFimCent > 0 ? brl(mrrFimCent) : "—",
      delta: variacaoMrr ? `${variacaoMrr >= 0 ? "+" : "−"}${brl(Math.abs(variacaoMrr))}` : "—",
      deltaTom: variacaoMrr > 0 ? "bom" : variacaoMrr < 0 ? "ruim" : "neutro",
      contexto: ativas.length
        ? `${ativas.length} ${ativas.length === 1 ? "recorrência ativa" : "recorrências ativas"}`
        : "nenhuma recorrência cadastrada" },
    { key: "receita", label: "Receita do período", valor: brl(dre.receitaBrutaCent),
      delta: dre.receitaBrutaCent && dreComparacao.receitaBrutaCent
        ? `${dre.receitaBrutaCent >= dreComparacao.receitaBrutaCent ? "+" : "−"}${brl(
            Math.abs(dre.receitaBrutaCent - dreComparacao.receitaBrutaCent))}`
        : "—",
      deltaTom: dre.receitaBrutaCent >= dreComparacao.receitaBrutaCent ? "bom" : "ruim",
      contexto: pctRecorrente === null ? `vs. ${compLabel}` : `${pctTexto(pctRecorrente)} recorrente` },
    { key: "ticket", label: "Ticket médio",
      valor: clientesComRecorrencia > 0 ? brl(Math.round(mrrFimCent / clientesComRecorrencia)) : "—",
      delta: "—", deltaTom: "neutro",
      contexto: `${clientesComRecorrencia} ${clientesComRecorrencia === 1 ? "cliente com MRR" : "clientes com MRR"}` },
    { key: "churn", label: "Churn de MRR", valor: churn.pct === null ? "—" : pctTexto(churn.pct),
      delta: "—", deltaTom: churn.alerta ? "ruim" : "neutro",
      contexto: churn.pct === null ? "sem MRR no início do período"
        : `${brl(Math.abs(movimentoCent("churn")))} perdidos` },
    { key: "conc", label: "Concentração top 3",
      valor: linhasConc.length
        ? pctTexto(linhasConc.slice(0, 3).reduce((s, l) => s + l.pct, 0))
        : "—",
      delta: "—", deltaTom: "neutro",
      contexto: linhasConc.length ? "dos 3 maiores clientes" : "receita sem cliente vinculado" },
    { key: "ativos", label: "Clientes ativos", valor: String(clientesComRecorrencia),
      delta: "—", deltaTom: "neutro", contexto: "com recorrência ativa" },
  ];

  const lacunas: string[] = [];
  if (!recorrencias.length) {
    lacunas.push(
      "Nenhuma recorrência de receita cadastrada: MRR, ticket médio e clientes ativos ficam em zero " +
      "porque o MRR é contratual, não faturado.",
    );
  }
  if (!movimentosBrutos.length) {
    lacunas.push(
      "Nenhum movimento de MRR no período: a ponte só ganha novos, expansão, contração e churn " +
      "quando as recorrências passarem a registrar versões e encerramentos.",
    );
  }
  if (!porCliente.size && receitaCent > 0) {
    lacunas.push("Nenhum item de receita tem cliente vinculado: concentração e top 3 ficam vazios.");
  }

  return {
    indicadores, ponteMrr,
    ponteMrrSub: mrrFimCent || mrrInicioCent
      ? `De ${brl(mrrInicioCent)} para ${brl(mrrFimCent)} em ${periodo.label}`
      : "Sem MRR no período",
    movimentos: movimentosBrutos.map((m) => {
      const def = MOVIMENTOS_MRR.find((x) => x.key === String(m.type));
      return {
        id: String(m.id),
        tipo: String(m.type) as TipoMovimentoMrr,
        tipoLabel: def?.label ?? String(m.type),
        tom: def?.tom ?? "neutro",
        cliente: m.client_id ? nomeCliente.get(String(m.client_id)) ?? "Cliente" : "Cliente",
        motivo: String(m.reason ?? ""),
        valorCent: cent(m.amount_cents),
      };
    }),
    evolucao,
    concentracao: concentracaoBloco,
    porServico,
    lacunas,
  };
}

/** Escada de barras (waterfall) com as alturas já resolvidas em %. */
function escadaDeBarras(
  passos: { label: string; valorCent: number; tipo: BarraPonte["tipo"] }[],
): BarraPonte[] {
  const pontos: { de: number; ate: number }[] = [];
  let corrente = 0;
  for (const p of passos) {
    if (p.tipo === "inicio") { pontos.push({ de: 0, ate: p.valorCent }); corrente = p.valorCent; }
    else if (p.tipo === "fim") pontos.push({ de: 0, ate: p.valorCent });
    else { pontos.push({ de: corrente, ate: corrente + p.valorCent }); corrente += p.valorCent; }
  }
  const todos = pontos.flatMap((p) => [p.de, p.ate]).concat(0);
  const maior = Math.max(...todos);
  const menor = Math.min(...todos);
  const faixa = maior - menor || 1;
  const y = (v: number) => ((maior - v) / faixa) * 100;

  return passos.map((p, i) => ({
    label: p.label, valorCent: p.valorCent, tipo: p.tipo,
    topoPct: Math.min(y(pontos[i].de), y(pontos[i].ate)),
    alturaPct: Math.max(1.5, Math.abs(y(pontos[i].de) - y(pontos[i].ate))),
  }));
}
