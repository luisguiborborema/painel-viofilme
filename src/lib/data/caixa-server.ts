import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { buscarTudo } from "@/lib/data/paginate-server";
import {
  brlCheio, ddmm, diasEntre, folegoEmMeses, hojeSP, somarDias,
} from "@/lib/data/dashboard-financeiro";
import {
  blocoDaCategoria, conferirSaldo, estadoDaConta, interpretarDescricao, janelaDoFluxo,
  LINHAS_FLUXO, pendenciasDeFechamento, periodosDaJanela, sugerirConciliacao,
  type BlocoFluxo, type EstadoDaConta, type Horizonte, type LinhaFluxo,
  type NivelSugestao, type ParcelaCandidata,
} from "@/lib/data/caixa";
import type { ImpactType } from "@/lib/data/resultados";

/**
 * Caixa — leitura da página 4 (spec) sobre o núcleo transacional.
 *
 * A fonte do realizado é `transactions`, como o documento-mãe fixa (§4 e
 * invariante §23.1); o previsto vem das parcelas abertas. Recebimentos e
 * Pagamentos trabalham com compromissos; aqui é o dinheiro que se moveu.
 *
 * O saldo NUNCA é digitado: é saldo inicial + movimentações não ignoradas
 * (§12 e invariante §23.2).
 *
 * Tudo em centavos; datas no fuso de São Paulo.
 */

type Linha = Record<string, unknown>;
const cent = (v: unknown) => Math.round(Number(v) || 0);

/** As linhas de um select com embed, sem os tipos do supabase-js no caminho. */
const linhasDe = (data: unknown): Linha[] => (data ?? []) as Linha[];
const reaisParaCent = (v: unknown) => Math.round((Number(v) || 0) * 100);

function exigir<T>(r: { linhas: T[]; erro: { message: string } | null }, onde: string): T[] {
  if (r.erro) throw new Error(`${onde}: ${r.erro.message}`);
  return r.linhas;
}

function exigirDado<T>(r: { data: unknown; error: { message: string } | null }, onde: string): T {
  if (r.error) throw new Error(`${onde}: ${r.error.message}`);
  return (r.data ?? []) as T;
}

/* ── O que a página recebe ─────────────────────────────────────────────── */

export type CartaoConta = {
  id: string;
  nome: string;
  tipo: string;
  tipoLabel: string;
  saldoCent: number;
  noDisponivel: boolean;
  usaExtrato: boolean;
  estado: EstadoDaConta;
  pendentes: number;
};

export type EventoDoCaixa = {
  dataIso: string;
  valorCent: number;
  bloco: BlocoFluxo;
  linha: LinhaFluxo;
  descricao: string;
  tipo: "realizado" | "previsto" | "projetado";
  contaId: string | null;
};

export type PeriodoDoFluxo = {
  inicio: string;
  fim: string;
  label: string;
  futuro: boolean;
  contemHoje: boolean;
  entradasCent: number;
  saidasCent: number;
  saldoFimCent: number;
  /** Alturas em % da área do gráfico; a tela não recalcula escala. */
  alturaEntradas: number;
  alturaSaidas: number;
  saldoY: number;
  maiores: { descricao: string; valorCent: number }[];
};

export type CelulaMes = { mes: string; valorCent: number; clicavel: boolean };

export type LinhaDaTabela = {
  key: string;
  label: string;
  nivel: "saldo" | "bloco" | "linha";
  bloco: BlocoFluxo | null;
  celulas: CelulaMes[];
};

export type FluxoView = {
  horizonte: Horizonte;
  granularidadeTexto: string;
  incluirVencidos: boolean;
  resumo: { key: string; label: string; valor: string; sub: string; tom: "ok" | "ruim" | "neutro" }[];
  periodos: PeriodoDoFluxo[];
  reservaY: number | null;
  menorSaldo: { valorCent: number; dataIso: string; abaixoDaReserva: boolean } | null;
  meses: { mes: string; label: string; tipo: string }[];
  linhas: LinhaDaTabela[];
  nota: string;
  /** Conta fora do disponível: o fluxo explica como ela entra no caixa. */
  foraDoDisponivel: string | null;
};

export type LinhaExtrato = {
  id: string;
  dataIso: string;
  dataLabel: string;
  descricaoClean: string;
  descricaoRaw: string;
  conta: string;
  vinculo: string;
  vinculoTom: "ok" | "atencao" | "neutro";
  entradaCent: number;
  saidaCent: number;
  saldoCent: number | null;
  status: "conciliada" | "pendente" | "ignorada";
};

export type DiaDoExtrato = {
  dataIso: string;
  label: string;
  saldoFimCent: number | null;
  conferencia: { texto: string; confere: boolean } | null;
  linhas: LinhaExtrato[];
};

export type ExtratoView = {
  dias: DiaDoExtrato[];
  total: number;
  entradasCent: number;
  saidasCent: number;
  comSaldoCorrido: boolean;
};

export type ItemDaFila = {
  id: string;
  dataIso: string;
  dataLabel: string;
  idade: string;
  conta: string;
  valorCent: number;
  descricaoRaw: string;
  descricaoClean: string;
  nivel: NivelSugestao;
  selo: string;
  seloTom: string;
  titulo: string;
  detalhe: string;
  acao: string;
  exata: boolean;
  parcelas: string[];
  encargosCent: number;
};

export type BaixaSemConfirmacao = {
  id: string;
  dataIso: string;
  descricao: string;
  sub: string;
  dias: number;
  valorCent: number;
};

export type ConciliacaoView = {
  pendentes: number;
  pendentesSub: string;
  maisAntigaDias: number | null;
  maisAntigaSub: string;
  automaticas7: number;
  fechamento: { mesLabel: string; liberado: boolean; total: number; texto: string };
  exatas: number;
  fila: ItemDaFila[];
  baixasSemConfirmacao: BaixaSemConfirmacao[];
  /** Nenhuma conta usa extrato: a aba explica como ativar. */
  semExtrato: boolean;
};

