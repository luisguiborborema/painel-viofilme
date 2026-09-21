import "server-only";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { IMPACT_TYPES, type ImpactType } from "@/lib/data/resultados";
import { BLOCOS, LINHAS_FLUXO } from "@/lib/data/caixa";

/**
 * Configurações Financeiras — o lugar único dos parâmetros do módulo.
 *
 * Todas as specs apontam para cá ("Financeiro › Configurações") e nenhuma
 * delas define os valores: quem define é a empresa. O padrão de cada um está
 * no código, então a página funciona sem ninguém configurar nada — mas com a
 * reserva mínima em zero, por exemplo, o caixa só vira alerta depois de ficar
 * negativo, e a tela diz isso.
 *
 * A escrita vai pelos endpoints que já existem (`finance-settings`,
 * `accounts`, `expense-categories`, `finance-reports`): eles já têm validação,
 * alçada e auditoria, e um caminho novo herdaria nada disso.
 */

type Linha = Record<string, unknown>;

/** As linhas de um select com embed, sem os tipos do supabase-js no caminho. */
const linhasDe = (data: unknown): Linha[] => (data ?? []) as Linha[];

export type ParametroNumero = {
  key: string;
  label: string;
  valor: number;
  padrao: number;
  sufixo: string;
  explicacao: string;
  /** De qual spec ele veio, para quem for conferir. */
  origem: string;
};

export type GrupoDeParametros = { titulo: string; descricao: string; itens: ParametroNumero[] };

export type ContaConfig = {
  id: string;
  nome: string;
  tipo: string;
  instituicao: string | null;
  saldoInicial: number;
  ativa: boolean;
  padrao: boolean;
  compoeDisponivel: boolean;
  exigeExtrato: boolean;
};

export type CategoriaConfig = {
  id: string;
  key: string;
  label: string;
  impacto: ImpactType | null;
  blocoFluxo: string | null;
  linhaFluxo: string | null;
  exigeNota: boolean;
  exigeComprovante: boolean;
  ativa: boolean;
};

export type EtapaDaRegua = {
  dia: string;
  acao: string;
  modo: string;
  canal: string | null;
};

export type ConfiguracoesView = {
  semDados: boolean;
  pendente: boolean;
  pendenteMotivo: string | null;
  grupos: GrupoDeParametros[];
  contas: ContaConfig[];
  categorias: CategoriaConfig[];
  regua: EtapaDaRegua[];
  fechadoAte: string | null;
  /** Categorias sem tipo de impacto ficam fora da DRE — a tela cobra. */
  semImpacto: number;
  opcoes: {
    impactos: { key: string; label: string; hint: string }[];
    blocos: { key: string; label: string }[];
    linhas: { key: string; label: string; bloco: string }[];
    tipos: { key: string; label: string }[];
  };
};

export const TIPOS_DE_CONTA = [
  { key: "banco", label: "Banco" },
  { key: "gateway", label: "Gateway" },
  { key: "caixa", label: "Caixa físico" },
  { key: "reserva", label: "Reserva / investimento" },
  { key: "cartao", label: "Cartão de crédito" },
];

const vazio = (pendente: boolean, motivo: string | null): ConfiguracoesView => ({
  semDados: !pendente, pendente, pendenteMotivo: motivo,
  grupos: [], contas: [], categorias: [], regua: [], fechadoAte: null, semImpacto: 0,
  opcoes: {
    impactos: IMPACT_TYPES.map((i) => ({ key: i.key, label: i.label, hint: i.hint })),
    blocos: BLOCOS.map((b) => ({ key: b.key, label: b.label })),
    linhas: LINHAS_FLUXO.map((l) => ({ key: l.key, label: l.label, bloco: l.bloco })),
    tipos: TIPOS_DE_CONTA,
  },
});

