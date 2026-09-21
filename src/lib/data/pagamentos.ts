/**
 * Pagamentos — regras da página 3 e as invariantes do núcleo transacional.
 *
 * Este módulo é puro e client-safe de propósito: são as contas que o
 * documento-mãe chama de invariantes (§23) e que a spec descreve em tabelas de
 * prioridade (§5.4, §5.5, §5.6). Todas erram calado — um chip na ordem errada
 * não quebra nada, só mostra "A vencer" numa conta vencida.
 *
 * Valores em CENTAVOS inteiros (§24). Datas "AAAA-MM-DD" no fuso de São Paulo.
 */

import { diasEntre, somarDias } from "./dashboard-financeiro.ts";

/* ── Parcela: status e saldo (§7.1, §23.4) ─────────────────────────────── */

export type StatusParcela = "open" | "partial" | "settled" | "cancelled" | "renegotiated";
export type StatusAprovacao = "not_required" | "pending" | "approved" | "rejected";
export type StatusValor = "estimated" | "confirmed";

export type Baixa = {
  principalCent: number;
  /** Estornada não conta mais — mas continua existindo (§23.7). */
  estornada?: boolean;
};

/**
 * Saldo da parcela = valor − Σ principal das baixas não estornadas.
 *
 * Nunca negativo (§23.4): pagar a mais não vira saldo negativo, vira encargo.
 * Só o PRINCIPAL abate — juros, multa e desconto têm destino próprio no
 * resultado financeiro, e somá-los aqui apagaria a dívida com dinheiro que
 * não foi para ela.
 */
export function saldoDaParcela(valorCent: number, baixas: Baixa[]): number {
  const pago = baixas
    .filter((b) => !b.estornada)
    .reduce((s, b) => s + b.principalCent, 0);
  return Math.max(0, valorCent - Math.min(pago, valorCent));
}

/** O status armazenado que corresponde ao saldo (§7.1). */
export function statusDaParcela(
  valorCent: number,
  baixas: Baixa[],
  statusAtual: StatusParcela = "open",
): StatusParcela {
  // Cancelada e renegociada são decisões humanas: nenhuma baixa as desfaz.
  if (statusAtual === "cancelled" || statusAtual === "renegotiated") return statusAtual;
  const saldo = saldoDaParcela(valorCent, baixas);
  if (saldo === 0) return "settled";
  return saldo < valorCent ? "partial" : "open";
}

/** Status do título, derivado das parcelas (§7.4). Nunca é gravado. */
export function statusDoTitulo(
  parcelas: { status: StatusParcela }[],
): "settled" | "partial" | "open" | "cancelled" | "empty" {
  if (!parcelas.length) return "empty";
  if (parcelas.every((p) => p.status === "cancelled")) return "cancelled";
  const vivas = parcelas.filter((p) => p.status !== "cancelled");
  if (!vivas.length) return "cancelled";
  if (vivas.every((p) => p.status === "settled")) return "settled";
  if (vivas.some((p) => p.status === "settled" || p.status === "partial")) return "partial";
  return "open";
}

/* ── Invariantes de soma (§23.3) ───────────────────────────────────────── */

/** A soma dos itens tem de ser o valor do título. Divergência é bug, não arredondamento. */
export function itensFechamComTitulo(itensCent: number[], totalCent: number): boolean {
  return itensCent.reduce((s, v) => s + v, 0) === totalCent;
}

export function parcelasFechamComTitulo(parcelasCent: number[], totalCent: number): boolean {
  return parcelasCent.reduce((s, v) => s + v, 0) === totalCent;
}

/**
 * Reparte um valor em N partes que SOMAM o total.
 *
 * O resto vai para a primeira parcela, não para a última: quem paga a
 * primeira é quem já está com o boleto na mão, e diferença de centavo no fim
 * costuma aparecer quando ninguém mais está olhando.
 */
export function repartir(totalCent: number, partes: number): number[] {
  if (partes <= 0) return [];
  const base = Math.floor(totalCent / partes);
  const resto = totalCent - base * partes;
  return Array.from({ length: partes }, (_, i) => base + (i === 0 ? resto : 0));
}