export type CaixaView = {
  semDados: boolean;
  pendente: boolean;
  pendenteMotivo: string | null;
  hojeIso: string;
  disponivelCent: number;
  folegoTexto: string;
  contas: CartaoConta[];
  contaFiltrada: CartaoConta | null;
  badgeConciliacao: number;
  fluxo: FluxoView;
  extrato: ExtratoView;
  conciliacao: ConciliacaoView;
};

export type FiltrosCaixa = {
  conta?: string;
  hz?: string;
  vencidos?: string;
  q?: string;
  status?: string;
  tipo?: string;
};

const TIPO_LABEL: Record<string, string> = {
  banco: "Banco", gateway: "Gateway", caixa: "Caixa físico",
  reserva: "Reserva", cartao: "Cartão de crédito",
};

/* ── Estado vazio ──────────────────────────────────────────────────────── */

function vazio(hoje: string, semDados: boolean, pendente = false, motivo: string | null = null): CaixaView {
  return {
    semDados, pendente, pendenteMotivo: motivo, hojeIso: hoje,
    disponivelCent: 0, folegoTexto: "sem saídas para medir o fôlego",
    contas: [], contaFiltrada: null, badgeConciliacao: 0,
    fluxo: {
      horizonte: 30, granularidadeTexto: "", incluirVencidos: false, resumo: [],
      periodos: [], reservaY: null, menorSaldo: null, meses: [], linhas: [],
      nota: "", foraDoDisponivel: null,
    },
    extrato: { dias: [], total: 0, entradasCent: 0, saidasCent: 0, comSaldoCorrido: false },
    conciliacao: {
      pendentes: 0, pendentesSub: "", maisAntigaDias: null, maisAntigaSub: "",
      automaticas7: 0,
      fechamento: { mesLabel: "", liberado: true, total: 0, texto: "" },
      exatas: 0, fila: [], baixasSemConfirmacao: [], semExtrato: true,
    },
  };
}

const semTabela = (e: unknown) => {
  const c = (e as { code?: string })?.code;
  const m = e instanceof Error ? e.message : String(e ?? "");
  return c === "42P01" || c === "42703" ||
    /does not exist|schema cache|balance_checkpoints|description_clean|cash_flow/i.test(m);
};

/* ── Leitura ───────────────────────────────────────────────────────────── */

export async function getCaixa(
  filtros: FiltrosCaixa = {},
  agora: Date = new Date(),
): Promise<CaixaView> {
  const hoje = hojeSP(agora);
  if (!isSupabaseConfigured()) return vazio(hoje, true);
  try {
    return await montar(await createClient(), filtros, hoje);
  } catch (e) {
    if (semTabela(e)) {
      return vazio(hoje, false, true,
        "Caixa precisa de 0151_caixa.sql, que traz a conferência de saldo, as importações de " +
        "extrato e o bloco de fluxo das categorias. Rode no Supabase e recarregue.");
    }
    throw e;
  }
}

