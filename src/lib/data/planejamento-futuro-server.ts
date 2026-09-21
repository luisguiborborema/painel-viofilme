import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { simular, type Alavancas, type EstadoInicial, type Funcao, type Simulacao } from "@/lib/data/simulacao";

/**
 * Planejamento — o estado real que alimenta o motor de simulação (spec §10).
 *
 * As abas Projeção e Cenários não têm números próprios: as duas chamam a mesma
 * biblioteca de simulação, com o mesmo estado inicial. O que muda são as
 * alavancas. É isso que impede o "cenário base" de discordar da projeção.
 *
 * O estado é montado a partir do que existe de verdade — MRR dos contratos,
 * caixa das contas, folha dos colaboradores, fixos das recorrências. Onde a
 * fonte ainda não existe, a lacuna é DECLARADA em vez de preenchida com um
 * palpite: uma projeção com número inventado é pior que uma projeção que
 * avisa que está incompleta.
 */

type Linha = Record<string, unknown>;
const cent = (reais: unknown) => Math.round((Number(reais) || 0) * 100);

/* ── Cenários prontos (§9.2 e §15) ─────────────────────────────────────── */

export type CenarioPreset = {
  id: string;
  nome: string;
  subtitulo: string;
  cor: string;
  /** Multiplicadores sobre o ritmo atual. */
  novosMult: number;
  churnMult: number;
  pontualAjustePct: number;
  fixosAjustePct: number;
  contratarAutomatico: boolean;
};

export const CENARIOS_PRONTOS: CenarioPreset[] = [
  {
    id: "conservador", nome: "Conservador", subtitulo: "se der errado", cor: "rose",
    // Zero clientes novos: o cenário ruim não é "vender menos", é não vender.
    novosMult: 0, churnMult: 1.6, pontualAjustePct: -30, fixosAjustePct: 0,
    contratarAutomatico: false,
  },
  {
    id: "base", nome: "Base", subtitulo: "se continuar assim", cor: "brand",
    novosMult: 1, churnMult: 1, pontualAjustePct: 0, fixosAjustePct: 0,
    contratarAutomatico: false,
  },
  {
    id: "agressivo", nome: "Agressivo", subtitulo: "se der certo", cor: "emerald",
    novosMult: 1.7, churnMult: 0.7, pontualAjustePct: 20, fixosAjustePct: 5,
    // Só o cenário agressivo contrata sozinho (§11): crescer exige vaga, e
    // fingir que não exige é o erro clássico do plano otimista.
    contratarAutomatico: true,
  },
];

/* ── O que a página recebe ─────────────────────────────────────────────── */

export type EstadoDaEmpresa = {
  mrrCent: number;
  clientes: number;
  caixaCent: number;
  folhaCent: number;
  fixosCent: number;
  ticketCent: number;
  churnPct: number;
  pontualCent: number;
  reservaCent: number;
  impostosPct: number;
  variaveisPct: number;
  novosPorMes: number;
  funcoes: Funcao[];
  vagasUsadas: Record<string, number>;
  capacidade: Record<string, number>;
};

export type CenarioCalculado = {
  id: string;
  nome: string;
  subtitulo: string;
  cor: string;
  alavancas: Alavancas;
  sim: Simulacao;
  /** A linha de capacidade do cartão (§9.2). */
  capacidadeTexto: string;
  capacidadeAlerta: boolean;
  /** Diferença de resultado para a Base. */
  difParaBaseCent: number;
};

export type EventoPrevisto = {
  id: string;
  tipo: string;
  descricao: string;
  mesInicio: string;
  valorCent: number;
  recorrente: boolean;
  confianca: string;
  status: string;
  resolvidoRef: string | null;
};

export type PlanejamentoFuturoView = {
  semDados: boolean;
  pendente: boolean;
  estado: EstadoDaEmpresa;
  /** O que falta para a projeção ser completa. A tela mostra, não esconde. */
  lacunas: string[];
  cenarios: CenarioCalculado[];
  eventos: EventoPrevisto[];
  /** Projeção base: é o cenário Base, para as duas abas não divergirem. */
  projecao: Simulacao | null;
};