/* ── Chip de situação (spec §5.4) ──────────────────────────────────────── */

export type Situacao =
  | "paga" | "vencida" | "aguardando_aprovacao" | "estimada"
  | "programada" | "vence_hoje" | "vence_em_breve" | "a_vencer"
  | "parcial" | "cancelada";

export type ParcelaParaChip = {
  status: StatusParcela;
  dueDateIso: string;
  saldoCent: number;
  aprovacao: StatusAprovacao;
  valorStatus: StatusValor;
  programadaParaIso: string | null;
};

/**
 * A ordem importa e é a da spec.
 *
 * Vencida vem antes de aprovação e de estimada de propósito: a conta que já
 * passou do prazo é a que muda a decisão do dia, e dizer "~ Estimada" numa
 * conta vencida esconde o atraso atrás de um detalhe de cadastro.
 */
export function chipDeSituacao(p: ParcelaParaChip, hojeIso: string): Situacao {
  if (p.status === "cancelled" || p.status === "renegotiated") return "cancelada";
  if (p.status === "settled") return "paga";
  if (p.dueDateIso < hojeIso && p.saldoCent > 0) return "vencida";
  if (p.aprovacao === "pending") return "aguardando_aprovacao";
  if (p.status === "partial") return "parcial";
  if (p.valorStatus === "estimated") return "estimada";
  if (p.programadaParaIso) return "programada";
  const dias = diasEntre(hojeIso, p.dueDateIso);
  if (dias === 0) return "vence_hoje";
  return dias <= 7 ? "vence_em_breve" : "a_vencer";
}

export const SITUACAO_LABEL: Record<Situacao, string> = {
  paga: "Paga",
  vencida: "Vencida",
  aguardando_aprovacao: "Aguardando aprovação",
  estimada: "~ Estimada",
  programada: "Programada",
  vence_hoje: "Vence hoje",
  vence_em_breve: "Vence em breve",
  a_vencer: "A vencer",
  parcial: "Parcial",
  cancelada: "Cancelada",
};

export const SITUACAO_TOM: Record<Situacao, "ok" | "ruim" | "atencao" | "info" | "neutro" | "roxo"> = {
  paga: "ok",
  vencida: "ruim",
  aguardando_aprovacao: "roxo",
  estimada: "neutro",
  programada: "info",
  vence_hoje: "atencao",
  vence_em_breve: "atencao",
  a_vencer: "neutro",
  parcial: "atencao",
  cancelada: "neutro",
};

/** "Vencida há 3 dias", "Vence em 5 dias", "Paga em 12/09". */
export function rotuloDaSituacao(s: Situacao, p: ParcelaParaChip, hojeIso: string): string {
  if (s === "vencida") {
    const d = diasEntre(p.dueDateIso, hojeIso);
    return `Vencida há ${d} ${d === 1 ? "dia" : "dias"}`;
  }
  if (s === "programada" && p.programadaParaIso) {
    const [, m, dia] = p.programadaParaIso.split("-");
    return `Programada para ${dia}/${m}`;
  }
  if (s === "vence_em_breve") {
    const d = diasEntre(hojeIso, p.dueDateIso);
    return `Vence em ${d} ${d === 1 ? "dia" : "dias"}`;
  }
  return SITUACAO_LABEL[s];
}

/* ── Linha de pagamento (spec §5.5) ────────────────────────────────────── */

export type LinhaPagamento = { texto: string; tom: "neutro" | "atencao" | "ruim" | "ok" };

export type DadosDePagamento = {
  method?: string | null;
  barcode?: string | null;
  pixKey?: string | null;
  payeeName?: string | null;
  payeeDocument?: string | null;
} | null;

export type ContextoLinha = {
  detalhes: DadosDePagamento;
  debitoAutomatico: boolean;
  estimada: boolean;
  paga: boolean;
  temComprovante: boolean;
  exigeNota: boolean;
  temNota: boolean;
  favorecidoDivergente: boolean;
};

/**
 * A segunda linha da coluna Situação: o que falta para conseguir pagar.
 *
 * "NF pendente" tem prioridade sobre tudo porque é bloqueio de processo — os
 * outros textos informam, esse impede.
 */