async function montar(
  db: SupabaseClient,
  filtros: FiltrosCaixa,
  hoje: string,
): Promise<CaixaView> {
  const horizonte = ([30, 60, 90, 365] as const).includes(Number(filtros.hz) as Horizonte)
    ? (Number(filtros.hz) as Horizonte) : 30;
  const janela = janelaDoFluxo(horizonte);
  const incluirVencidos = filtros.vencidos === "1";

  const inicioJanela = somarDias(hoje, -janela.passadoDias);
  const fimJanela = somarDias(hoje, janela.horizonte);

  const [contasRes, cfgRes, catsRes, movsRes, parcelasRes, checkRes, importsRes] = await Promise.all([
    db.from("financial_accounts")
      .select("id, name, kind, opening_balance, active, is_default, position, " +
        "counts_as_available, requires_statement_confirmation, archived_at, " +
        "liquidity_days, payout_rule, statement_day, due_day")
      .is("archived_at", null).eq("active", true).order("position"),
    db.from("finance_settings")
      .select("min_cash_reserve, stale_statement_days, unconfirmed_days, closed_until")
      .eq("id", 1).maybeSingle(),
    db.from("expense_categories").select("key, label, impact_type, cash_flow_group, cash_flow_line"),
    buscarTudo<Linha>((a, b) => db.from("transactions")
      .select("id, financial_account_id, date, amount_cents, description_raw, description_clean, " +
        "counterparty_name, counterparty_document, origin, confirmation_status, " +
        "reconciliation_status, ignored_reason, external_id, bank_reference")
      .gte("date", inicioJanela).lte("date", hoje).range(a, b)),
    buscarTudo<Linha>((a, b) => db.from("installments")
      .select("id, document_id, due_date, scheduled_payment_date, amount_cents, " +
        "open_balance_cents, status, expected_account_id, " +
        "doc:documents!installments_document_id_fkey!inner(id, direction, description)")
      .gt("open_balance_cents", 0)
      .in("status", ["open", "partial"])
      .lte("due_date", fimJanela).range(a, b)),
    db.from("balance_checkpoints")
      .select("id, account_id, date, bank_balance_cents, system_balance_cents, difference_cents, source, status")
      .order("date", { ascending: false }),
    db.from("statement_imports")
      .select("account_id, period_end, imported_at, status")
      .eq("status", "active").order("imported_at", { ascending: false }),
  ]);

  const contas = exigirDado<Linha[]>(contasRes, "contas financeiras");
  const cfg = (cfgRes.data ?? {}) as Linha;
  const cats = exigirDado<Linha[]>(catsRes, "categorias");
  const movimentos = exigir(movsRes, "movimentações");
  const parcelas = exigir(parcelasRes, "parcelas abertas");
  const checkpoints = exigirDado<Linha[]>(checkRes, "conferências de saldo");
  const importacoes = exigirDado<Linha[]>(importsRes, "importações de extrato");

  const reservaMinimaCent = reaisParaCent(cfg.min_cash_reserve);
  const diasParaAviso = Number(cfg.stale_statement_days ?? 7);
  const diasSemConfirmacao = Number(cfg.unconfirmed_days ?? 7);

  const catDe = new Map(cats.map((c) => [String(c.key), {
    label: String(c.label ?? c.key),
    impacto: (c.impact_type ? String(c.impact_type) : null) as ImpactType | null,
    grupo: c.cash_flow_group ? String(c.cash_flow_group) : null,
    linha: c.cash_flow_line ? String(c.cash_flow_line) : null,
  }]));

  /* ── Saldo por conta: inicial + movimentações não ignoradas (§12) ─────── */

  const todasMovsRes = await buscarTudo<Linha>((a, b) => db.from("transactions")
    .select("financial_account_id, amount_cents, ignored_reason, date")
    .lte("date", hoje).range(a, b));
  const todasMovs = exigir(todasMovsRes, "movimentações para o saldo");

  const saldoDaConta = new Map<string, number>();
  for (const c of contas) {
    saldoDaConta.set(String(c.id), reaisParaCent(c.opening_balance));
  }
  for (const m of todasMovs) {
    if (m.ignored_reason) continue;
    const k = String(m.financial_account_id);
    saldoDaConta.set(k, (saldoDaConta.get(k) ?? 0) + cent(m.amount_cents));
  }

  const pendentesPorConta = new Map<string, number>();
  for (const m of movimentos) {
    if (String(m.reconciliation_status ?? "") !== "unreconciled" || m.ignored_reason) continue;
    const k = String(m.financial_account_id);
    pendentesPorConta.set(k, (pendentesPorConta.get(k) ?? 0) + 1);
  }

  const ultimaImportacao = new Map<string, string>();
  for (const i of importacoes) {
    const k = String(i.account_id);
    if (!ultimaImportacao.has(k)) ultimaImportacao.set(k, String(i.period_end ?? i.imported_at).slice(0, 10));
  }
  const checkpointDaConta = new Map<string, Linha>();
  for (const c of checkpoints) {
    const k = String(c.account_id);
    if (!checkpointDaConta.has(k)) checkpointDaConta.set(k, c);
  }

  const cartoes: CartaoConta[] = contas.map((c) => {
    const id = String(c.id);
    const tipo = String(c.kind ?? "banco");
    const usaExtrato = c.requires_statement_confirmation !== false;
    const ultimo = ultimaImportacao.get(id) ?? null;
    const cp = checkpointDaConta.get(id);
    const diferenca = cp && String(cp.status) === "open" ? cent(cp.difference_cents) : null;

    return {
      id, nome: String(c.name ?? "Conta"), tipo, tipoLabel: TIPO_LABEL[tipo] ?? tipo,
      saldoCent: saldoDaConta.get(id) ?? 0,
      noDisponivel: c.counts_as_available !== false,
      usaExtrato,
      pendentes: pendentesPorConta.get(id) ?? 0,
      estado: estadoDaConta({
        tipo,
        diferencaAbertaCent: diferenca,
        diasSemExtrato: ultimo ? diasEntre(ultimo, hoje) : null,
        diasParaAviso,
        conferidoEmIso: cp && String(cp.status) === "matched" ? String(cp.date) : null,
        pendentesDeConciliacao: pendentesPorConta.get(id) ?? 0,
        usaExtrato,
        liquidezDias: c.liquidity_days && typeof c.liquidity_days === "object"
          ? Number((c.liquidity_days as Record<string, unknown>).default ?? 0) || null : null,
        repasse: c.payout_rule ? String(c.payout_rule) : null,
      }),
    };
  });

  const contaFiltrada = filtros.conta
    ? cartoes.find((c) => c.id === filtros.conta) ?? null
    : null;

  const disponivelCent = cartoes
    .filter((c) => c.noDisponivel)
    .reduce((s, c) => s + c.saldoCent, 0);

  /* ── Eventos: realizado e previsto (§5.6) ─────────────────────────────── */

  // A categoria de uma movimentação vem pela cadeia baixa → parcela → título
  // → item. É o que permite dizer em que BLOCO do fluxo ela entra.
  const linhaDaMovimentacao = await montarLinhaDaMovimentacao(db, movimentos, catDe);

  const eventos: EventoDoCaixa[] = [];
  for (const m of movimentos) {
    if (m.ignored_reason) continue;
    const contaId = String(m.financial_account_id);
    if (contaFiltrada && contaId !== contaFiltrada.id) continue;
    const info = linhaDaMovimentacao.get(String(m.id));
    eventos.push({
      dataIso: String(m.date),
      valorCent: cent(m.amount_cents),
      bloco: info?.bloco ?? "operating",
      linha: info?.linha ?? (cent(m.amount_cents) > 0 ? "outras" : "estrutura"),
      descricao: String(m.description_clean ?? m.description_raw ?? "Movimentação"),
      tipo: "realizado",
      contaId,
    });
  }

  const contaPadrao = new Map<string, string>();
  for (const c of contas) {
    if (c.is_default) contaPadrao.set("default", String(c.id));
  }

  for (const p of parcelas) {
    const doc = (Array.isArray(p.doc) ? p.doc[0] : p.doc) as Linha | undefined;
    const entrada = String(doc?.direction ?? "out") === "in";
    const contaPrevista = p.expected_account_id
      ? String(p.expected_account_id)
      : contaPadrao.get("default") ?? null;
    if (contaFiltrada && contaPrevista !== contaFiltrada.id) continue;

    const venc = String(p.due_date);
    const programada = p.scheduled_payment_date ? String(p.scheduled_payment_date) : null;
    let data = programada ?? venc;

    if (venc < hoje) {
      // Pagamento vencido é saída de hoje: ele vai sair, e empurrá-lo para o
      // passado esconderia o aperto de caixa que ele causa agora.
      if (!entrada) data = hoje;
      // Recebimento vencido não entra, a menos que a chave esteja ligada:
      // contar como certo o que já não veio é a forma mais fácil de projetar
      // um caixa que não existe.
      else if (incluirVencidos) data = somarDias(hoje, 1);
      else continue;
    }

    const saldo = cent(p.open_balance_cents);
    eventos.push({
      dataIso: data,
      valorCent: entrada ? saldo : -saldo,
      bloco: entrada ? "operating" : "operating",
      linha: entrada ? "recebimentos" : "estrutura",
      descricao: String(doc?.description ?? (entrada ? "Recebimento previsto" : "Pagamento previsto")),
      tipo: "previsto",
      contaId: contaPrevista,
    });
  }

  /* ── Períodos do gráfico ──────────────────────────────────────────────── */

  const saldoBase = contaFiltrada ? contaFiltrada.saldoCent : disponivelCent;
  const periodosBrutos = periodosDaJanela(hoje, janela);

  // O saldo caminha do início da janela: parte do saldo de hoje e desfaz o
  // realizado para trás, para a linha do passado ser a que de fato houve.
  const realizadoNaJanela = eventos
    .filter((e) => e.tipo === "realizado" && e.dataIso >= inicioJanela && e.dataIso <= hoje)
    .reduce((s, e) => s + e.valorCent, 0);
  let saldoCorrente = saldoBase - realizadoNaJanela;

  const periodos: PeriodoDoFluxo[] = periodosBrutos.map((p) => {
    const doPeriodo = eventos.filter((e) => e.dataIso >= p.inicio && e.dataIso <= p.fim);
    const entradas = doPeriodo.filter((e) => e.valorCent > 0).reduce((s, e) => s + e.valorCent, 0);
    const saidas = doPeriodo.filter((e) => e.valorCent < 0).reduce((s, e) => s - e.valorCent, 0);
    saldoCorrente += entradas - saidas;
    return {
      ...p, entradasCent: entradas, saidasCent: saidas, saldoFimCent: saldoCorrente,
      alturaEntradas: 0, alturaSaidas: 0, saldoY: 0,
      maiores: [...doPeriodo]
        .sort((a, b) => Math.abs(b.valorCent) - Math.abs(a.valorCent))
        .slice(0, 3)
        .map((e) => ({ descricao: e.descricao, valorCent: e.valorCent })),
    };
  });

  const maiorBarra = Math.max(1, ...periodos.map((p) => Math.max(p.entradasCent, p.saidasCent)));
  const saldos = periodos.map((p) => p.saldoFimCent);
  const maiorSaldo = Math.max(reservaMinimaCent, ...saldos, 0);
  const menorSaldoEixo = Math.min(0, ...saldos);
  const faixa = maiorSaldo - menorSaldoEixo || 1;
  const y = (v: number) => ((maiorSaldo - v) / faixa) * 100;

  for (const p of periodos) {
    p.alturaEntradas = (p.entradasCent / maiorBarra) * 100;
    p.alturaSaidas = (p.saidasCent / maiorBarra) * 100;
    p.saldoY = y(p.saldoFimCent);
  }

  // O menor saldo é sempre o DIÁRIO, mesmo com o gráfico em semanas ou meses:
  // é ele que responde "quando aperta?", e a média da semana esconderia o dia
  // em que o saldo fura a reserva.
  const menorDiario = menorSaldoDiario(eventos, saldoBase, hoje, fimJanela, reservaMinimaCent);

  const saidasOperacionais3m = eventos
    .filter((e) => e.tipo === "realizado" && e.valorCent < 0 && e.bloco === "operating" &&
      e.dataIso >= somarDias(hoje, -90))
    .reduce((s, e) => s - e.valorCent, 0);
  const folego = folegoEmMeses(disponivelCent, Math.round(saidasOperacionais3m / 3));

  const futuros = periodos.filter((p) => p.futuro || p.contemHoje);
  const entradasPrevistas = futuros.reduce((s, p) => s + p.entradasCent, 0);
  const saidasPrevistas = futuros.reduce((s, p) => s + p.saidasCent, 0);
  const saldoFim = periodos[periodos.length - 1]?.saldoFimCent ?? saldoBase;

  const resumo: FluxoView["resumo"] = [
    { key: "hoje", label: "Saldo hoje", valor: brlCheio(saldoBase),
      sub: contaFiltrada ? contaFiltrada.nome : "contas do disponível", tom: "neutro" },
    { key: "entradas", label: "Entradas previstas", valor: brlCheio(entradasPrevistas),
      sub: `até ${ddmm(fimJanela)}`, tom: "neutro" },
    { key: "saidas", label: "Saídas previstas", valor: brlCheio(saidasPrevistas),
      sub: `até ${ddmm(fimJanela)}`, tom: "neutro" },
    { key: "fim", label: "Saldo no fim", valor: brlCheio(saldoFim),
      sub: ddmm(fimJanela), tom: saldoFim < 0 ? "ruim" : "neutro" },
    { key: "menor", label: "Menor saldo",
      valor: menorDiario ? brlCheio(menorDiario.valorCent) : "—",
      sub: menorDiario
        ? `${ddmm(menorDiario.dataIso)}${menorDiario.abaixoDaReserva ? ", abaixo da reserva" : ""}`
        : "sem projeção no horizonte",
      // Saldo negativo é vermelho mesmo sem reserva configurada: ficar no
      // vermelho não deixa de ser problema porque ninguém definiu o piso.
      tom: menorDiario && (menorDiario.abaixoDaReserva || menorDiario.valorCent < 0)
        ? "ruim" : "neutro" },
    { key: "folego", label: "Fôlego",
      valor: folego === null ? "—" : `${folego.toFixed(1).replace(".", ",")} meses`,
      sub: folego === null ? "sem saídas operacionais para medir" : "saídas operacionais dos últimos 3 meses",
      tom: folego !== null && folego < 3 ? "ruim" : "neutro" },
  ];

  /* ── Tabela "Fluxo por mês" (§5.4) ────────────────────────────────────── */

  const meses = mesesDaJanela(inicioJanela, fimJanela, hoje);
  const linhasTabela = montarTabela(eventos, meses, saldoBase, hoje, inicioJanela);

  const fluxo: FluxoView = {
    horizonte, granularidadeTexto: janela.explicacao, incluirVencidos, resumo, periodos,
    reservaY: reservaMinimaCent > 0 ? y(reservaMinimaCent) : null,
    menorSaldo: menorDiario,
    meses, linhas: linhasTabela,
    nota: incluirVencidos
      ? "Recebimentos vencidos entram como entrada amanhã."
      : "Recebimentos vencidos não entram na projeção. Pagamentos vencidos entram como saída de hoje.",
    foraDoDisponivel: contaFiltrada && !contaFiltrada.noDisponivel
      ? contaFiltrada.tipo === "cartao"
        ? "Cartão de crédito não tem fluxo próprio: as compras já entraram como despesa, e a fatura " +
          "aparece no consolidado como 'Faturas de cartão'."
        : "Esta conta está fora do disponível: aplicações e resgates aparecem no consolidado " +
          "como 'Entre contas'."
      : null,
  };

  /* ── Extrato (§6) ─────────────────────────────────────────────────────── */

  const extrato = montarExtrato({
    movimentos, cartoes, contaFiltrada, checkpoints, filtros, saldoDaConta,
  });

  /* ── Conciliação (§8) ─────────────────────────────────────────────────── */

  const conciliacao = await montarConciliacao({
    db, movimentos, cartoes, contaFiltrada, hoje, diasSemConfirmacao,
    fechadoAte: cfg.closed_until ? String(cfg.closed_until) : null,
  });

  return {
    semDados: false, pendente: false, pendenteMotivo: null, hojeIso: hoje,
    disponivelCent,
    folegoTexto: folego === null
      ? "sem saídas para medir o fôlego"
      : `Cerca de ${folego.toFixed(1).replace(".", ",")} meses de fôlego`,
    contas: cartoes, contaFiltrada,
    badgeConciliacao: conciliacao.pendentes + conciliacao.baixasSemConfirmacao.length,
    fluxo, extrato, conciliacao,
  };
}

