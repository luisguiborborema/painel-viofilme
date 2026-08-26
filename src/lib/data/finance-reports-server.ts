import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { STATUS_IGNORAR, intervalo, type DrePeriodo } from "./dre";
import { CATEGORIAS_PADRAO } from "./expense-categories";
import { calcularEncargos, type EncargosConfig } from "./late-fees";
import { estimarImposto, type Provisao, type TaxConfig } from "./tax";
import { getRegrasFinanceiras } from "./finance-guards-server";
import { buscarTudo } from "./paginate-server";

const PAGO = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "DUNNING_RECEIVED"]);
const iso = (d: Date) => d.toISOString().slice(0, 10);

/* ------------------------------- Orçamento -------------------------------- */

/**
 * Orçado × realizado por categoria, no mês.
 *
 * O DRE conta o passado; o orçamento mostra o desvio a tempo de agir. Categoria
 * sem orçamento aparece com planejado zero — gasto não previsto fica evidente.
 */
export type LinhaOrcamento = {
  categoryKey: string;
  label: string;
  orcado: number;
  realizado: number;
  desvio: number;
  /** % do orçamento consumido; null quando não há orçamento definido. */
  consumo: number | null;
};

export type Orcamento = {
  month: string;
  label: string;
  linhas: LinhaOrcamento[];
  totalOrcado: number;
  totalRealizado: number;
  semTabela: boolean;
};

/** `month` no formato YYYY-MM. */
export async function getOrcamento(month?: string): Promise<Orcamento> {
  const hoje = new Date();
  const mes = month && /^\d{4}-\d{2}$/.test(month) ? month : iso(hoje).slice(0, 7);
  const primeiro = `${mes}-01`;
  const ultimo = iso(new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)));
  const vazio: Orcamento = { month: mes, label: mes, linhas: [], totalOrcado: 0, totalRealizado: 0, semTabela: true };
  if (!isSupabaseConfigured()) return vazio;

  try {
    const supabase = await createClient();
    const [catsRes, budRes, expRes] = await Promise.all([
      supabase.from("expense_categories").select("key, label, position").order("position"),
      supabase.from("budgets").select("category_key, amount").eq("month", primeiro),
      buscarTudo<Record<string, unknown>>((a, b) =>
        supabase.from("expenses").select("category, amount").gte("due_date", primeiro).lte("due_date", ultimo).range(a, b)),
    ]);

    const cats = catsRes.error
      ? CATEGORIAS_PADRAO.map((c) => ({ key: c.key, label: c.label }))
      : ((catsRes.data ?? []) as { key: string; label: string }[]);

    const orcadoPor = new Map<string, number>();
    for (const b of (budRes.error ? [] : (budRes.data ?? [])) as Record<string, unknown>[]) {
      orcadoPor.set(String(b.category_key), Number(b.amount ?? 0));
    }
    const realPor = new Map<string, number>();
    for (const e of expRes.linhas) {
      const k = String(e.category ?? "outros");
      realPor.set(k, (realPor.get(k) ?? 0) + Number(e.amount ?? 0));
    }

    // Categoria sem orçamento mas com gasto também entra na lista.
    const chaves = new Set<string>([...cats.map((c) => c.key), ...realPor.keys(), ...orcadoPor.keys()]);
    const linhas: LinhaOrcamento[] = [...chaves]
      .map((k) => {
        const orcado = Math.round(orcadoPor.get(k) ?? 0);
        const realizado = Math.round(realPor.get(k) ?? 0);
        return {
          categoryKey: k,
          label: cats.find((c) => c.key === k)?.label ?? k,
          orcado,
          realizado,
          desvio: realizado - orcado,
          consumo: orcado > 0 ? Math.round((realizado / orcado) * 100) : null,
        };
      })
      .filter((l) => l.orcado > 0 || l.realizado > 0)
      .sort((a, b) => b.desvio - a.desvio);

    return {
      month: mes,
      label: mes,
      linhas,
      totalOrcado: linhas.reduce((s, l) => s + l.orcado, 0),
      totalRealizado: linhas.reduce((s, l) => s + l.realizado, 0),
      semTabela: Boolean(budRes.error),
    };
  } catch {
    return vazio;
  }
}

/* --------------------------------- Aging ---------------------------------- */

/**
 * Aging de recebíveis — quanto está vencido e há quanto tempo.
 * Padrão de mercado para priorizar cobrança: quanto mais velho, menor a chance
 * de receber.
 */
export type FaixaAging = { faixa: string; valor: number; qtd: number };

export type Aging = {
  aVencer: FaixaAging;
  faixas: FaixaAging[];
  totalVencido: number;
  totalAberto: number;
  /** Clientes com mais valor vencido, para priorizar a régua. */
  piores: { name: string; valor: number; diasMax: number; encargos: number }[];
  /** Multa + juros acumulados sobre tudo que está vencido. */
  encargosTotal: number;
  /** Configuração usada, para a tela explicar de onde vem o número. */
  encargos: EncargosConfig;
};