export function linhaDePagamento(c: ContextoLinha): LinhaPagamento {
  if (c.paga) {
    return c.temComprovante
      ? { texto: "Comprovante anexado", tom: "ok" }
      : { texto: "Sem comprovante", tom: "atencao" };
  }
  if (c.exigeNota && !c.temNota) {
    return { texto: "NF pendente, exigida para pagar", tom: "atencao" };
  }
  if (c.favorecidoDivergente) {
    return { texto: "Boleto, favorecido diferente", tom: "ruim" };
  }
  if (c.debitoAutomatico) return { texto: "Débito automático", tom: "neutro" };
  if (c.estimada && !c.detalhes?.barcode) {
    return { texto: "Guia ainda não emitida", tom: "atencao" };
  }
  if (!c.detalhes || (!c.detalhes.barcode && !c.detalhes.pixKey)) {
    return { texto: "Sem dados de pagamento", tom: "atencao" };
  }
  if (c.detalhes.barcode) return { texto: "Boleto, código salvo", tom: "neutro" };
  return { texto: "PIX, chave do fornecedor", tom: "neutro" };
}

/**
 * Favorecido divergente (spec §7.3): compara o que foi lido do boleto com o
 * cadastro do fornecedor. Documento manda; nome só vale quando não há
 * documento dos dois lados.
 *
 * Não bloqueia — há intermediadoras legítimas —, mas avisa e fica na auditoria.
 */
export function favorecidoDivergente(
  lido: { nome?: string | null; documento?: string | null } | null,
  fornecedor: { nome: string; documento?: string | null },
): boolean {
  if (!lido) return false;
  const soDigitos = (v?: string | null) => String(v ?? "").replace(/\D/g, "");
  const docLido = soDigitos(lido.documento);
  const docForn = soDigitos(fornecedor.documento);
  if (docLido && docForn) return docLido !== docForn;

  const normal = (v?: string | null) =>
    String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const nomeLido = normal(lido.nome);
  if (!nomeLido) return false;
  const nomeForn = normal(fornecedor.nome);
  // Um contém o outro basta: "Adobe" e "Adobe Systems Brasil" são o mesmo.
  return !(nomeLido.includes(nomeForn) || nomeForn.includes(nomeLido));
}

/* ── Ação contextual da linha (spec §5.6) ──────────────────────────────── */

export type AcaoLinha =
  | "abrir_folha" | "ver_fatura" | "aprovar" | "informar_valor"
  | "confirmar_debito" | "pagar" | "comprovante";

export const ACAO_LABEL: Record<AcaoLinha, string> = {
  abrir_folha: "Abrir folha",
  ver_fatura: "Ver fatura",
  aprovar: "Aprovar",
  informar_valor: "Informar valor",
  confirmar_debito: "Confirmar débito",
  pagar: "Pagar",
  comprovante: "Comprovante",
};

export function acaoDaLinha(c: {
  especial?: "folha" | "fatura" | null;
  aprovacao: StatusAprovacao;
  estimada: boolean;
  debitoAutomatico: boolean;
  paga: boolean;
}): AcaoLinha {
  if (c.especial === "folha") return "abrir_folha";
  if (c.especial === "fatura") return "ver_fatura";
  if (c.paga) return "comprovante";
  if (c.aprovacao === "pending") return "aprovar";
  // Estimada antes de débito automático: sem valor real não dá para conferir
  // se o que foi debitado está certo.
  if (c.estimada) return "informar_valor";
  if (c.debitoAutomatico) return "confirmar_debito";
  return "pagar";
}

/* ── Valor estimado (spec §2.1 e §9) ───────────────────────────────────── */

export type MetodoEstimativa = "fixed" | "last" | "avg3" | "revenue_pct";

export const METODO_LABEL: Record<MetodoEstimativa, string> = {
  fixed: "valor fixo",
  last: "último valor pago",
  avg3: "média dos 3 últimos",
  revenue_pct: "% da receita",
};

/**
 * Estima o valor de uma parcela que ainda não tem guia.
 *
 * Sem histórico suficiente, cai no valor fixo da recorrência: estimar com um
 * mês só e chamar de "média" seria dar ao número uma confiança que ele não tem.
 */