/* ── Auxiliares ────────────────────────────────────────────────────────── */

/**
 * A que linha do fluxo cada movimentação pertence.
 *
 * O caminho é baixa → parcela → título → item → categoria. Parece longo, e é:
 * é o preço de a movimentação ser o dinheiro e a categoria ser do item. Sem
 * percorrê-lo, toda saída viraria "estrutura" e o bloco perderia a função.
 */
async function montarLinhaDaMovimentacao(
  db: SupabaseClient,
  movimentos: Linha[],
  catDe: Map<string, { label: string; impacto: ImpactType | null; grupo: string | null; linha: string | null }>,
): Promise<Map<string, { bloco: BlocoFluxo; linha: LinhaFluxo; categoria: string; vinculo: string }>> {
  const mapa = new Map<string, { bloco: BlocoFluxo; linha: LinhaFluxo; categoria: string; vinculo: string }>();
  const ids = movimentos.map((m) => String(m.id));
  if (!ids.length) return mapa;

  const { data: links } = await db.from("reconciliation_links")
    .select("transaction_id, settlement_id")
    .in("transaction_id", ids.slice(0, 500));
  const linksLista = ((links ?? []) as Linha[]);
  if (!linksLista.length) return mapa;

  const settlementIds = [...new Set(linksLista.map((l) => String(l.settlement_id)))];
  const { data: baixas } = await db.from("settlements")
    .select("id, installment_id").in("id", settlementIds.slice(0, 500));
  const baixasLista = ((baixas ?? []) as Linha[]);

  const parcelaIds = [...new Set(baixasLista.map((b) => String(b.installment_id)))];
  const { data: parcelas } = await db.from("installments")
    .select("id, document_id").in("id", parcelaIds.slice(0, 500));
  const parcelasLista = ((parcelas ?? []) as Linha[]);

  const docIds = [...new Set(parcelasLista.map((p) => String(p.document_id)))];
  const [{ data: itens }, { data: docs }] = await Promise.all([
    db.from("document_items").select("document_id, category_key, description").in("document_id", docIds.slice(0, 500)),
    db.from("documents").select("id, description, direction").in("id", docIds.slice(0, 500)),
  ]);
  const itemDoDoc = new Map<string, Linha>();
  for (const i of ((itens ?? []) as Linha[])) {
    if (!itemDoDoc.has(String(i.document_id))) itemDoDoc.set(String(i.document_id), i);
  }
  const docDe = new Map(((docs ?? []) as Linha[]).map((d) => [String(d.id), d]));
  const docDaParcela = new Map(parcelasLista.map((p) => [String(p.id), String(p.document_id)]));
  const parcelaDaBaixa = new Map(baixasLista.map((b) => [String(b.id), String(b.installment_id)]));

  for (const l of linksLista) {
    const parcelaId = parcelaDaBaixa.get(String(l.settlement_id));
    const docId = parcelaId ? docDaParcela.get(parcelaId) : null;
    if (!docId) continue;
    const item = itemDoDoc.get(docId);
    const doc = docDe.get(docId);
    const cat = item?.category_key ? catDe.get(String(item.category_key)) : undefined;
    const { bloco, linha } = blocoDaCategoria(
      cat?.impacto ?? (String(doc?.direction) === "in" ? "operating_revenue" : "operating_expense"),
      { grupo: cat?.grupo, linha: cat?.linha },
    );
    mapa.set(String(l.transaction_id), {
      bloco, linha,
      categoria: cat?.label ?? "Sem categoria",
      vinculo: String(doc?.description ?? "Lançamento"),
    });
  }
  return mapa;
}

