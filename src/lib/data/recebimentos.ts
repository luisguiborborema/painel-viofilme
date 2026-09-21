/**
 * Recebimentos — as regras da página 2.
 *
 * Aqui mora o que a spec descreve em tabelas de prioridade: o chip de
 * situação (§4.4), a linha da cobrança (§4.5), a régua (§9.2), o perfil
 * pagador (§10.3) e os encargos por atraso (§6.2).
 *
 * Tudo puro e testável. São regras que erram calado — um perfil pagador
 * errado muda como a agência trata o cliente, e ninguém vai conferir a conta.
 *
 * Centavos inteiros; datas "AAAA-MM-DD" no fuso de São Paulo.
 */

import { diasEntre } from "./dashboard-financeiro.ts";
import type { StatusParcela } from "./pagamentos.ts";

/* ── Chip de situação (§4.4) ───────────────────────────────────────────── */

export type SituacaoReceber =
  | "a_vencer" | "vence_em_dias" | "vence_hoje" | "vencida"
  | "parcial" | "parcial_vencida" | "recebida" | "encerrada";

export type ParcelaReceber = {
  status: StatusParcela;
  dueDateIso: string;
  saldoCent: number;
  valorCent: number;
};

/**
 * A ordem é a da spec, e a combinação parcial × vencida é explícita.
 *
 * "Parcial" e "vencida" não são alternativas: uma parcela pode ser as duas, e
 * mostrar só "parcial" esconderia o atraso — que é o que decide a cobrança.
 */
export function chipDeRecebimento(p: ParcelaReceber, hojeIso: string): SituacaoReceber {
  if (p.status === "cancelled" || p.status === "renegotiated") return "encerrada";
  if (p.status === "settled") return "recebida";

  const vencida = p.dueDateIso < hojeIso && p.saldoCent > 0;
  const parcial = p.status === "partial";
  if (parcial) return vencida ? "parcial_vencida" : "parcial";
  if (vencida) return "vencida";

  const dias = diasEntre(hojeIso, p.dueDateIso);
  if (dias === 0) return "vence_hoje";
  return dias <= 7 ? "vence_em_dias" : "a_vencer";
}

export const SITUACAO_RECEBER_TOM: Record<SituacaoReceber, "ok" | "ruim" | "atencao" | "info" | "neutro"> = {
  a_vencer: "neutro",
  vence_em_dias: "info",
  vence_hoje: "atencao",
  vencida: "ruim",
  parcial: "atencao",
  parcial_vencida: "ruim",
  recebida: "ok",
  encerrada: "neutro",
};

export function rotuloDeRecebimento(
  s: SituacaoReceber,
  p: ParcelaReceber,
  hojeIso: string,
): string {
  const atraso = diasEntre(p.dueDateIso, hojeIso);
  const faltam = diasEntre(hojeIso, p.dueDateIso);
  const dia = (n: number) => `${n} ${n === 1 ? "dia" : "dias"}`;
  switch (s) {
    case "vencida": return `Vencida há ${dia(atraso)}`;
    case "parcial_vencida": return `Parcial, vencida há ${dia(atraso)}`;
    case "vence_em_dias": return `Vence em ${dia(faltam)}`;
    case "vence_hoje": return "Vence hoje";
    case "parcial": return "Parcial";
    case "recebida": return "Recebida";
    case "encerrada": return "Encerrada";
    default: return "A vencer";
  }
}

/* ── Linha da cobrança (§4.5) ──────────────────────────────────────────── */

export type LinhaCobranca = { texto: string; tom: "ok" | "ruim" | "atencao" | "info" | "neutro" };

export type EstadoDaCobranca = {
  /** Existe `charge` ativa? */
  temCobranca: boolean;
  enviadaEm: string | null;
  visualizadaEm: string | null;
  falhou: boolean;
  falhaMotivo?: string | null;
  /** Envio automático programado para… */
  envioProgramadoPara: string | null;
  /** A forma de cobrança é via sistema (Asaas)? */
  viaSistema: boolean;
  recebida: boolean;
  confirmadaNoExtrato: boolean;
};