const ESTADO_VAZIO: EstadoDaEmpresa = {
  mrrCent: 0, clientes: 0, caixaCent: 0, folhaCent: 0, fixosCent: 0,
  ticketCent: 0, churnPct: 0, pontualCent: 0, reservaCent: 0,
  impostosPct: 0, variaveisPct: 0, novosPorMes: 0,
  funcoes: [], vagasUsadas: {}, capacidade: {},
};

const semTabela = (e: unknown) => {
  const c = (e as { code?: string })?.code;
  const m = e instanceof Error ? e.message : String(e ?? "");
  return c === "42P01" || c === "42703" || /does not exist/i.test(m);
};

/* ── Leitura ───────────────────────────────────────────────────────────── */

export async function getPlanejamentoFuturo(): Promise<PlanejamentoFuturoView> {
  const vazio: PlanejamentoFuturoView = {
    semDados: true, pendente: false, estado: ESTADO_VAZIO,
    lacunas: [], cenarios: [], eventos: [], projecao: null,
  };
  if (!isSupabaseConfigured()) return vazio;
  try {
    return await montar(await createClient());
  } catch (e) {
    if (semTabela(e)) return { ...vazio, semDados: false, pendente: true };
    throw e;
  }
}

async function montar(db: SupabaseClient): Promise<PlanejamentoFuturoView> {
  const [clientesRes, contasRes, equipeRes, recorrRes, funcoesRes, cfgRes, eventosRes, alocRes] =
    await Promise.all([
      db.from("clients").select("monthly_fee, status"),
      db.from("financial_accounts").select("id, opening_balance, counts_as_available").eq("active", true),
      db.from("collaborators").select("salary, role"),
      db.from("recurrences").select("amount_cents, status, direction, kind").eq("direction", "out"),
      db.from("role_params").select("key, label, capacity_per_person, reference_salary_cents, slots_per_client"),
      db.from("finance_settings").select("min_cash_reserve").eq("id", 1).maybeSingle(),
      db.from("forecast_events").select("*").order("start_month"),
      db.from("team_allocations").select("employee_id, client_id, capacity"),
    ]);

  const lacunas: string[] = [];

  // MRR e carteira: a mesma definição do Dashboard (fee contratado dos ativos).
  const clientes = ((clientesRes.data ?? []) as Linha[])
    .filter((c) => String(c.status ?? "") !== "churn" && Number(c.monthly_fee) > 0);
  const mrrCent = clientes.reduce((s, c) => s + cent(c.monthly_fee), 0);
  const ticketCent = clientes.length ? Math.round(mrrCent / clientes.length) : 0;
  if (!clientes.length) lacunas.push("Nenhum cliente com fee mensal: o MRR de partida é zero.");

  // Caixa: saldo inicial + movimentações confirmadas (§23.2 do documento-mãe).
  const contas = ((contasRes.data ?? []) as Linha[]).filter((c) => c.counts_as_available !== false);
  let caixaCent = contas.reduce((s, c) => s + cent(c.opening_balance), 0);
  if (contas.length) {
    const mov = await db.from("transactions")
      .select("amount_cents")
      .in("financial_account_id", contas.map((c) => String(c.id)))
      .eq("confirmation_status", "confirmed");
    caixaCent += ((mov.data ?? []) as Linha[]).reduce((s, m) => s + Math.round(Number(m.amount_cents) || 0), 0);
  }

  const equipe = (equipeRes.data ?? []) as Linha[];
  const folhaCent = equipe.reduce((s, c) => s + cent(c.salary), 0);
  if (!equipe.length) {
    lacunas.push("Nenhum colaborador cadastrado: a folha entra como zero e a capacidade não é conferida.");
  }

  const recorrencias = ((recorrRes.data ?? []) as Linha[])
    .filter((r) => String(r.status ?? "") === "active" && String(r.kind ?? "standard") !== "team");
  const fixosCent = recorrencias.reduce((s, r) => s + Math.round(Number(r.amount_cents) || 0), 0);
  if (!recorrencias.length) {
    lacunas.push("Nenhuma recorrência de despesa ativa: os custos fixos entram como zero.");
  }

  const funcoes: Funcao[] = ((funcoesRes.data ?? []) as Linha[]).map((f) => ({
    key: String(f.key),
    label: String(f.label ?? f.key),
    capacidadePorPessoa: Number(f.capacity_per_person) || 0,
    remuneracaoCent: Math.round(Number(f.reference_salary_cents) || 0),
    vagasPorCliente: Number(f.slots_per_client) || 1,
  }));

  // Capacidade e vagas: vêm da alocação de equipe (§11 da spec). Sem ela, a
  // simulação roda mas não avisa sobre estouro — e a tela diz isso.
  const alocacoes = (alocRes.data ?? []) as Linha[];
  const vagasUsadas: Record<string, number> = {};
  const capacidade: Record<string, number> = {};
  for (const f of funcoes) {
    vagasUsadas[f.key] = 0;
    capacidade[f.key] = 0;
  }
  if (!alocacoes.length) {
    lacunas.push("Sem alocação de equipe: o aviso de capacidade fica desligado até as pessoas terem carteira.");
  }

  const reservaCent = cent((cfgRes.data as Linha | null)?.min_cash_reserve ?? 0);

  // Impostos e variáveis: % sobre a receita, pelo histórico de categorias.
  // Sem histórico, ficam em zero e a lacuna é declarada.
  const { impostosPct, variaveisPct, pontualCent, churnPct, novosPorMes, faltas } =
    await ritmoHistorico(db, mrrCent);
  lacunas.push(...faltas);

  const estado: EstadoDaEmpresa = {
    mrrCent, clientes: clientes.length, caixaCent, folhaCent, fixosCent,
    ticketCent, churnPct, pontualCent, reservaCent,
    impostosPct, variaveisPct, novosPorMes,
    funcoes, vagasUsadas, capacidade,
  };

  const cenarios = calcularCenarios(estado);
  const base = cenarios.find((c) => c.id === "base") ?? null;

  const eventos: EventoPrevisto[] = ((eventosRes.data ?? []) as Linha[]).map((e) => ({
    id: String(e.id),
    tipo: String(e.type ?? ""),
    descricao: String(e.description ?? ""),
    mesInicio: String(e.start_month ?? "").slice(0, 7),
    valorCent: Math.round(Number(e.amount_cents ?? e.amount) || 0),
    recorrente: Boolean(e.recurring),
    confianca: String(e.confidence ?? "likely"),
    status: String(e.status ?? "open"),
    resolvidoRef: e.resolved_ref ? String(e.resolved_ref) : null,
  }));

  return {
    semDados: false, pendente: false, estado, lacunas, cenarios, eventos,
    projecao: base?.sim ?? null,
  };
}