/**
 * O menor saldo DIÁRIO do horizonte — o que responde "quando aperta?".
 *
 * A varredura começa em HOJE, não amanhã: pagamento vencido entra como saída
 * de hoje, e pular o primeiro dia deixava justamente o maior aperto de fora.
 * Foi o que aconteceu — o cartão dizia "menor saldo R$ 500" enquanto o
 * gráfico ao lado mostrava a linha indo a −R$ 3.500 no mesmo dia.
 */
function menorSaldoDiario(
  eventos: EventoDoCaixa[],
  saldoHojeCent: number,
  hoje: string,
  fim: string,
  reservaMinimaCent: number,
): { valorCent: number; dataIso: string; abaixoDaReserva: boolean } | null {
  if (fim < hoje) return null;
  let saldo = saldoHojeCent;
  let menor: { valorCent: number; dataIso: string } | null = null;
  for (let d = hoje; d <= fim; d = somarDias(d, 1)) {
    saldo += eventos
      .filter((e) => e.dataIso === d && e.tipo !== "realizado")
      .reduce((s, e) => s + e.valorCent, 0);
    if (!menor || saldo < menor.valorCent) menor = { valorCent: saldo, dataIso: d };
  }
  if (!menor) return null;
  return { ...menor, abaixoDaReserva: reservaMinimaCent > 0 && menor.valorCent < reservaMinimaCent };
}