const ddmm = (iso: string) => {
  const [, m, d] = iso.split("-");
  return d && m ? `${d}/${m}` : iso;
};

/**
 * A situação da cobrança é um eixo SEPARADO da situação financeira: uma
 * parcela pode "vencer em 3 dias" com a cobrança "não visualizada". Misturar
 * os dois num chip só esconderia metade do problema.
 */
export function linhaDaCobranca(e: EstadoDaCobranca): LinhaCobranca {
  if (e.recebida) {
    return e.confirmadaNoExtrato
      ? { texto: "Confirmada no extrato", tom: "ok" }
      : { texto: "Aguardando extrato", tom: "neutro" };
  }
  if (e.falhou) {
    return { texto: e.falhaMotivo ? `Falha no envio: ${e.falhaMotivo}` : "Falha no envio", tom: "ruim" };
  }
  if (e.visualizadaEm) return { texto: "Visualizada pelo cliente", tom: "ok" };
  if (e.enviadaEm) return { texto: `Cobrança enviada em ${ddmm(e.enviadaEm)}`, tom: "info" };
  // Cobrança que existe mas não tem data de envio: dizer "enviada em" com a
  // data de criação do registro seria inventar o dia em que o cliente foi
  // avisado — e é justamente esse dia que decide se cabe cobrar de novo.
  if (e.temCobranca) return { texto: "Cobrança emitida", tom: "info" };
  if (e.envioProgramadoPara) {
    return { texto: `Envio automático em ${ddmm(e.envioProgramadoPara)}`, tom: "neutro" };
  }
  // "Sem cobrança" só faz sentido quando alguém esperava uma: numa cobrança
  // manual por transferência, não há o que emitir.
  if (!e.temCobranca && e.viaSistema) return { texto: "Sem cobrança", tom: "atencao" };
  return { texto: "Cobrança manual", tom: "neutro" };
}

/* ── Ação contextual da linha (§4.6) ───────────────────────────────────── */

export type AcaoReceber = "enviar_cobranca" | "registrar" | "comprovante";

export const ACAO_RECEBER_LABEL: Record<AcaoReceber, string> = {
  enviar_cobranca: "Enviar cobrança",
  registrar: "Registrar",
  comprovante: "Comprovante",
};

export function acaoDeRecebimento(c: {
  recebida: boolean;
  temCobranca: boolean;
  viaSistema: boolean;
}): AcaoReceber {
  if (c.recebida) return "comprovante";
  return !c.temCobranca && c.viaSistema ? "enviar_cobranca" : "registrar";
}

/* ── Encargos por atraso (§6.2) ────────────────────────────────────────── */

export type Encargos = {
  diasAtraso: number;
  multaCent: number;
  jurosCent: number;
  totalCent: number;
  atualizadoCent: number;
  detalhe: string | null;
};

export const MULTA_PADRAO_PCT = 2;
export const JUROS_PADRAO_MES_PCT = 1;

/**
 * Multa fixa + juros pro rata die, como o §6.2 define.
 *
 * Juros por dia (taxa mensal ÷ 30) é o critério que banco usa e que o
 * contrato descreve por "1% ao mês". Cobrar o mês cheio no primeiro dia de
 * atraso seria outra coisa, e o cliente perceberia.
 */