export async function getConfiguracoesFinanceiras(): Promise<ConfiguracoesView> {
  if (!isSupabaseConfigured()) return vazio(false, null);
  const db = await createClient();

  const [cfgRes, contasRes, catsRes, etapasRes] = await Promise.all([
    db.from("finance_settings").select("*").eq("id", 1).maybeSingle(),
    db.from("financial_accounts")
      .select("id, name, kind, institution, opening_balance, active, is_default, " +
        "counts_as_available, requires_statement_confirmation")
      .order("position").order("name"),
    db.from("expense_categories")
      .select("id, key, label, impact_type, cash_flow_group, cash_flow_line, " +
        "requires_invoice, requires_receipt, active")
      .order("position"),
    db.from("dunning_steps")
      .select("offset_days, action, mode, channel, dunning_profiles!inner(is_default)")
      .eq("dunning_profiles.is_default", true).order("offset_days"),
  ]);

  if (cfgRes.error && /does not exist|42P01/i.test(cfgRes.error.message)) {
    return vazio(true, "Rode as migrações do Financeiro (0132 em diante) para configurar o módulo.");
  }

  const cfg = (cfgRes.data ?? {}) as Linha;
  const num = (v: unknown, padrao: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : padrao;
  };

  const grupos: GrupoDeParametros[] = [
    {
      titulo: "Caixa e cobrança",
      descricao: "O que dispara aviso no Dashboard e o que a régua de cobrança usa.",
      itens: [
        { key: "minCashReserve", label: "Reserva mínima de caixa", valor: num(cfg.min_cash_reserve, 0),
          padrao: 0, sufixo: "R$", origem: "Dashboard §13",
          explicacao: "Abaixo disso o caixa vira exceção. Em zero, o alerta só aparece depois de ficar negativo." },
        { key: "chargeLeadDays", label: "Antecedência do envio da cobrança", valor: num(cfg.charge_lead_days, 5),
          padrao: 5, sufixo: "dias", origem: "Recebimentos §15",
          explicacao: "Quantos dias antes do vencimento a cobrança seria enviada." },
        { key: "staleStatementDays", label: "Extrato parado vira aviso após", valor: num(cfg.stale_statement_days, 7),
          padrao: 7, sufixo: "dias", origem: "Caixa §16",
          explicacao: "Sem importar extrato por mais tempo que isso, a conta avisa na faixa do Caixa." },
        { key: "unconfirmedDays", label: "Baixa sem confirmação vira pendência após", valor: num(cfg.unconfirmed_days, 7),
          padrao: 7, sufixo: "dias", origem: "Caixa §16",
          explicacao: "Baixa manual que o extrato nunca confirmou aparece na Conciliação." },
      ],
    },
    {
      titulo: "Encargos e impostos",
      descricao: "O que o sistema sugere quando uma parcela vence e o que provisiona de imposto.",
      itens: [
        { key: "lateFine", label: "Multa por atraso", valor: num(cfg.late_fine, 0), padrao: 2,
          sufixo: "%", origem: "Recebimentos §15",
          explicacao: "Percentual fixo sobre o saldo. Zero desliga a sugestão." },
        { key: "lateInterestMonth", label: "Juros por atraso", valor: num(cfg.late_interest_month, 0), padrao: 1,
          sufixo: "% ao mês", origem: "Recebimentos §15",
          explicacao: "Cobrado pro rata die: a taxa mensal dividida por 30, vezes os dias de atraso." },
        { key: "lateGraceDays", label: "Carência antes dos encargos", valor: num(cfg.late_grace_days, 0), padrao: 0,
          sufixo: "dias", origem: "Recebimentos §15", explicacao: "Dias de atraso sem multa nem juros." },
        { key: "taxRate", label: "Alíquota de imposto", valor: num(cfg.tax_rate, 0), padrao: 6,
          sufixo: "%", origem: "Resultados §9", explicacao: "Usada para provisionar a dedução sobre o faturamento." },
        { key: "approvalThreshold", label: "Despesa que exige aprovação a partir de", valor: num(cfg.approval_threshold, 0),
          padrao: 0, sufixo: "R$", origem: "Pagamentos §5",
          explicacao: "Acima deste valor a conta entra como pendente de aprovação. Zero desliga a alçada." },
      ],
    },
    {
      titulo: "Rentabilidade e carteira",
      descricao: "Os limites que pintam o selo de saúde do cliente e disparam alerta de concentração.",
      itens: [
        { key: "healthyMarginPct", label: "Margem de contribuição saudável", valor: num(cfg.healthy_margin_pct, 55),
          padrao: 55, sufixo: "%", origem: "Resultados §14",
          explicacao: "Acima disso o cliente é 'Saudável'. É margem de contribuição, que não inclui estrutura — por isso o limite é alto." },
        { key: "attentionMarginPct", label: "Margem em atenção", valor: num(cfg.attention_margin_pct, 40),
          padrao: 40, sufixo: "%", origem: "Resultados §14",
          explicacao: "Entre este limite e o saudável, o cliente é 'Atenção'. Abaixo, 'Crítica'." },
        { key: "concentrationLimitPct", label: "Limite de concentração por cliente", valor: num(cfg.concentration_limit_pct, 15),
          padrao: 15, sufixo: "%", origem: "Resultados §14",
          explicacao: "Cliente acima desta fatia da receita vira alerta na aba Receita." },
        { key: "churnAlertPct", label: "Alerta de churn de MRR", valor: num(cfg.churn_alert_pct, 2),
          padrao: 2, sufixo: "% ao mês", origem: "Resultados §14",
          explicacao: "Churn mensal acima disso pinta o indicador de vermelho." },
      ],
    },
    {
      titulo: "Fechamento e orçamento",
      descricao: "Quando o mês fecha e quanto de desvio do orçado ainda é tolerável.",
      itens: [
        { key: "closingDueDay", label: "Dia limite para fechar o mês", valor: num(cfg.closing_due_day, 10),
          padrao: 10, sufixo: "do mês", origem: "Dashboard §13",
          explicacao: "Passado este dia sem o mês anterior fechado, o Dashboard avisa." },
        { key: "budgetTolerance", label: "Tolerância do orçado", valor: num(cfg.budget_tolerance, 110),
          padrao: 110, sufixo: "%", origem: "Planejamento §6",
          explicacao: "Acima desta fração do orçado, a categoria vira desvio no farol." },
        { key: "reconcileMaxOpen", label: "Conciliação pendente vira aviso a partir de", valor: num(cfg.reconcile_max_open, 20),
          padrao: 20, sufixo: "movimentações", origem: "Caixa §16", explicacao: "" },
        { key: "reconcileMaxDays", label: "Pendência antiga vira aviso após", valor: num(cfg.reconcile_max_days, 7),
          padrao: 7, sufixo: "dias", origem: "Caixa §16", explicacao: "" },
      ],
    },
  ];

  const contas: ContaConfig[] = linhasDe(contasRes.data).map((c) => ({
    id: String(c.id),
    nome: String(c.name ?? "Conta"),
    tipo: String(c.kind ?? "banco"),
    instituicao: c.institution ? String(c.institution) : null,
    saldoInicial: Number(c.opening_balance ?? 0),
    ativa: c.active !== false,
    padrao: Boolean(c.is_default),
    compoeDisponivel: c.counts_as_available !== false,
    exigeExtrato: c.requires_statement_confirmation !== false,
  }));

  const categorias: CategoriaConfig[] = linhasDe(catsRes.data).map((c) => ({
    id: String(c.id),
    key: String(c.key),
    label: String(c.label ?? c.key),
    impacto: (c.impact_type ? String(c.impact_type) : null) as ImpactType | null,
    blocoFluxo: c.cash_flow_group ? String(c.cash_flow_group) : null,
    linhaFluxo: c.cash_flow_line ? String(c.cash_flow_line) : null,
    exigeNota: Boolean(c.requires_invoice),
    exigeComprovante: Boolean(c.requires_receipt),
    ativa: c.active !== false,
  }));

  const regua: EtapaDaRegua[] = linhasDe(etapasRes.data).map((e) => ({
    dia: `D${Number(e.offset_days ?? 0) >= 0 ? "+" : ""}${Number(e.offset_days ?? 0)}`,
    acao: String(e.action ?? ""),
    modo: String(e.mode ?? "automatic") === "manual" ? "Manual"
      : String(e.mode) === "task" ? "Tarefa" : "Automático",
    canal: e.channel ? String(e.channel) : null,
  }));

  return {
    ...vazio(false, null),
    semDados: false,
    grupos, contas, categorias, regua,
    fechadoAte: cfg.closed_until ? String(cfg.closed_until) : null,
    semImpacto: categorias.filter((c) => !c.impacto).length,
  };
}