const MESES_LABEL = [
  "", "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez",
];

function mesesDaJanela(inicio: string, fim: string, hoje: string) {
  const meses: { mes: string; label: string; tipo: string }[] = [];
  let ano = Number(inicio.slice(0, 4));
  let mes = Number(inicio.slice(5, 7));
  const fimAno = Number(fim.slice(0, 4));
  const fimMes = Number(fim.slice(5, 7));
  const mesAtual = hoje.slice(0, 7);

  while (ano < fimAno || (ano === fimAno && mes <= fimMes)) {
    const iso = `${ano}-${String(mes).padStart(2, "0")}`;
    const distancia = (ano - Number(hoje.slice(0, 4))) * 12 + (mes - Number(hoje.slice(5, 7)));
    meses.push({
      mes: iso,
      label: `${MESES_LABEL[mes]}/${String(ano).slice(2)}`,
      // "Projetado" é diferente de "previsto": além de dois meses, não há
      // parcela nenhuma, só a regra da recorrência — e a tela precisa dizer
      // isso para ninguém tratar os dois números com a mesma confiança.
      tipo: iso < mesAtual ? "realizado"
        : iso === mesAtual ? "real + prev"
        : distancia <= 2 ? "previsto" : "projetado",
    });
    mes += 1;
    if (mes > 12) { mes = 1; ano += 1; }
  }
  return meses;
}

function montarTabela(
  eventos: EventoDoCaixa[],
  meses: { mes: string; label: string; tipo: string }[],
  saldoHojeCent: number,
  hoje: string,
  inicioJanela: string,
): LinhaDaTabela[] {
  const noMes = (e: EventoDoCaixa, mes: string) => e.dataIso.slice(0, 7) === mes;
  const soma = (mes: string, filtro: (e: EventoDoCaixa) => boolean) =>
    eventos.filter((e) => noMes(e, mes) && filtro(e)).reduce((s, e) => s + e.valorCent, 0);

  // O saldo inicial de cada mês caminha a partir de hoje, para trás e para a
  // frente: é a mesma série do gráfico, vista por mês.
  const realizadoAteHoje = eventos
    .filter((e) => e.tipo === "realizado" && e.dataIso >= inicioJanela && e.dataIso <= hoje)
    .reduce((s, e) => s + e.valorCent, 0);
  let saldo = saldoHojeCent - realizadoAteHoje;

  const saldosIniciais: Record<string, number> = {};
  const saldosFinais: Record<string, number> = {};
  for (const m of meses) {
    saldosIniciais[m.mes] = saldo;
    saldo += soma(m.mes, () => true);
    saldosFinais[m.mes] = saldo;
  }

  const linhas: LinhaDaTabela[] = [
    {
      key: "saldo-inicial", label: "Saldo inicial", nivel: "saldo", bloco: null,
      celulas: meses.map((m) => ({ mes: m.mes, valorCent: saldosIniciais[m.mes], clicavel: false })),
    },
  ];

  for (const bloco of ["operating", "investing", "financing", "internal"] as BlocoFluxo[]) {
    const doBloco = LINHAS_FLUXO.filter((l) => l.bloco === bloco);
    const temAlgo = meses.some((m) => soma(m.mes, (e) => e.bloco === bloco) !== 0);
    if (!temAlgo) continue;

    linhas.push({
      key: bloco,
      label: BLOCO_LABEL[bloco],
      nivel: "bloco", bloco,
      celulas: meses.map((m) => ({
        mes: m.mes, valorCent: soma(m.mes, (e) => e.bloco === bloco), clicavel: false,
      })),
    });

    for (const l of doBloco) {
      const valores = meses.map((m) => soma(m.mes, (e) => e.linha === l.key));
      if (valores.every((v) => v === 0)) continue;
      linhas.push({
        key: `${bloco}:${l.key}`, label: l.label, nivel: "linha", bloco,
        celulas: meses.map((m, i) => ({ mes: m.mes, valorCent: valores[i], clicavel: valores[i] !== 0 })),
      });
    }
  }

  linhas.push({
    key: "saldo-final", label: "Saldo final", nivel: "saldo", bloco: null,
    celulas: meses.map((m) => ({ mes: m.mes, valorCent: saldosFinais[m.mes], clicavel: false })),
  });
  return linhas;
}

const BLOCO_LABEL: Record<BlocoFluxo, string> = {
  operating: "OPERACIONAL", investing: "INVESTIMENTOS",
  financing: "SÓCIOS E FINANCIAMENTO", internal: "ENTRE CONTAS",
};