export function calcularEncargosReceber(
  saldoCent: number,
  vencimentoIso: string,
  hojeIso: string,
  opts: { multaPct?: number; jurosMesPct?: number } = {},
): Encargos {
  const multaPct = opts.multaPct ?? MULTA_PADRAO_PCT;
  const jurosPct = opts.jurosMesPct ?? JUROS_PADRAO_MES_PCT;
  const dias = diasEntre(vencimentoIso, hojeIso);

  if (dias <= 0 || saldoCent <= 0) {
    return { diasAtraso: Math.max(0, dias), multaCent: 0, jurosCent: 0, totalCent: 0,
      atualizadoCent: saldoCent, detalhe: null };
  }
  const multaCent = Math.round(saldoCent * (multaPct / 100));
  const jurosCent = Math.round(saldoCent * (jurosPct / 100 / 30) * dias);
  const totalCent = multaCent + jurosCent;
  const partes = [
    multaCent > 0 && `multa de ${multaPct}%`,
    jurosCent > 0 && `juros de ${jurosPct}% ao mês por ${dias} ${dias === 1 ? "dia" : "dias"}`,
  ].filter(Boolean);

  return {
    diasAtraso: dias, multaCent, jurosCent, totalCent,
    atualizadoCent: saldoCent + totalCent,
    detalhe: partes.length ? partes.join(" + ") : null,
  };
}

/** Motivos aceitos para dispensar encargos (§15). A escolha é obrigatória. */
export const MOTIVOS_DISPENSA = [
  { key: "acordo", label: "Acordo com cliente" },
  { key: "atraso_nosso", label: "Atraso nosso" },
  { key: "cortesia", label: "Cortesia" },
];

/**
 * Valor com centavos, para texto que sai da empresa.
 *
 * Na tela, arredondar para reais inteiros ajuda a comparar. Numa mensagem de
 * cobrança, não: o cliente confere contra o boleto, e R$ 16 no lugar de
 * R$ 15,74 é um erro que ele responde perguntando quanto afinal deve.
 */