const AGING_VAZIO: Aging = {
  aVencer: { faixa: "A vencer", valor: 0, qtd: 0 },
  faixas: [], totalVencido: 0, totalAberto: 0, piores: [],
  encargosTotal: 0, encargos: { fine: 0, interestMonth: 0, graceDays: 0 },
};

export async function getAging(): Promise<Aging> {
  if (!isSupabaseConfigured()) return AGING_VAZIO;
  try {
    const supabase = await createClient();
    const hoje = new Date();
    const { linhas, erro } = await buscarTudo<Record<string, unknown>>((a, b) =>
      supabase.from("payments").select("value, due_date, status, clients(name)").range(a, b));
    if (erro) return AGING_VAZIO;

    const regras = await getRegrasFinanceiras(supabase);
    const abertos = linhas.filter(
      (p) => !PAGO.has(String(p.status ?? "")) && !STATUS_IGNORAR.has(String(p.status ?? "")) && p.due_date,
    );

    const faixas: FaixaAging[] = [
      { faixa: "1–30 dias", valor: 0, qtd: 0 },
      { faixa: "31–60 dias", valor: 0, qtd: 0 },
      { faixa: "61–90 dias", valor: 0, qtd: 0 },
      { faixa: "+90 dias", valor: 0, qtd: 0 },
    ];
    const aVencer: FaixaAging = { faixa: "A vencer", valor: 0, qtd: 0 };
    const porCliente = new Map<string, { valor: number; diasMax: number; encargos: number }>();
    let encargosTotal = 0;

    for (const p of abertos) {
      const venc = String(p.due_date);
      const valor = Number(p.value ?? 0);
      const dias = Math.floor((hoje.getTime() - new Date(`${venc}T00:00:00Z`).getTime()) / 86_400_000);
      if (dias <= 0) {
        aVencer.valor += valor;
        aVencer.qtd += 1;
        continue;
      }
      const idx = dias <= 30 ? 0 : dias <= 60 ? 1 : dias <= 90 ? 2 : 3;
      faixas[idx].valor += valor;
      faixas[idx].qtd += 1;

      // Multa e juros do título, pela regra configurada.
      const enc = calcularEncargos(valor, venc, regras.encargos, hoje).total;
      encargosTotal += enc;

      const c = p.clients as { name?: string } | { name?: string }[] | null;
      const nome = (Array.isArray(c) ? c[0]?.name : c?.name) ?? "Sem cliente";
      const cur = porCliente.get(nome) ?? { valor: 0, diasMax: 0, encargos: 0 };
      cur.valor += valor;
      cur.encargos += enc;
      cur.diasMax = Math.max(cur.diasMax, dias);
      porCliente.set(nome, cur);
    }

    const totalVencido = faixas.reduce((s, f) => s + f.valor, 0);
    return {
      aVencer: { ...aVencer, valor: Math.round(aVencer.valor) },
      faixas: faixas.map((f) => ({ ...f, valor: Math.round(f.valor) })),
      totalVencido: Math.round(totalVencido),
      totalAberto: Math.round(totalVencido + aVencer.valor),
      encargosTotal: Math.round(encargosTotal * 100) / 100,
      encargos: regras.encargos,
      piores: [...porCliente.entries()]
        .map(([name, v]) => ({ name, valor: Math.round(v.valor), diasMax: v.diasMax, encargos: Math.round(v.encargos * 100) / 100 }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 8),
    };
  } catch {
    return AGING_VAZIO;
  }
}

/* ------------------------------ Indicadores -------------------------------- */

/**
 * Indicadores de gestão financeira.
 *
 * DSO (prazo médio de recebimento): quantos dias, em média, a empresa leva para
 * receber. Calculado sobre o que foi efetivamente pago no período.
 */
export type Indicadores = {
  label: string;
  dso: number | null;
  ticketMedio: number | null;
  receitaRecorrente: number;
  receitaPontual: number;
  pctRecorrente: number | null;
  clientesFaturados: number;
  inadimplenciaPct: number | null;
};

export async function getIndicadores(periodo: DrePeriodo = "mes", ref = new Date()): Promise<Indicadores> {
  const vazio: Indicadores = {
    label: "", dso: null, ticketMedio: null, receitaRecorrente: 0, receitaPontual: 0,
    pctRecorrente: null, clientesFaturados: 0, inadimplenciaPct: null,
  };
  if (!isSupabaseConfigured()) return vazio;

  try {
    const supabase = await createClient();
    const r = intervalo(periodo, ref);
    const { linhas } = await buscarTudo<Record<string, unknown>>((a, b) =>
      supabase.from("payments")
        .select("client_id, value, due_date, payment_date, status, billing_type")
        .gte("due_date", r.from).lte("due_date", r.to).range(a, b));

    const rows = linhas.filter((p) => !STATUS_IGNORAR.has(String(p.status ?? "")));
    if (rows.length === 0) return { ...vazio, label: r.label };

    // DSO: média de dias entre vencimento e pagamento (só o que foi pago).
    const pagos = rows.filter((p) => PAGO.has(String(p.status ?? "")) && p.payment_date && p.due_date);
    const somaDias = pagos.reduce((s, p) => {
      const venc = new Date(`${String(p.due_date)}T00:00:00Z`).getTime();
      const pag = new Date(`${String(p.payment_date)}T00:00:00Z`).getTime();
      return s + Math.max(0, Math.round((pag - venc) / 86_400_000));
    }, 0);

    const total = rows.reduce((s, p) => s + Number(p.value ?? 0), 0);
    const clientes = new Set(rows.map((p) => String(p.client_id ?? "")).filter(Boolean));

    // Assinatura (recorrente) vs cobrança avulsa — pelo tipo de cobrança do Asaas.
    const { data: subs } = await supabase.from("asaas_subscriptions").select("client_id, status");
    const comAssinatura = new Set(
      ((subs ?? []) as Record<string, unknown>[])
        .filter((s) => String(s.status ?? "ACTIVE") === "ACTIVE")
        .map((s) => String(s.client_id)),
    );
    let recorrente = 0;
    let pontual = 0;
    for (const p of rows) {
      const v = Number(p.value ?? 0);
      if (p.client_id && comAssinatura.has(String(p.client_id))) recorrente += v;
      else pontual += v;
    }

    const vencidoNaoPago = rows
      .filter((p) => !PAGO.has(String(p.status ?? "")) && String(p.due_date ?? "") < iso(new Date()))
      .reduce((s, p) => s + Number(p.value ?? 0), 0);

    return {
      label: r.label,
      dso: pagos.length > 0 ? Math.round(somaDias / pagos.length) : null,
      ticketMedio: clientes.size > 0 ? Math.round(total / clientes.size) : null,
      receitaRecorrente: Math.round(recorrente),
      receitaPontual: Math.round(pontual),
      pctRecorrente: total > 0 ? Math.round((recorrente / total) * 100) : null,
      clientesFaturados: clientes.size,
      inadimplenciaPct: total > 0 ? Math.round((vencidoNaoPago / total) * 1000) / 10 : null,
    };
  } catch {
    return vazio;
  }
}

/* ------------------------- Provisão de impostos ---------------------------- */

/**
 * Quanto do faturamento do mês é imposto.
 *
 * O painel não apura nada — só provisiona, para que o saldo em conta não seja
 * confundido com lucro. A base é a receita reconhecida por competência, a mesma
 * do DRE, para não existirem dois números concorrentes.
 */
export type PainelImpostos = {
  config: TaxConfig;
  meses: (Provisao & { jaLancado: boolean })[];
  totalProvisionado: number;
};

export async function getImpostos(meses = 6): Promise<PainelImpostos> {
  const vazio: PainelImpostos = { config: { regime: "simples", rate: 0, dueDay: 20 }, meses: [], totalProvisionado: 0 };
  if (!isSupabaseConfigured()) return vazio;

  try {
    const supabase = await createClient();
    const cfg = (await getRegrasFinanceiras(supabase)).imposto;

    const n = Math.max(1, Math.min(Math.round(meses) || 6, 24));
    const hoje = new Date();
    const inicio = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - (n - 1), 1));

    const { linhas } = await buscarTudo<Record<string, unknown>>((a, b) =>
      supabase.from("payments").select("value, due_date, status")
        .gte("due_date", iso(inicio)).lte("due_date", iso(hoje)).range(a, b));

    const porMes = new Map<string, number>();
    for (const p of linhas) {
      if (STATUS_IGNORAR.has(String(p.status ?? ""))) continue;
      const mes = String(p.due_date ?? "").slice(0, 7);
      if (!mes) continue;
      porMes.set(mes, (porMes.get(mes) ?? 0) + Number(p.value ?? 0));
    }

    // Guias já lançadas como despesa — evita provisionar duas vezes.
    const { data: desp } = await supabase
      .from("expenses")
      .select("description, due_date")
      .ilike("description", "Imposto %")
      .limit(200);
    const lancados = new Set(
      ((desp ?? []) as Record<string, unknown>[]).map((d) => String(d.description ?? "").replace(/^Imposto\s+/i, "").trim()),
    );

    const lista: (Provisao & { jaLancado: boolean })[] = [];
    for (let i = 0; i < n; i++) {
      const d = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - i, 1));
      const mes = iso(d).slice(0, 7);
      const prov = estimarImposto(mes, Math.round(porMes.get(mes) ?? 0), cfg);
      lista.push({ ...prov, jaLancado: lancados.has(mes) });
    }

    return {
      config: cfg,
      meses: lista,
      totalProvisionado: Math.round(lista.filter((m) => !m.jaLancado).reduce((s, m) => s + m.valor, 0) * 100) / 100,
    };
  } catch {
    return vazio;
  }
}