export function estimarValor(input: {
  metodo: MetodoEstimativa;
  valorFixoCent: number;
  ultimosPagosCent: number[];
  receitaBaseCent?: number;
  aliquotaPct?: number;
}): number {
  const { metodo, valorFixoCent, ultimosPagosCent } = input;
  if (metodo === "last") return ultimosPagosCent[0] ?? valorFixoCent;
  if (metodo === "avg3") {
    const tres = ultimosPagosCent.slice(0, 3);
    if (tres.length < 3) return ultimosPagosCent[0] ?? valorFixoCent;
    return Math.round(tres.reduce((s, v) => s + v, 0) / tres.length);
  }
  if (metodo === "revenue_pct") {
    const base = input.receitaBaseCent ?? 0;
    const aliq = input.aliquotaPct ?? 0;
    if (base <= 0 || aliq <= 0) return valorFixoCent;
    return Math.round(base * (aliq / 100));
  }
  return valorFixoCent;
}

/** Limite padrão a partir do qual vale revisar o método (§21). */
export const LIMITE_DIFERENCA_ESTIMATIVA_PCT = 20;

export function diferencaDoEstimado(
  estimadoCent: number,
  realCent: number,
): { pct: number | null; revisar: boolean } {
  if (estimadoCent <= 0) return { pct: null, revisar: false };
  const pct = Math.round(((realCent - estimadoCent) / estimadoCent) * 1000) / 10;
  return { pct, revisar: Math.abs(pct) > LIMITE_DIFERENCA_ESTIMATIVA_PCT };
}

/* ── Cobertura dos próximos 7 dias (spec §4.1) ─────────────────────────── */

export type Cobertura =
  | { coberto: true; saldoMinimoCent: number }
  | { coberto: false; faltaCent: number; dataIso: string };

/**
 * Compara, dia a dia, o saldo projetado com o que há para pagar.
 *
 * Responde "eu consigo pagar isso?" — a pergunta que o total dos próximos 7
 * dias sozinho não responde: R$ 20 mil a pagar é tranquilo com R$ 80 mil em
 * caixa e é um problema com R$ 15 mil.
 *
 * Nunca bloqueia nada; é indicador.
 */
export function coberturaDosProximos7(
  projecao: { dataIso: string; saldoCent: number }[],
  hojeIso: string,
): Cobertura {
  const ate = somarDias(hojeIso, 7);
  const janela = projecao.filter((p) => p.dataIso >= hojeIso && p.dataIso <= ate);
  if (!janela.length) return { coberto: true, saldoMinimoCent: 0 };

  let pior: { dataIso: string; saldoCent: number } | null = null;
  for (const p of janela) {
    if (!pior || p.saldoCent < pior.saldoCent) pior = p;
  }
  if (pior && pior.saldoCent < 0) {
    return { coberto: false, faltaCent: Math.abs(pior.saldoCent), dataIso: pior.dataIso };
  }
  return { coberto: true, saldoMinimoCent: pior?.saldoCent ?? 0 };
}

/* ── Pagamento: o que fazer com a diferença (spec §8) ──────────────────── */

export type ResultadoDaBaixa = {
  principalCent: number;
  jurosCent: number;
  multaCent: number;
  descontoCent: number;
  saldoRestanteCent: number;
};

/**
 * Reparte o valor pago entre principal e encargos.
 *
 * Três regras da spec, todas com o mesmo motivo: **a categoria original
 * precisa ficar com o valor cheio**. Se o desconto abatesse a categoria, o
 * orçamento passaria a parecer cumprido por causa de uma negociação, e não
 * por causa de gasto menor.
 *
 *  • pagou menos e quitou → a diferença é DESCONTO (receita financeira);
 *  • pagou menos e não quitou → baixa parcial, saldo segue em aberto;
 *  • pagou mais → a diferença é encargo (juros/multa informados).
 */