export function brlExato(cent: number): string {
  return (Math.round(cent) / 100).toLocaleString("pt-BR", {
    style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

/* ── Régua de cobrança (§9.2) ──────────────────────────────────────────── */

export type EtapaRegua = {
  offsetDias: number;
  acao: string;
  modo: "automatic" | "manual" | "task";
  canal?: string | null;
};

export type EstadoRegua = {
  etapaAtual: EtapaRegua | null;
  proximaEtapa: EtapaRegua | null;
  pausada: boolean;
  motivoPausa: string | null;
  frase: string;
};

/**
 * Em que etapa da régua está esta parcela — DERIVADO, nunca gravado (§14.5).
 *
 * Estado de cobrança gravado envelhece sozinho: a parcela que estava em "D+3"
 * ontem está em "D+10" hoje sem ninguém tocar nela, e um campo no banco
 * continuaria dizendo D+3 até o job rodar.
 */
export function estadoDaRegua(input: {
  etapas: EtapaRegua[];
  diasAtraso: number;
  recebida: boolean;
  promessaAte: string | null;
  pausadaAte: string | null;
  motivoPausa?: string | null;
  hojeIso: string;
  envioProgramadoPara?: string | null;
  cobrancaEnviada?: boolean;
}): EstadoRegua {
  if (input.recebida) {
    return { etapaAtual: null, proximaEtapa: null, pausada: false, motivoPausa: null,
      frase: "Régua encerrada: parcela recebida." };
  }
  // Promessa e pausa têm prioridade sobre qualquer etapa: foi uma decisão
  // humana de não cobrar agora, e a régua não pode atropelá-la.
  if (input.promessaAte && input.promessaAte >= input.hojeIso) {
    return { etapaAtual: null, proximaEtapa: null, pausada: true, motivoPausa: null,
      frase: `Régua pausada: promessa de pagamento para ${ddmm(input.promessaAte)}.` };
  }
  if (input.pausadaAte && input.pausadaAte >= input.hojeIso) {
    return {
      etapaAtual: null, proximaEtapa: null, pausada: true,
      motivoPausa: input.motivoPausa ?? null,
      frase: `Régua pausada até ${ddmm(input.pausadaAte)}${input.motivoPausa ? `: ${input.motivoPausa}` : "."}`,
    };
  }

  const ordenadas = [...input.etapas].sort((a, b) => a.offsetDias - b.offsetDias);
  const atual = [...ordenadas].reverse().find((e) => input.diasAtraso >= e.offsetDias) ?? null;
  const proxima = ordenadas.find((e) => e.offsetDias > input.diasAtraso) ?? null;

  if (input.diasAtraso < 0) {
    if (input.cobrancaEnviada) {
      return { etapaAtual: atual, proximaEtapa: proxima, pausada: false, motivoPausa: null,
        frase: "Próximo passo: lembrete por e-mail no dia do vencimento (D+0)." };
    }
    if (input.envioProgramadoPara) {
      return { etapaAtual: null, proximaEtapa: proxima, pausada: false, motivoPausa: null,
        frase: `Envio automático programado para ${ddmm(input.envioProgramadoPara)}.` };
    }
    return { etapaAtual: null, proximaEtapa: proxima, pausada: false, motivoPausa: null,
      frase: "Sem cobrança emitida. O envio automático não está programado para esta parcela." };
  }

  const nome = (e: EtapaRegua) => `D${e.offsetDias >= 0 ? "+" : ""}${e.offsetDias}`;
  // A ação vem como a régua foi cadastrada e é usada como veio: minúsculas
  // transformariam "WhatsApp" em "whatsapp" na frase que a operação lê.
  const frase = atual
    ? `Etapa atual: ${nome(atual)}, ${atual.acao}.` +
      (proxima ? ` Próximo: ${proxima.acao} no ${nome(proxima)}.` : "")
    : "Sem etapa aplicável.";
  return { etapaAtual: atual, proximaEtapa: proxima, pausada: false, motivoPausa: null, frase };
}

/* ── Perfil pagador (§10.3) ────────────────────────────────────────────── */

export type PerfilPagador = "pontual" | "as_vezes" | "frequente" | "sem_historico";

export const PERFIL_LABEL: Record<PerfilPagador, string> = {
  pontual: "Pontual",
  as_vezes: "Atrasa às vezes",
  frequente: "Atrasa com frequência",
  sem_historico: "Sem histórico",
};

export const PERFIL_TOM: Record<PerfilPagador, "ok" | "atencao" | "ruim" | "neutro"> = {
  pontual: "ok", as_vezes: "atencao", frequente: "ruim", sem_historico: "neutro",
};

export const LIMITES_PERFIL = { pontual: 90, asVezes: 70 };
export const MINIMO_PARA_PERFIL = 3;

/**
 * Perfil pagador, sobre as parcelas liquidadas nos últimos 12 meses.
 *
 * A conta é por VALOR, não por quantidade: dez boletos pequenos pagos no dia
 * não compensam a mensalidade inteira atrasada todo mês. E duas promessas
 * quebradas derrubam o perfil independentemente do percentual — quem promete
 * e não cumpre já mostrou o comportamento que o número ainda não pegou.
 */
export function perfilPagador(input: {
  liquidadas: { vencimentoIso: string; pagamentoIso: string; valorCent: number }[];
  promessasQuebradas: number;
}): { perfil: PerfilPagador; pctEmDia: number | null } {
  const { liquidadas, promessasQuebradas } = input;
  if (liquidadas.length < MINIMO_PARA_PERFIL) {
    return { perfil: "sem_historico", pctEmDia: null };
  }
  const total = liquidadas.reduce((s, l) => s + l.valorCent, 0);
  if (total <= 0) return { perfil: "sem_historico", pctEmDia: null };

  const emDia = liquidadas
    .filter((l) => l.pagamentoIso <= l.vencimentoIso)
    .reduce((s, l) => s + l.valorCent, 0);
  const pct = Math.round((emDia / total) * 1000) / 10;

  if (promessasQuebradas >= 2) return { perfil: "frequente", pctEmDia: pct };
  if (pct >= LIMITES_PERFIL.pontual) return { perfil: "pontual", pctEmDia: pct };
  if (pct >= LIMITES_PERFIL.asVezes) return { perfil: "as_vezes", pctEmDia: pct };
  return { perfil: "frequente", pctEmDia: pct };
}

/* ── Recebimento em lote (§4.7) ────────────────────────────────────────── */

/**
 * Recebimento em lote só vale para parcelas do MESMO cliente.
 *
 * Diferente de Pagamentos, onde "paguei tudo de hoje" é rotina: aqui um
 * recebimento é de alguém, e somar clientes diferentes numa baixa só
 * produziria um valor que não corresponde a nenhum depósito.
 */
export function podeReceberEmLote(
  parcelas: { clienteId: string | null }[],
): { pode: boolean; motivo: string | null } {
  if (!parcelas.length) return { pode: false, motivo: "Nenhuma parcela selecionada." };
  const clientes = new Set(parcelas.map((p) => p.clienteId ?? "sem-cliente"));
  if (clientes.size > 1) {
    return { pode: false, motivo: "Recebimento em lote só para parcelas do mesmo cliente." };
  }
  return { pode: true, motivo: null };
}

/* ── Cadastro mínimo vs. completo (§10.4) ──────────────────────────────── */

export type FormaCobranca = "asaas_boleto_pix" | "asaas_pix" | "manual" | "sem_cobranca";

/**
 * O que falta no cadastro para a forma escolhida funcionar.
 *
 * Só é bloqueado o que DEPENDE do dado faltante: sem CNPJ não sai boleto, mas
 * a parcela existe, entra no caixa e é cobrada por outro caminho. Bloquear
 * tudo por um campo ausente é como o sistema antigo empurrava a operação para
 * a planilha.
 */
export function pendenciasDoCadastro(
  cliente: { documento?: string | null; endereco?: unknown; emailsCobranca?: string[] },
  forma: FormaCobranca,
  envioAutomatico: boolean,
): string[] {
  const faltas: string[] = [];
  const temDoc = Boolean(String(cliente.documento ?? "").replace(/\D/g, ""));
  const temEndereco = Boolean(cliente.endereco);
  const temEmail = Boolean(cliente.emailsCobranca?.length);

  if (forma === "asaas_boleto_pix") {
    if (!temDoc) faltas.push("CPF ou CNPJ, exigido para boleto");
    if (!temEndereco) faltas.push("endereço, exigido para boleto");
  }
  if (forma === "asaas_pix" && !temDoc) faltas.push("CPF ou CNPJ, exigido para PIX via Asaas");
  if (envioAutomatico && !temEmail) faltas.push("e-mail de cobrança, exigido para o envio automático");
  return faltas;
}

/* ── Divisão de parcelas no cadastro (§7.5) ────────────────────────────── */

/**
 * Divide em N parcelas iguais; a ÚLTIMA absorve o arredondamento.
 *
 * Aqui a sobra vai para a última, e não para a primeira como em Pagamentos:
 * o cliente recebe o carnê inteiro de uma vez e compara as parcelas entre si.
 * Uma primeira diferente chama atenção; uma última diferente é esperada.
 */
export function dividirParcelas(totalCent: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(totalCent / n);
  const partes = Array.from({ length: n }, () => base);
  partes[n - 1] += totalCent - base * n;
  return partes;
}

/** Vencimento da parcela i, respeitando meses curtos (§18). */
export function vencimentoDaParcela(primeiroIso: string, i: number, mensal = true): string {
  const [a, m, d] = primeiroIso.split("-").map(Number);
  if (!mensal) {
    const base = new Date(Date.UTC(a, m - 1, d));
    base.setUTCDate(base.getUTCDate() + i * 15);
    return base.toISOString().slice(0, 10);
  }
  // Dia 31 em mês de 30 vira o último dia — não escorrega para o mês seguinte.
  const alvo = new Date(Date.UTC(a, m - 1 + i, 1));
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimoDia));
  return alvo.toISOString().slice(0, 10);
}
