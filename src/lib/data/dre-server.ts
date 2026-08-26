import { createClient } from "@/lib/supabase/server";
import { buscarTudo } from "./paginate-server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * DRE gerencial por período — leitura no banco.
 *
 * Regime de COMPETÊNCIA: receita e despesa entram pela data de vencimento
 * (não pela de pagamento). Uma mensalidade de agosto paga em setembro pertence
 * a agosto. As regras puras de período ficam em ./dre.
 */
export type { DrePeriodo, DreRegime, DreLinha, DreResultado, DreCategoriaLinha } from "./dre";
export { intervalo, variacao } from "./dre";
const STATUS_PAGO_DRE = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "DUNNING_RECEIVED"]);

import { MESES_CURTOS, STATUS_IGNORAR, intervalo, type DreCategoriaLinha, type DrePeriodo, type DreRegime, type DreLinha, type DreResultado } from "./dre";
import { CATEGORIAS_PADRAO } from "./expense-categories";

type Pgto = { value: number | null; due_date: string | null; payment_date?: string | null; status: string | null; clients?: { name?: string } | { name?: string }[] | null };
type Desp = { amount: number | null; due_date: string | null; paid_date?: string | null; category: string | null; description: string | null; status?: string | null };

type CatDef = { key: string; label: string; dreGroup: string };

/**
 * Monta uma coluna do DRE somando as despesas por CATEGORIA cadastrada.
 * Categoria sem movimento não vira linha — o demonstrativo fica enxuto.
 */
function montarLinha(pgtos: Pgto[], desps: Desp[], cats: CatDef[], regime: DreRegime = "competencia"): DreLinha {
  // No caixa, só entra o que foi efetivamente recebido/pago.
  const entra = (p: Pgto) =>
    !STATUS_IGNORAR.has(String(p.status ?? "")) &&
    (regime !== "caixa" || (STATUS_PAGO_DRE.has(String(p.status ?? "")) && Boolean(p.payment_date)));
  const sai = (e: Desp) => regime !== "caixa" || (e.status === "paid" && Boolean(e.paid_date));

  const grossRevenue = Math.round(pgtos.filter(entra).reduce((s, p) => s + Number(p.value ?? 0), 0));
  desps = desps.filter(sai);

  const porChave = new Map<string, number>();
  for (const e of desps) {
    const k = String(e.category ?? "outros");
    porChave.set(k, (porChave.get(k) ?? 0) + Number(e.amount ?? 0));
  }

  const conhecidas = new Set(cats.map((c) => c.key));
  const linhaDe = (c: CatDef): DreCategoriaLinha => ({
    key: c.key,
    label: c.label,
    value: Math.round(porChave.get(c.key) ?? 0),
  });

  const deducoes = cats.filter((c) => c.dreGroup === "deducao").map(linhaDe).filter((l) => l.value !== 0);
  const custos = cats.filter((c) => c.dreGroup !== "deducao").map(linhaDe).filter((l) => l.value !== 0);

  // Lançamento com categoria que não existe mais na tabela não some do DRE:
  // entra agrupado, para o total continuar batendo com o extrato.
  const orfas = [...porChave.entries()].filter(([k]) => !conhecidas.has(k));
  const totalOrfas = Math.round(orfas.reduce((s, [, v]) => s + v, 0));
  if (totalOrfas !== 0) custos.push({ key: "__outras__", label: "Outras (categoria removida)", value: totalOrfas });

  const taxes = deducoes.reduce((s, l) => s + l.value, 0);
  const totalCosts = custos.reduce((s, l) => s + l.value, 0);
  const netRevenue = grossRevenue - taxes;
  const netProfit = netRevenue - totalCosts;

  return {
    grossRevenue,
    taxes,
    taxPct: grossRevenue > 0 ? Math.round((taxes / grossRevenue) * 100) : 0,
    netRevenue,
    deducoes,
    custos,
    totalCosts,
    netProfit,
    margin: grossRevenue > 0 ? Math.round((netProfit / grossRevenue) * 100) : 0,
  };
}

const VAZIA: DreLinha = {
  grossRevenue: 0, taxes: 0, taxPct: 0, netRevenue: 0,
  deducoes: [], custos: [], totalCosts: 0, netProfit: 0, margin: 0,
};