/**
 * Ritmo histórico: as sugestões que a spec quer com origem visível (§2.2).
 *
 * A janela segue §15: 6 meses para novos e pontual, 12 para churn e variáveis.
 */
async function ritmoHistorico(db: SupabaseClient, mrrCent: number) {
  const faltas: string[] = [];
  const hoje = new Date();
  const doze = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - 12, 1))
    .toISOString().slice(0, 10);

  // Receita pontual: média mensal dos títulos de entrada sem recorrência.
  const pontRes = await db.from("installments")
    .select("amount_cents, due_date, doc:documents!installments_document_id_fkey!inner(direction, recurrence_id)")
    .eq("doc.direction", "in").gte("due_date", doze);
  const pontLinhas = ((pontRes.data ?? []) as Linha[]).filter((p) => {
    const d = (Array.isArray(p.doc) ? p.doc[0] : p.doc) as Linha | undefined;
    return d && !d.recurrence_id;
  });
  const pontualCent = pontLinhas.length
    ? Math.round(pontLinhas.reduce((s, p) => s + Math.round(Number(p.amount_cents) || 0), 0) / 12)
    : 0;
  if (!pontualCent) faltas.push("Sem receita pontual nos últimos 12 meses: a média entra como zero.");

  // Churn e ritmo de novos: dependem de mrr_movements, que ainda não é
  // alimentado por ninguém. Sem ele, não há como medir — e um churn chutado
  // muda o resultado de 12 meses inteiro.
  const movRes = await db.from("mrr_movements").select("type, amount_cents, effective_date").gte("effective_date", doze);
  const movs = (movRes.data ?? []) as Linha[];
  let churnPct = 0;
  let novosPorMes = 0;
  if (movs.length) {
    const perdido = movs
      .filter((m) => ["churn", "contraction", "pause"].includes(String(m.type)))
      .reduce((s, m) => s + Math.abs(Math.round(Number(m.amount_cents) || 0)), 0);
    churnPct = mrrCent > 0 ? Math.round((perdido / 12 / mrrCent) * 1000) / 10 : 0;
    novosPorMes = movs.filter((m) => String(m.type) === "new").length / 12;
  } else {
    faltas.push("Sem movimentos de MRR registrados: churn e ritmo de novos clientes entram como zero.");
  }

  // Impostos e variáveis como % da receita: das categorias por tipo de impacto.
  const catRes = await db.from("expense_categories").select("key, impact_type");
  const porImpacto = new Map(
    ((catRes.data ?? []) as Linha[]).map((c) => [String(c.key), String(c.impact_type ?? "")]),
  );
  const despRes = await db.from("document_items")
    .select("amount_cents, category_key, doc:documents!document_items_document_id_fkey!inner(direction)")
    .eq("doc.direction", "out");
  const itens = (despRes.data ?? []) as Linha[];
  const soma = (tipo: string) =>
    itens
      .filter((i) => porImpacto.get(String(i.category_key ?? "")) === tipo)
      .reduce((s, i) => s + Math.round(Number(i.amount_cents) || 0), 0);

  const receitaBase = mrrCent * 12;
  const impostosPct = receitaBase > 0 ? Math.round((soma("revenue_deduction") / receitaBase) * 1000) / 10 : 0;
  const variaveisPct = receitaBase > 0 ? Math.round((soma("direct_cost") / receitaBase) * 1000) / 10 : 0;

  return { impostosPct, variaveisPct, pontualCent, churnPct, novosPorMes, faltas };
}