function montarExtrato(input: {
  movimentos: Linha[];
  cartoes: CartaoConta[];
  contaFiltrada: CartaoConta | null;
  checkpoints: Linha[];
  filtros: FiltrosCaixa;
  saldoDaConta: Map<string, number>;
}): ExtratoView {
  const { movimentos, cartoes, contaFiltrada, checkpoints, filtros } = input;
  const nomeConta = new Map(cartoes.map((c) => [c.id, c.nome]));
  const busca = (filtros.q ?? "").trim().toLowerCase();

  const filtradas = movimentos
    .filter((m) => !contaFiltrada || String(m.financial_account_id) === contaFiltrada.id)
    .filter((m) => {
      const status = m.ignored_reason ? "ignorada"
        : String(m.reconciliation_status ?? "") === "reconciled" ? "conciliada" : "pendente";
      return !filtros.status || filtros.status === "todos" || filtros.status === status;
    })
    .filter((m) => {
      if (!filtros.tipo || filtros.tipo === "todas") return true;
      return filtros.tipo === "entradas" ? cent(m.amount_cents) > 0 : cent(m.amount_cents) < 0;
    })
    .filter((m) => !busca ||
      String(m.description_clean ?? "").toLowerCase().includes(busca) ||
      String(m.description_raw ?? "").toLowerCase().includes(busca) ||
      String(m.counterparty_name ?? "").toLowerCase().includes(busca) ||
      String(Math.abs(cent(m.amount_cents)) / 100).includes(busca))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  // O saldo corrido só existe com UMA conta do disponível filtrada: somar
  // contas diferentes daria um número que não corresponde a extrato nenhum.
  const comSaldoCorrido = Boolean(contaFiltrada && contaFiltrada.noDisponivel);

  const porDia = new Map<string, Linha[]>();
  for (const m of filtradas) {
    const d = String(m.date);
    porDia.set(d, [...(porDia.get(d) ?? []), m]);
  }

  let saldoCorrido = comSaldoCorrido ? contaFiltrada!.saldoCent : 0;
  const dias: DiaDoExtrato[] = [];
  for (const [dataIso, linhasDoDia] of [...porDia.entries()].sort((a, b) => b[0].localeCompare(a[0]))) {
    const saldoFim = comSaldoCorrido ? saldoCorrido : null;
    const linhas: LinhaExtrato[] = [];
    for (const m of linhasDoDia) {
      const valor = cent(m.amount_cents);
      const ignorada = Boolean(m.ignored_reason);
      const conciliada = String(m.reconciliation_status ?? "") === "reconciled";
      const saldoAqui = comSaldoCorrido ? saldoCorrido : null;
      if (comSaldoCorrido && !ignorada) saldoCorrido -= valor;

      const interpretada = m.description_clean
        ? String(m.description_clean)
        : interpretarDescricao(
            String(m.description_raw ?? ""), valor,
            m.counterparty_name ? String(m.counterparty_name) : null,
          ).texto;

      linhas.push({
        id: String(m.id), dataIso, dataLabel: ddmm(dataIso),
        descricaoClean: interpretada,
        descricaoRaw: String(m.description_raw ?? ""),
        conta: nomeConta.get(String(m.financial_account_id)) ?? "—",
        vinculo: ignorada ? `Ignorada: ${String(m.ignored_reason)}`
          : conciliada ? "Conciliada"
          : "Pendente de conciliação",
        vinculoTom: ignorada ? "neutro" : conciliada ? "ok" : "atencao",
        entradaCent: valor > 0 ? valor : 0,
        saidaCent: valor < 0 ? -valor : 0,
        saldoCent: saldoAqui,
        status: ignorada ? "ignorada" : conciliada ? "conciliada" : "pendente",
      });
    }

    const cp = checkpoints.find(
      (c) => String(c.date) === dataIso &&
        (!contaFiltrada || String(c.account_id) === contaFiltrada.id),
    );

    dias.push({
      dataIso,
      label: ddmm(dataIso),
      saldoFimCent: saldoFim,
      conferencia: cp
        ? (() => {
            const r = conferirSaldo(cent(cp.bank_balance_cents), cent(cp.system_balance_cents), dataIso);
            return {
              texto: r.confere
                ? `Saldo do banco em ${ddmm(dataIso)}: ${brlCheio(cent(cp.bank_balance_cents))}. Confere com o sistema`
                : `Saldo do banco em ${ddmm(dataIso)}: ${brlCheio(cent(cp.bank_balance_cents))}. ` +
                  `Sistema: ${brlCheio(cent(cp.system_balance_cents))}. Diferença de ${brlCheio(Math.abs(r.diferencaCent))}`,
              confere: r.confere,
            };
          })()
        : null,
      linhas,
    });
  }

  const validas = filtradas.filter((m) => !m.ignored_reason);
  return {
    dias, total: filtradas.length,
    entradasCent: validas.filter((m) => cent(m.amount_cents) > 0).reduce((s, m) => s + cent(m.amount_cents), 0),
    saidasCent: validas.filter((m) => cent(m.amount_cents) < 0).reduce((s, m) => s - cent(m.amount_cents), 0),
    comSaldoCorrido,
  };
}