export function repartirPagamento(input: {
  saldoCent: number;
  valorPagoCent: number;
  quitar: boolean;
  jurosInformadoCent?: number;
  multaInformadaCent?: number;
}): ResultadoDaBaixa {
  const { saldoCent, valorPagoCent, quitar } = input;
  const juros = Math.max(0, input.jurosInformadoCent ?? 0);
  const multa = Math.max(0, input.multaInformadaCent ?? 0);
  const encargos = juros + multa;

  // O que foi para a dívida é o pago menos o que foi para encargos.
  const paraPrincipal = Math.max(0, valorPagoCent - encargos);

  if (paraPrincipal >= saldoCent) {
    return {
      principalCent: saldoCent,
      jurosCent: juros,
      multaCent: multa,
      // Sobrou depois de quitar e de pagar encargos: é encargo não informado.
      descontoCent: 0,
      saldoRestanteCent: 0,
    };
  }
  if (quitar) {
    return {
      principalCent: paraPrincipal,
      jurosCent: juros,
      multaCent: multa,
      descontoCent: saldoCent - paraPrincipal,
      saldoRestanteCent: 0,
    };
  }
  return {
    principalCent: paraPrincipal,
    jurosCent: juros,
    multaCent: multa,
    descontoCent: 0,
    saldoRestanteCent: saldoCent - paraPrincipal,
  };
}

/* ── Cartão de crédito (spec §6.1) ─────────────────────────────────────── */

/**
 * Em que fatura uma compra cai.
 *
 * Comprou depois do fechamento, entra na próxima (§23). O vencimento é no mês
 * seguinte ao fechamento quando o dia de vencimento é menor que o de
 * fechamento — que é o caso comum (fecha dia 18, vence dia 25 do mesmo mês;
 * fecha dia 28, vence dia 5 do mês seguinte).
 */
export function faturaDaCompra(
  compraIso: string,
  diaFechamento: number,
  diaVencimento: number,
): { fechamentoIso: string; vencimentoIso: string } {
  const [ano, mes, dia] = compraIso.split("-").map(Number);
  // Depois do fechamento, o ciclo é o do mês seguinte.
  const deslocamento = dia > diaFechamento ? 1 : 0;
  const fechamento = new Date(Date.UTC(ano, mes - 1 + deslocamento, diaFechamento));
  const mesVenc = diaVencimento > diaFechamento
    ? mes - 1 + deslocamento
    : mes + deslocamento;
  const vencimento = new Date(Date.UTC(ano, mesVenc, diaVencimento));
  return {
    fechamentoIso: fechamento.toISOString().slice(0, 10),
    vencimentoIso: vencimento.toISOString().slice(0, 10),
  };
}

/* ── Lote (spec §5.8) ──────────────────────────────────────────────────── */

export type MotivoForaDoLote = "estimada" | "nota_pendente" | "aguardando_aprovacao" | "ja_paga";

export const MOTIVO_LOTE_LABEL: Record<MotivoForaDoLote, string> = {
  estimada: "valor ainda estimado",
  nota_pendente: "NF exigida e ausente",
  aguardando_aprovacao: "aguardando aprovação",
  ja_paga: "já paga",
};

/**
 * Quem pode entrar no pagamento em lote.
 *
 * Fornecedores diferentes são permitidos de propósito ("paguei tudo de hoje").
 * O que fica de fora é o que não pode ser pago sem uma decisão individual —
 * e a tela diz quantas e por quê, em vez de pagar a mais ou pagar errado.
 */
export function separarLote<T extends {
  estimada: boolean;
  exigeNota: boolean;
  temNota: boolean;
  aprovacao: StatusAprovacao;
  paga: boolean;
}>(itens: T[]): { dentro: T[]; fora: { item: T; motivo: MotivoForaDoLote }[] } {
  const dentro: T[] = [];
  const fora: { item: T; motivo: MotivoForaDoLote }[] = [];
  for (const i of itens) {
    if (i.paga) fora.push({ item: i, motivo: "ja_paga" });
    else if (i.aprovacao === "pending") fora.push({ item: i, motivo: "aguardando_aprovacao" });
    else if (i.estimada) fora.push({ item: i, motivo: "estimada" });
    else if (i.exigeNota && !i.temNota) fora.push({ item: i, motivo: "nota_pendente" });
    else dentro.push(i);
  }
  return { dentro, fora };
}