/* ── Cenários (§9.2) ───────────────────────────────────────────────────── */

export function calcularCenarios(e: EstadoDaEmpresa): CenarioCalculado[] {
  const inicial: EstadoInicial = {
    mrrCent: e.mrrCent, clientes: e.clientes,
    vagasUsadas: e.vagasUsadas, capacidade: e.capacidade,
    folhaCent: e.folhaCent, fixosCent: e.fixosCent, caixaCent: e.caixaCent,
  };

  const calculados = CENARIOS_PRONTOS.map((p) => {
    const alavancas: Alavancas = {
      novosPorMes: Math.round(e.novosPorMes * p.novosMult * 10) / 10,
      churnPct: Math.round(e.churnPct * p.churnMult * 10) / 10,
      ticketCent: e.ticketCent,
      pontualCent: e.pontualCent,
      pontualAjustePct: p.pontualAjustePct,
      fixosAjustePct: p.fixosAjustePct,
      impostosPct: e.impostosPct,
      variaveisPct: e.variaveisPct,
      comissaoPct: 0,
      contratarAutomatico: p.contratarAutomatico,
    };
    const sim = simular(inicial, alavancas, e.funcoes, {
      meses: 12, reservaCent: e.reservaCent,
    });
    return { preset: p, alavancas, sim };
  });

  const base = calculados.find((c) => c.preset.id === "base");

  return calculados.map(({ preset, alavancas, sim }) => ({
    id: preset.id,
    nome: preset.nome,
    subtitulo: preset.subtitulo,
    cor: preset.cor,
    alavancas,
    sim,
    capacidadeTexto: textoDeCapacidade(sim, e),
    capacidadeAlerta: Boolean(sim.primeiroEstouro),
    difParaBaseCent: sim.resultadoAnoCent - (base?.sim.resultadoAnoCent ?? 0),
  }));
}

/** A linha que diz se a equipe comporta o cenário (§9.2). */
function textoDeCapacidade(sim: Simulacao, e: EstadoDaEmpresa): string {
  if (!e.funcoes.length || !Object.values(e.capacidade).some((v) => v > 0)) {
    return "Capacidade não conferida: falta a alocação de equipe.";
  }
  if (sim.contratacoesFeitas.length) {
    const nomes = sim.contratacoesFeitas
      .map((c) => `${rotulo(e, c.funcao)} no mês ${c.mes}`)
      .join(", ");
    return `Contrataria ${nomes}.`;
  }
  if (sim.primeiroEstouro) {
    return `Sem contratação, a capacidade de ${rotulo(e, sim.primeiroEstouro.funcao)} estoura no mês ${sim.primeiroEstouro.mes}.`;
  }
  return "A equipe atual comporta este cenário.";
}

const rotulo = (e: EstadoDaEmpresa, key: string) =>
  e.funcoes.find((f) => f.key === key)?.label ?? key;
