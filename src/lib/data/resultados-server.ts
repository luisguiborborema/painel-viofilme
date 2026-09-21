import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { buscarTudo } from "@/lib/data/paginate-server";
import { hojeSP } from "@/lib/data/dashboard-financeiro";
import {
  deslocarPeriodo, explicarVariacao, montarDre, paraCadaCem,
  periodoDe, periodoPadrao, ponteFechaComCaixa, ratearItemPorParcelas, seloDoPeriodo,
  type Dre, type Granularidade, type ImpactType, type ImpactoNaVariacao,
  type Periodo, type SegmentoCem, type Selo, type TotaisPorImpacto,
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
};

export type FiltrosResultados = {
  gran?: string;
  periodo?: string;
  comp?: string;
  modo?: string;
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