export async function getDre(periodo: DrePeriodo, ref = new Date(), regime: DreRegime = "competencia"): Promise<DreResultado> {
  const r = intervalo(periodo, ref);
  const base: DreResultado = {
    periodo, label: r.label, from: r.from, to: r.to,
    atual: VAZIA, anterior: VAZIA, labelAnterior: r.prevLabel,
    metaMargin: 42, regime, serie: [], topExpenses: [], revenueByClient: [], semDados: true,
  };
  if (!isSupabaseConfigured()) return base;

  try {
    const supabase = await createClient();
    // No caixa, corta pela data de pagamento; na competência, pelo vencimento.
    const coluna = regime === "caixa" ? "payment_date" : "due_date";
    const colunaDesp = regime === "caixa" ? "paid_date" : "due_date";
    const PAY = "value, due_date, payment_date, status, clients(name)";
    const EXP = "amount, due_date, paid_date, category, description, status";

    // Paginado: com `.limit()` fixo, passar do teto devolveria um DRE menor
    // sem erro nenhum — o pior tipo de defeito num relatório financeiro.
    const pagos = (sel: string, de: string, ate: string) =>
      buscarTudo<Pgto>((a, b) =>
        supabase.from("payments").select(sel).gte(coluna, de).lte(coluna, ate).range(a, b));
    const despesas = (de: string, ate: string) =>
      buscarTudo<Desp>((a, b) =>
        supabase.from("expenses").select(EXP).gte(colunaDesp, de).lte(colunaDesp, ate).range(a, b));

    const [pgAtual, pgAnt, dpAtual, dpAnt, cfg, catsRes] = await Promise.all([
      pagos(PAY, r.from, r.to),
      pagos("value, due_date, payment_date, status", r.prevFrom, r.prevTo),
      despesas(r.from, r.to),
      despesas(r.prevFrom, r.prevTo),
      supabase.from("finance_settings").select("meta_margin").eq("id", 1).maybeSingle(),
      supabase.from("expense_categories").select("key, label, dre_group, position").order("position"),
    ]);

    const pAtual = pgAtual.linhas;
    const dAtual = dpAtual.linhas;
    // Se algum bloco bateu no teto, o número está incompleto e a tela avisa.
    const truncado = pgAtual.truncado || pgAnt.truncado || dpAtual.truncado || dpAnt.truncado;

    // Categorias cadastradas; sem a migração 0133, cai nas padrão do código.
    const cats: CatDef[] = catsRes.error
      ? CATEGORIAS_PADRAO.map((c) => ({ key: c.key, label: c.label, dreGroup: c.dreGroup }))
      : ((catsRes.data ?? []) as { key: string; label: string; dre_group: string }[]).map((c) => ({
          key: c.key, label: c.label, dreGroup: c.dre_group,
        }));

    const atual = montarLinha(pAtual, dAtual, cats, regime);
    const anterior = montarLinha(pgAnt.linhas, dpAnt.linhas, cats, regime);

    // Série mês a mês dentro do período.
    const porMes = new Map<string, { receita: number; custos: number }>();
    for (const p of pAtual) {
      if (STATUS_IGNORAR.has(String(p.status ?? ""))) continue;
      const k = String((regime === "caixa" ? p.payment_date : p.due_date) ?? "").slice(0, 7);
      if (!k) continue;
      const v = porMes.get(k) ?? { receita: 0, custos: 0 };
      v.receita += Number(p.value ?? 0);
      porMes.set(k, v);
    }
    for (const e of dAtual) {
      const k = String((regime === "caixa" ? e.paid_date : e.due_date) ?? "").slice(0, 7);
      if (!k) continue;
      const v = porMes.get(k) ?? { receita: 0, custos: 0 };
      v.custos += Number(e.amount ?? 0);
      porMes.set(k, v);
    }
    const serie = [...porMes.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => ({
        mes: `${MESES_CURTOS[Number(k.slice(5, 7)) - 1] ?? k}/${k.slice(2, 4)}`,
        receita: Math.round(v.receita),
        custos: Math.round(v.custos),
        lucro: Math.round(v.receita - v.custos),
      }));

    // Maiores despesas e receita por cliente no período.
    const porDesc = new Map<string, number>();
    for (const e of dAtual) {
      const k = String(e.description ?? "Despesa");
      porDesc.set(k, (porDesc.get(k) ?? 0) + Number(e.amount ?? 0));
    }
    const topExpenses = [...porDesc.entries()]
      .map(([label, value]) => ({ label, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    const porCliente = new Map<string, number>();
    for (const p of pAtual) {
      if (STATUS_IGNORAR.has(String(p.status ?? ""))) continue;
      const co = Array.isArray(p.clients) ? p.clients[0] : p.clients;
      const nome = co?.name ?? "Sem cliente";
      porCliente.set(nome, (porCliente.get(nome) ?? 0) + Number(p.value ?? 0));
    }
    const revenueByClient = [...porCliente.entries()]
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    const metaMargin = Number((cfg.data as { meta_margin?: number } | null)?.meta_margin ?? 42);

    return {
      periodo, label: r.label, from: r.from, to: r.to,
      atual, anterior, labelAnterior: r.prevLabel,
      metaMargin: Number.isFinite(metaMargin) ? metaMargin : 42,
      regime,
      serie, topExpenses, revenueByClient,
      semDados: pAtual.length === 0 && dAtual.length === 0,
      truncado,
    };
  } catch {
    return base;
  }
}