async function montarConciliacao(input: {
  db: SupabaseClient;
  movimentos: Linha[];
  cartoes: CartaoConta[];
  contaFiltrada: CartaoConta | null;
  hoje: string;
  diasSemConfirmacao: number;
  fechadoAte: string | null;
}): Promise<ConciliacaoView> {
  const { db, movimentos, cartoes, contaFiltrada, hoje, diasSemConfirmacao } = input;
  const nomeConta = new Map(cartoes.map((c) => [c.id, c.nome]));

  const pendentes = movimentos.filter(
    (m) => !m.ignored_reason &&
      String(m.reconciliation_status ?? "") === "unreconciled" &&
      (!contaFiltrada || String(m.financial_account_id) === contaFiltrada.id),
  );

  // Candidatas: parcelas abertas com a contraparte, para a sugestão poder
  // comparar valor e documento.
  const { data: abertas } = await db.from("installments")
    .select("id, due_date, open_balance_cents, " +
      "doc:documents!installments_document_id_fkey!inner(direction, description, " +
      "party:parties!documents_party_id_fkey(document))")
    .gt("open_balance_cents", 0).in("status", ["open", "partial"]);

  const candidatas: ParcelaCandidata[] = linhasDe(abertas).map((p) => {
    const doc = (Array.isArray(p.doc) ? p.doc[0] : p.doc) as Linha | undefined;
    const party = doc ? (Array.isArray(doc.party) ? doc.party[0] : doc.party) as Linha | undefined : undefined;
    return {
      id: String(p.id),
      descricao: String(doc?.description ?? "Parcela"),
      vencimentoIso: String(p.due_date),
      saldoCent: cent(p.open_balance_cents),
      documento: party?.document ? String(party.document) : null,
      direcao: String(doc?.direction ?? "out") === "in" ? "in" : "out",
    };
  });

  // Baixas manuais esperando o extrato: são o outro lado do controle.
  const { data: baixas } = await db.from("settlements")
    .select("id, installment_id, date, principal_cents, financial_account_id, created_by, reversed_at")
    .is("reversed_at", null);
  const { data: links } = await db.from("reconciliation_links").select("transaction_id, settlement_id");
  const baixaConciliada = new Set(((links ?? []) as Linha[]).map((l) => String(l.settlement_id)));

  const baixasSemConfirmacao: BaixaSemConfirmacao[] = ((baixas ?? []) as Linha[])
    .filter((b) => !baixaConciliada.has(String(b.id)))
    .filter((b) => diasEntre(String(b.date), hoje) > diasSemConfirmacao)
    .filter((b) => !contaFiltrada || String(b.financial_account_id) === contaFiltrada.id)
    .map((b) => ({
      id: String(b.id),
      dataIso: String(b.date),
      descricao: `Baixa de ${brlCheio(cent(b.principal_cents))}`,
      sub: `Registrada em ${ddmm(String(b.date))}` +
        (b.created_by ? ` por ${String(b.created_by)}` : "") +
        (b.financial_account_id ? `, conta ${nomeConta.get(String(b.financial_account_id)) ?? "—"}` : ""),
      dias: diasEntre(String(b.date), hoje),
      valorCent: cent(b.principal_cents),
    }))
    .sort((a, b) => b.dias - a.dias);

  const baixasParaSugestao = ((baixas ?? []) as Linha[])
    .filter((b) => !baixaConciliada.has(String(b.id)))
    .map((b) => ({
      id: String(b.id), dataIso: String(b.date), valorCent: cent(b.principal_cents),
      descricao: `Baixa registrada${b.created_by ? ` por ${String(b.created_by)}` : ""}`,
    }));

  const fila: ItemDaFila[] = pendentes.map((m) => {
    const contaId = String(m.financial_account_id);
    const sugestao = sugerirConciliacao({
      movimento: {
        id: String(m.id), dataIso: String(m.date), valorCent: cent(m.amount_cents),
        descricaoRaw: String(m.description_raw ?? ""),
        documentoContraparte: m.counterparty_document ? String(m.counterparty_document) : null,
        contaId,
      },
      candidatas,
      baixasPendentes: baixasParaSugestao,
      movimentosDeOutrasContas: movimentos
        .filter((o) => String(o.financial_account_id) !== contaId && !o.ignored_reason)
        .map((o) => ({
          id: String(o.id), dataIso: String(o.date), valorCent: cent(o.amount_cents),
          contaNome: nomeConta.get(String(o.financial_account_id)) ?? "outra conta",
        })),
      regra: null,
    });

    const def = NIVEL[sugestao.nivel];
    return {
      id: String(m.id), dataIso: String(m.date), dataLabel: ddmm(String(m.date)),
      idade: `há ${diasEntre(String(m.date), hoje)} dias`,
      conta: nomeConta.get(contaId) ?? "—",
      valorCent: cent(m.amount_cents),
      descricaoRaw: String(m.description_raw ?? ""),
      descricaoClean: String(m.description_clean ?? ""),
      nivel: sugestao.nivel, selo: def.selo, seloTom: def.tom, acao: def.acao,
      titulo: sugestao.titulo, detalhe: sugestao.detalhe,
      exata: sugestao.exata, parcelas: sugestao.parcelas, encargosCent: sugestao.encargosCent,
    };
  }).sort((a, b) => Number(b.exata) - Number(a.exata) || b.dataIso.localeCompare(a.dataIso));

  const maisAntiga = [...pendentes].sort((a, b) => String(a.date).localeCompare(String(b.date)))[0];
  const mesAnterior = somarDias(`${hoje.slice(0, 7)}-01`, -1).slice(0, 7);
  // O fechamento olha o mês ANTERIOR: é o que está prestes a ser fechado, e é
  // nele que uma pendência ainda dá tempo de ser resolvida.
  const fechamento = pendenciasDeFechamento({
    movimentacoesPendentes: pendentes.filter((m) => String(m.date).slice(0, 7) === mesAnterior).length,
    baixasSemConfirmacao: baixasSemConfirmacao.filter((b) => b.dataIso.slice(0, 7) === mesAnterior).length,
    conferenciasAbertas: cartoes.filter((c) => c.estado.prioridade === 1).length,
  });

  return {
    pendentes: pendentes.length,
    pendentesSub: `${pendentes.filter((m) => cent(m.amount_cents) > 0).length} entradas, ` +
      `${pendentes.filter((m) => cent(m.amount_cents) < 0).length} saídas`,
    maisAntigaDias: maisAntiga ? diasEntre(String(maisAntiga.date), hoje) : null,
    maisAntigaSub: maisAntiga
      ? `${nomeConta.get(String(maisAntiga.financial_account_id)) ?? "—"} · ` +
        String(maisAntiga.description_raw ?? "").slice(0, 40)
      : "nada pendente",
    automaticas7: movimentos.filter(
      (m) => String(m.reconciliation_status ?? "") === "reconciled" &&
        diasEntre(String(m.date), hoje) <= 7 && String(m.origin ?? "") === "integration",
    ).length,
    fechamento: {
      mesLabel: `${MESES_LABEL[Number(mesAnterior.slice(5, 7))]}/${mesAnterior.slice(2, 4)}`,
      liberado: fechamento.liberado,
      total: fechamento.total,
      texto: fechamento.liberado
        ? "Liberado"
        : fechamento.pendencias.map((p) => p.texto).join(" · "),
    },
    exatas: fila.filter((f) => f.exata).length,
    fila,
    baixasSemConfirmacao,
    semExtrato: !cartoes.some((c) => c.usaExtrato),
  };
}

const NIVEL: Record<NivelSugestao, { selo: string; tom: string; acao: string }> = {
  exata: { selo: "Correspondência exata", tom: "ok", acao: "Conciliar" },
  confirma: { selo: "Correspondência exata", tom: "ok", acao: "Confirmar" },
  encargos: { selo: "Sugestão forte", tom: "info", acao: "Conciliar com encargos" },
  multi: { selo: "Sugestão forte", tom: "info", acao: "Conciliar com as parcelas" },
  parcial: { selo: "Sugestão forte", tom: "info", acao: "Conciliar como parcial" },
  transf: { selo: "Transferência detectada", tom: "roxo", acao: "Registrar transferência" },
  regra: { selo: "Regra aprendida", tom: "roxo", acao: "Criar e conciliar" },
  media: { selo: "Sugestão", tom: "atencao", acao: "Conciliar com a escolhida" },
  classif: { selo: "Nada encontrado", tom: "ruim", acao: "Classificar e conciliar" },
};
