/**
 * Caixa — o dinheiro que se moveu, o que vai se mover e se bate com o banco.
 *
 * A página tem duas naturezas, e as regras aqui refletem as duas:
 *
 * **Gerencial:** todo movimento cai num BLOCO (operacional, investimento,
 * sócios, entre contas). "O caixa caiu R$ 60 mil" tem significados opostos se
 * foi operação, compra de equipamento ou distribuição aos sócios.
 *
 * **De controle:** a conciliação garante que cada movimentação foi explicada;
 * a CONFERÊNCIA garante que nenhuma ficou de fora e nenhuma foi contada duas
 * vezes. São controles diferentes — dá para ter a fila zerada e o saldo errado.
 *
 * Dinheiro em centavos inteiros; datas "AAAA-MM-DD" no fuso de São Paulo.
 *
 * Client-safe: puro, sem I/O.
 */

import { diasEntre, somarDias } from "./dashboard-financeiro.ts";
import type { ImpactType } from "./resultados.ts";

const cent = (n: unknown) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.round(v) : 0;
};

/* ── Blocos e linhas do fluxo (§2.2) ───────────────────────────────────── */

export type BlocoFluxo = "operating" | "investing" | "financing" | "internal";

export const BLOCOS: { key: BlocoFluxo; label: string }[] = [
  { key: "operating", label: "Operacional" },
  { key: "investing", label: "Investimentos" },
  { key: "financing", label: "Sócios e financiamento" },
  { key: "internal", label: "Entre contas" },
];

export type LinhaFluxo =
  | "recebimentos" | "outras" | "equipe" | "diretos" | "estrutura"
  | "impostos" | "cartao" | "financeiro"
  | "equipamentos" | "socios" | "reserva";

export const LINHAS_FLUXO: { key: LinhaFluxo; label: string; bloco: BlocoFluxo }[] = [
  { key: "recebimentos", label: "Recebimentos de clientes", bloco: "operating" },
  { key: "outras", label: "Outras receitas", bloco: "operating" },
  { key: "equipe", label: "Equipe e pró-labore", bloco: "operating" },
  { key: "diretos", label: "Custos diretos", bloco: "operating" },
  { key: "estrutura", label: "Estrutura e softwares", bloco: "operating" },
  { key: "impostos", label: "Impostos", bloco: "operating" },
  { key: "cartao", label: "Faturas de cartão", bloco: "operating" },
  { key: "financeiro", label: "Tarifas e rendimentos", bloco: "operating" },
  { key: "equipamentos", label: "Equipamentos", bloco: "investing" },
  { key: "socios", label: "Distribuição e aportes", bloco: "financing" },
  { key: "reserva", label: "Aplicações na reserva", bloco: "internal" },
];

/**
 * Onde a categoria cai no fluxo, a partir do tipo de impacto (§2.2).
 *
 * É derivado, não digitado: o mesmo `impact_type` que decide a DRE decide o
 * bloco do caixa, e as duas páginas nunca discordam sobre o que é
 * investimento. A categoria pode sobrescrever quando souber melhor — uma
 * transferência para a reserva não é despesa de ninguém.
 */
export function blocoDaCategoria(
  impacto: ImpactType | null,
  sobrescrito?: { grupo?: string | null; linha?: string | null },
): { bloco: BlocoFluxo; linha: LinhaFluxo } {
  const grupo = sobrescrito?.grupo as BlocoFluxo | undefined;
  const linha = sobrescrito?.linha as LinhaFluxo | undefined;
  if (grupo && linha) return { bloco: grupo, linha };

  switch (impacto) {
    case "operating_revenue": return { bloco: "operating", linha: "recebimentos" };
    case "revenue_deduction": return { bloco: "operating", linha: "impostos" };
    case "direct_cost": return { bloco: "operating", linha: "diretos" };
    case "financial_result": return { bloco: "operating", linha: "financeiro" };
    case "investment": return { bloco: "investing", linha: "equipamentos" };
    case "equity_financing": return { bloco: "financing", linha: "socios" };
    default: return { bloco: "operating", linha: "estrutura" };
  }
}

/* ── Horizonte e granularidade (§5.1) ──────────────────────────────────── */

export type Horizonte = 30 | 60 | 90 | 365;

export type JanelaDoFluxo = {
  horizonte: Horizonte;
  granularidade: "dia" | "semana" | "mes";
  /** Quantos dias de passado entram junto. */
  passadoDias: number;
  explicacao: string;
};

/**
 * A granularidade acompanha o horizonte, sem o usuário escolher.
 *
 * 365 dias em barras diárias seriam 365 colunas de 3px: ninguém lê. E 30 dias
 * em barras mensais seriam uma coluna só, que não responde "quando aperta?" —
 * que é a pergunta do horizonte curto.
 */
export function janelaDoFluxo(horizonte: Horizonte): JanelaDoFluxo {
  if (horizonte === 365) {
    return {
      horizonte, granularidade: "mes", passadoDias: 183,
      explicacao: "por mês, com 6 meses de passado",
    };
  }
  if (horizonte === 90) {
    return {
      horizonte, granularidade: "semana", passadoDias: 91,
      explicacao: "por semana, com 13 semanas de passado",
    };
  }
  return {
    horizonte, granularidade: "dia", passadoDias: horizonte,
    explicacao: `por dia, com ${horizonte} dias de passado`,
  };
}

/** Os períodos da janela, do mais antigo ao mais novo. */
export function periodosDaJanela(hojeIso: string, janela: JanelaDoFluxo): {
  inicio: string; fim: string; label: string; futuro: boolean; contemHoje: boolean;
}[] {
  const inicioJanela = somarDias(hojeIso, -janela.passadoDias);
  const fimJanela = somarDias(hojeIso, janela.horizonte);
  const periodos: { inicio: string; fim: string; label: string; futuro: boolean; contemHoje: boolean }[] = [];

  if (janela.granularidade === "dia") {
    for (let d = inicioJanela; d <= fimJanela; d = somarDias(d, 1)) {
      periodos.push({
        inicio: d, fim: d, label: `${d.slice(8, 10)}/${d.slice(5, 7)}`,
        futuro: d > hojeIso, contemHoje: d === hojeIso,
      });
    }
    return periodos;
  }

  if (janela.granularidade === "semana") {
    // A semana começa na segunda: é como a operação conversa sobre a semana.
    const diaDaSemana = new Date(`${inicioJanela}T12:00:00Z`).getUTCDay();
    let cursor = somarDias(inicioJanela, diaDaSemana === 0 ? -6 : 1 - diaDaSemana);
    while (cursor <= fimJanela) {
      const fim = somarDias(cursor, 6);
      periodos.push({
        inicio: cursor, fim,
        label: `${cursor.slice(8, 10)}/${cursor.slice(5, 7)}`,
        futuro: cursor > hojeIso,
        contemHoje: cursor <= hojeIso && fim >= hojeIso,
      });
      cursor = somarDias(fim, 1);
    }
    return periodos;
  }

  let ano = Number(inicioJanela.slice(0, 4));
  let mes = Number(inicioJanela.slice(5, 7));
  const fimAno = Number(fimJanela.slice(0, 4));
  const fimMes = Number(fimJanela.slice(5, 7));
  while (ano < fimAno || (ano === fimAno && mes <= fimMes)) {
    const primeiro = `${ano}-${String(mes).padStart(2, "0")}-01`;
    const ultimo = new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
    periodos.push({
      inicio: primeiro, fim: ultimo,
      label: MESES_CURTO[mes],
      futuro: primeiro > hojeIso,
      contemHoje: primeiro <= hojeIso && ultimo >= hojeIso,
    });
    mes += 1;
    if (mes > 12) { mes = 1; ano += 1; }
  }
  return periodos;
}

const MESES_CURTO = [
  "", "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez",
];

/* ── Conferência de saldo (§2.1) ───────────────────────────────────────── */

/** Tolerância da conferência: um centavo (§16). */
export const TOLERANCIA_CONFERENCIA_CENT = 1;

export type ResultadoConferencia = {
  confere: boolean;
  diferencaCent: number;
  status: "matched" | "open";
  texto: string;
};

/**
 * O saldo do sistema bate com o do banco naquela data?
 *
 * A diferença é guardada com sinal: saber se o sistema tem dinheiro a mais ou
 * a menos que o banco muda o que se procura — a mais, é lançamento duplicado;
 * a menos, é movimentação que não foi importada.
 */
export function conferirSaldo(
  bancoCent: number,
  sistemaCent: number,
  dataIso: string,
): ResultadoConferencia {
  const dif = cent(sistemaCent) - cent(bancoCent);
  const confere = Math.abs(dif) <= TOLERANCIA_CONFERENCIA_CENT;
  const dia = `${dataIso.slice(8, 10)}/${dataIso.slice(5, 7)}`;
  return {
    confere,
    diferencaCent: dif,
    status: confere ? "matched" : "open",
    texto: confere
      ? `Confere com o banco em ${dia}`
      : `Diferença de ${brl(Math.abs(dif))} com o banco em ${dia}`,
  };
}

const brl = (c: number) =>
  (Math.round(c) / 100).toLocaleString("pt-BR", {
    style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

/* ── Linha de estado do cartão da conta (§4.1) ─────────────────────────── */

export type EstadoDaConta = {
  texto: string;
  tom: "ok" | "atencao" | "ruim" | "neutro";
  /** A prioridade que venceu, para teste e depuração. */
  prioridade: number;
};

/**
 * A linha de estado do cartão: a de MAIOR prioridade entre as que se aplicam.
 *
 * Mostrar todas empilhadas transformaria a faixa num paredão, e a informação
 * que importa é sempre a pior: saldo divergente manda investigar antes de
 * qualquer outra coisa, porque enquanto ele existir nenhum número da página é
 * confiável.
 */
export function estadoDaConta(input: {
  tipo: string;
  diferencaAbertaCent: number | null;
  diasSemExtrato: number | null;
  diasParaAviso: number;
  conferidoEmIso: string | null;
  pendentesDeConciliacao: number;
  usaExtrato: boolean;
  /** Gateway. */
  liquidezDias?: number | null;
  repasse?: string | null;
  /** Reserva. */
  rendimentoCent?: number | null;
  rendimentoMes?: string | null;
  /** Cartão. */
  faturaCent?: number | null;
  faturaVenceEm?: string | null;
}): EstadoDaConta {
  const dia = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

  if (input.diferencaAbertaCent !== null && Math.abs(input.diferencaAbertaCent) > TOLERANCIA_CONFERENCIA_CENT) {
    const extra = input.diasSemExtrato !== null && input.diasSemExtrato > input.diasParaAviso
      ? ` · extrato há ${input.diasSemExtrato} dias`
      : "";
    return {
      texto: `Diferença de ${brl(Math.abs(input.diferencaAbertaCent))} com o banco${extra}`,
      tom: "ruim", prioridade: 1,
    };
  }

  if (input.usaExtrato && input.diasSemExtrato !== null && input.diasSemExtrato > input.diasParaAviso) {
    return {
      texto: `Extrato sem importação há ${input.diasSemExtrato} dias`,
      tom: "atencao", prioridade: 2,
    };
  }

  if (input.conferidoEmIso && input.pendentesDeConciliacao > 0) {
    return {
      texto: `Confere com o banco em ${dia(input.conferidoEmIso)}. ` +
        `${input.pendentesDeConciliacao} para conciliar`,
      tom: "neutro", prioridade: 3,
    };
  }

  if (input.conferidoEmIso) {
    return { texto: `Confere com o banco em ${dia(input.conferidoEmIso)}`, tom: "ok", prioridade: 4 };
  }

  if (input.tipo === "gateway" && input.liquidezDias != null) {
    return {
      texto: `Liquidez D+${input.liquidezDias}${input.repasse ? `, repasse ${input.repasse}` : ""}`,
      tom: "neutro", prioridade: 5,
    };
  }
  if (input.tipo === "reserva") {
    return {
      texto: "Fora do disponível" +
        (input.rendimentoCent ? `. Rendeu ${brl(input.rendimentoCent)} em ${input.rendimentoMes ?? "mês"}` : ""),
      tom: "neutro", prioridade: 5,
    };
  }
  if (input.tipo === "cartao") {
    return {
      texto: input.faturaCent
        ? `Fatura de ${brl(Math.abs(input.faturaCent))}` +
          (input.faturaVenceEm ? `, vence ${dia(input.faturaVenceEm)}` : "")
        : "Sem fatura em formação",
      tom: "neutro", prioridade: 5,
    };
  }

  // Conta que nunca foi conferida não é conta em dia: é conta sem controle, e
  // dizer "confere" sem nenhuma conferência seria inventar a checagem.
  if (input.pendentesDeConciliacao > 0) {
    return {
      texto: `${input.pendentesDeConciliacao} para conciliar`,
      tom: "atencao", prioridade: 6,
    };
  }
  return {
    texto: input.usaExtrato ? "Nunca conferida com o banco" : "Sem extrato: baixa manual é definitiva",
    tom: "neutro", prioridade: 7,
  };
}

/* ── Sugestão de conciliação (§8.4) ────────────────────────────────────── */

export type NivelSugestao = "exata" | "confirma" | "encargos" | "multi" | "parcial"
  | "transf" | "regra" | "media" | "classif";

export const NIVEL_SUGESTAO: Record<NivelSugestao, {
  selo: string; tom: "ok" | "info" | "roxo" | "atencao" | "ruim"; acao: string;
}> = {
  exata:    { selo: "Correspondência exata", tom: "ok", acao: "Conciliar" },
  confirma: { selo: "Correspondência exata", tom: "ok", acao: "Confirmar" },
  encargos: { selo: "Sugestão forte", tom: "info", acao: "Conciliar com encargos" },
  multi:    { selo: "Sugestão forte", tom: "info", acao: "Conciliar com as parcelas" },
  parcial:  { selo: "Sugestão forte", tom: "info", acao: "Conciliar como parcial" },
  transf:   { selo: "Transferência detectada", tom: "roxo", acao: "Registrar transferência" },
  regra:    { selo: "Regra aprendida", tom: "roxo", acao: "Criar e conciliar" },
  media:    { selo: "Sugestão", tom: "atencao", acao: "Conciliar com a escolhida" },
  classif:  { selo: "Nada encontrado", tom: "ruim", acao: "Classificar e conciliar" },
};

export type ParcelaCandidata = {
  id: string;
  descricao: string;
  vencimentoIso: string;
  saldoCent: number;
  /** Documento da contraparte, quando o cadastro tem. */
  documento: string | null;
  direcao: "in" | "out";
};

export type MovimentoPendente = {
  id: string;
  dataIso: string;
  valorCent: number;
  descricaoRaw: string;
  documentoContraparte: string | null;
  contaId: string;
};

export type Sugestao = {
  nivel: NivelSugestao;
  titulo: string;
  detalhe: string;
  /** Parcelas envolvidas, quando há. */
  parcelas: string[];
  encargosCent: number;
  exata: boolean;
};

/** ± 3 dias para sugestões; ± 1 dia para transferências (§16). */
export const TOLERANCIA_DIAS = 3;
export const TOLERANCIA_DIAS_TRANSFERENCIA = 1;

/**
 * A melhor explicação para uma movimentação pendente (§8.4).
 *
 * A ordem das regras é a ordem da confiança, e ela importa mais que cada
 * regra isolada: uma correspondência exata por valor + documento não pode
 * perder para um palpite de valor parecido. E nada aqui concilia sozinho —
 * a função só diz qual é a melhor hipótese e quão forte ela é. Conciliar
 * automaticamente o que é "provável" é como o sistema antigo criava
 * divergência que ninguém achava depois.
 */
export function sugerirConciliacao(input: {
  movimento: MovimentoPendente;
  candidatas: ParcelaCandidata[];
  /** Baixas manuais aguardando o extrato. */
  baixasPendentes: { id: string; dataIso: string; valorCent: number; descricao: string }[];
  /** Movimentações de outras contas próprias, para detectar transferência. */
  movimentosDeOutrasContas: { id: string; dataIso: string; valorCent: number; contaNome: string }[];
  /** Regra de categorização que casou com o texto. */
  regra?: { categoria: string; contraparte: string | null; vezes: number } | null;
  /** Encargo máximo aceitável para a diferença virar juros e multa. */
  encargoMaximoPct?: number;
}): Sugestao {
  const m = input.movimento;
  const entrada = m.valorCent > 0;
  const valor = Math.abs(m.valorCent);
  const perto = (iso: string, dias = TOLERANCIA_DIAS) =>
    Math.abs(diasEntre(iso, m.dataIso)) <= dias;

  // 1. Confirma baixa manual: mesmo valor e data próxima. Vem antes de tudo
  //    porque a baixa JÁ existe — conciliar com outra parcela criaria uma
  //    segunda baixa para o mesmo dinheiro.
  const baixa = input.baixasPendentes.find(
    (b) => Math.abs(b.valorCent) === valor && perto(b.dataIso),
  );
  if (baixa) {
    return {
      nivel: "confirma",
      titulo: `Confirma o ${entrada ? "recebimento" : "pagamento"} registrado em ${ddmm(baixa.dataIso)}`,
      detalhe: `${baixa.descricao}. Mesmo valor e data próxima.`,
      parcelas: [], encargosCent: 0, exata: true,
    };
  }

  // 2. Transferência: mesmo valor, sinal oposto, conta própria, ± 1 dia.
  const par = input.movimentosDeOutrasContas.find(
    (o) => Math.abs(o.valorCent) === valor &&
      Math.sign(o.valorCent) === -Math.sign(m.valorCent) &&
      Math.abs(diasEntre(o.dataIso, m.dataIso)) <= TOLERANCIA_DIAS_TRANSFERENCIA,
  );
  if (par) {
    return {
      nivel: "transf",
      titulo: entrada ? `Transferência de ${par.contaNome}` : `Transferência para ${par.contaNome}`,
      detalhe: `Mesmo valor em ${par.contaNome} em ${ddmm(par.dataIso)}, com sinal oposto.`,
      parcelas: [], encargosCent: 0, exata: false,
    };
  }

  const direcao: "in" | "out" = entrada ? "in" : "out";
  const mesmaDirecao = input.candidatas.filter((c) => c.direcao === direcao);
  const doDocumento = m.documentoContraparte
    ? mesmaDirecao.filter((c) => soDigitos(c.documento) === soDigitos(m.documentoContraparte))
    : [];

  // 3. Exata: valor bate e o documento da contraparte bate.
  const exata = doDocumento.find((c) => c.saldoCent === valor);
  if (exata) {
    const dias = diasEntre(exata.vencimentoIso, m.dataIso);
    return {
      nivel: "exata",
      titulo: exata.descricao,
      detalhe: "Valor e documento conferem. " + (
        dias === 0 ? "Pago no vencimento."
        : dias > 0 ? `Pago ${dias} ${dias === 1 ? "dia" : "dias"} depois do vencimento.`
        : `Pago ${-dias} ${dias === -1 ? "dia" : "dias"} antes do vencimento.`),
      parcelas: [exata.id], encargosCent: 0, exata: true,
    };
  }

  // 4. Encargos: mesmo pagador, valor maior que a parcela vencida, e a
  //    diferença cabe no que multa e juros explicariam.
  const tetoPct = input.encargoMaximoPct ?? 10;
  const comEncargos = doDocumento
    .filter((c) => c.vencimentoIso < m.dataIso && valor > c.saldoCent)
    .find((c) => valor - c.saldoCent <= Math.round(c.saldoCent * (tetoPct / 100)));
  if (comEncargos) {
    const encargos = valor - comEncargos.saldoCent;
    return {
      nivel: "encargos",
      titulo: `${comEncargos.descricao} + encargos`,
      detalhe: `Parcela de ${brl(comEncargos.saldoCent)} + ${brl(encargos)} de multa e juros. ` +
        `Venceu em ${ddmm(comEncargos.vencimentoIso)}.`,
      parcelas: [comEncargos.id], encargosCent: encargos, exata: false,
    };
  }

  // 5. Multi: o valor é a soma exata de duas ou mais parcelas do mesmo pagador.
  const combinacao = somaExata(doDocumento, valor);
  if (combinacao.length >= 2) {
    return {
      nivel: "multi",
      titulo: `${combinacao.length} parcelas de um mesmo pagador`,
      detalhe: combinacao.map((c) => brl(c.saldoCent)).join(" + ") + ". Soma exata.",
      parcelas: combinacao.map((c) => c.id), encargosCent: 0, exata: false,
    };
  }

  // 6. Parcial: mesmo pagador, valor menor que a parcela.
  const parcial = doDocumento
    .filter((c) => valor < c.saldoCent)
    .sort((a, b) => a.saldoCent - b.saldoCent)[0];
  if (parcial) {
    return {
      nivel: "parcial",
      titulo: `Pagamento parcial: ${parcial.descricao}`,
      detalhe: `A parcela é de ${brl(parcial.saldoCent)}. ` +
        `O saldo de ${brl(parcial.saldoCent - valor)} segue em aberto.`,
      parcelas: [parcial.id], encargosCent: 0, exata: false,
    };
  }

  // 7. Regra aprendida ou padrão do banco.
  if (input.regra) {
    return {
      nivel: "regra",
      titulo: `Criar ${entrada ? "receita" : "despesa"}: ${input.regra.contraparte ?? input.regra.categoria}`,
      detalhe: `Regra para ${input.regra.categoria}, confirmada ${input.regra.vezes} ` +
        `${input.regra.vezes === 1 ? "vez" : "vezes"}.`,
      parcelas: [], encargosCent: 0, exata: false,
    };
  }

  // 8. Média: valor e data compatíveis, mas sem documento para provar.
  const compativeis = mesmaDirecao.filter((c) => c.saldoCent === valor).slice(0, 3);
  if (compativeis.length) {
    return {
      nivel: "media",
      titulo: `Qual lançamento ${entrada ? "esta entrada paga" : "esta saída quita"}?`,
      detalhe: "Mesmo valor, sem documento da contraparte. Confira antes de conciliar.",
      parcelas: compativeis.map((c) => c.id), encargosCent: 0, exata: false,
    };
  }

  return {
    nivel: "classif",
    titulo: `Classifique esta ${entrada ? "entrada" : "saída"}`,
    detalhe: "Nenhuma parcela, baixa ou regra corresponde a esta movimentação.",
    parcelas: [], encargosCent: 0, exata: false,
  };
}

const soDigitos = (v: string | null | undefined) => String(v ?? "").replace(/\D/g, "");
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/**
 * Subconjunto de parcelas cuja soma é exatamente o valor.
 *
 * Busca até 3 parcelas: um PIX que paga 4 mensalidades existe, mas testar
 * todas as combinações de uma carteira inteira custa caro e a chance de falso
 * positivo cresce junto — acima disso, o usuário escolhe na mão.
 */
export function somaExata(
  candidatas: ParcelaCandidata[],
  valorCent: number,
): ParcelaCandidata[] {
  const lista = candidatas.slice(0, 12);
  for (let i = 0; i < lista.length; i++) {
    for (let j = i + 1; j < lista.length; j++) {
      if (lista[i].saldoCent + lista[j].saldoCent === valorCent) return [lista[i], lista[j]];
      for (let k = j + 1; k < lista.length; k++) {
        if (lista[i].saldoCent + lista[j].saldoCent + lista[k].saldoCent === valorCent) {
          return [lista[i], lista[j], lista[k]];
        }
      }
    }
  }
  return [];
}

/* ── Descrição interpretada (§6.3) ─────────────────────────────────────── */

const PADROES: { re: RegExp; tipo: string; sinal?: 1 | -1 }[] = [
  { re: /\bPIX\s*(RECEB|RECEBIDO|CRED)/i, tipo: "PIX recebido", sinal: 1 },
  { re: /\bPIX\s*(ENV|ENVIADO|DEB)/i, tipo: "PIX enviado", sinal: -1 },
  { re: /\bTED\s*(RECEB|RECEBIDA)/i, tipo: "TED recebida", sinal: 1 },
  { re: /\bTED\s*(ENV|ENVIADA)/i, tipo: "TED enviada", sinal: -1 },
  { re: /\bTARIFA|CESTA|PACOTE\s*SERVICOS/i, tipo: "Tarifa bancária", sinal: -1 },
  { re: /\bRENDIMENTO|REMUNERACAO\s*APLIC/i, tipo: "Rendimento", sinal: 1 },
  { re: /\bPAG(AMENTO)?\s*FATURA|FATURA\s*CARTAO/i, tipo: "Pagamento de fatura", sinal: -1 },
  { re: /\bBOLETO|TITULO/i, tipo: "Boleto pago", sinal: -1 },
  { re: /\bCOMPRA\s*(DEB|DEBITO)/i, tipo: "Compra no débito", sinal: -1 },
  { re: /\bDAS|DARF|INSS|FGTS/i, tipo: "Imposto pago", sinal: -1 },
  { re: /\bTRANSF|REPASSE/i, tipo: "Transferência" },
];

/**
 * Transforma a descrição do banco numa frase legível (§6.3).
 *
 * A original nunca é alterada: é ela que prova o que o banco escreveu quando
 * a interpretação erra. O nome da contraparte sai do texto em maiúsculas que
 * sobra depois de remover o tipo e os documentos.
 */
export function interpretarDescricao(
  raw: string,
  valorCent: number,
  nomeConhecido?: string | null,
): { texto: string; tipo: string | null; documento: string | null } {
  const original = String(raw ?? "").trim();
  if (!original) return { texto: valorCent >= 0 ? "Entrada" : "Saída", tipo: null, documento: null };

  const doc = original.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{3}\.?\d{3}\.?\d{3}-?\d{2}/)?.[0] ?? null;
  const padrao = PADROES.find((p) => p.re.test(original));

  const nome = nomeConhecido?.trim() || nomeDoTexto(original);
  if (!padrao) {
    return { texto: nome || original, tipo: null, documento: doc };
  }
  const preposicao = /recebid|recebida/i.test(padrao.tipo) ? "de"
    : /enviad/i.test(padrao.tipo) ? "a"
    : null;

  return {
    texto: nome && preposicao ? `${padrao.tipo} ${preposicao} ${nome}` : padrao.tipo,
    tipo: padrao.tipo,
    documento: doc,
  };
}

function nomeDoTexto(raw: string): string | null {
  const limpo = raw
    .replace(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g, " ")
    .replace(/\*+/g, " ")
    .replace(/\b(PIX|TED|DOC|RECEB|RECEBIDO|RECEBIDA|ENV|ENVIADO|ENVIADA|CRED|DEB|DEBITO|COMPRA|PAG|PAGAMENTO|TRANSF|TRANSFERENCIA|REPASSE|BOLETO|TITULO|LOTE|SALDO|CONTA|P\/)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (limpo.length < 3) return null;
  // Título com iniciais maiúsculas: "APTO INCORPORACOES" vira "Apto
  // Incorporações" não — acentuar seria inventar; só o caixa muda.
  return limpo
    .split(" ")
    .map((p) => (p.length <= 2 ? p.toLowerCase() : p[0].toUpperCase() + p.slice(1).toLowerCase()))
    .join(" ");
}

/* ── Deduplicação na importação (§7) ───────────────────────────────────── */

/**
 * A impressão digital de uma linha do extrato.
 *
 * O `external_id` (FITID do OFX) resolve quando existe. Quando não existe — e
 * em CSV nunca existe —, a dedupe é por conta + data + valor + descrição: é o
 * que impede a mesma semana importada duas vezes de dobrar o saldo.
 */
export function impressaoDigital(input: {
  contaId: string; dataIso: string; valorCent: number; descricaoRaw: string;
}): string {
  const texto = String(input.descricaoRaw ?? "")
    .toUpperCase().replace(/\s+/g, " ").trim().slice(0, 80);
  return [input.contaId, input.dataIso, cent(input.valorCent), texto].join("|");
}

/* ── Fechamento do mês (§8.1 e §12) ────────────────────────────────────── */

export type PendenciaDeFechamento = { tipo: string; quantidade: number; texto: string };

/**
 * O que impede fechar o mês (§12).
 *
 * As três condições são de naturezas diferentes de propósito: movimentação
 * pendente é dinheiro sem explicação, baixa sem confirmação é explicação sem
 * dinheiro, e conferência aberta é o saldo inteiro em dúvida. Fechar com
 * qualquer uma delas é declarar um resultado que ainda pode mudar.
 */
export function pendenciasDeFechamento(input: {
  movimentacoesPendentes: number;
  baixasSemConfirmacao: number;
  conferenciasAbertas: number;
}): { liberado: boolean; pendencias: PendenciaDeFechamento[]; total: number } {
  const pendencias: PendenciaDeFechamento[] = [];
  if (input.movimentacoesPendentes > 0) {
    pendencias.push({
      tipo: "pendentes", quantidade: input.movimentacoesPendentes,
      texto: `${input.movimentacoesPendentes} ${input.movimentacoesPendentes === 1
        ? "movimentação pendente" : "movimentações pendentes"} no mês`,
    });
  }
  if (input.baixasSemConfirmacao > 0) {
    pendencias.push({
      tipo: "baixas", quantidade: input.baixasSemConfirmacao,
      texto: `${input.baixasSemConfirmacao} ${input.baixasSemConfirmacao === 1
        ? "baixa sem confirmação" : "baixas sem confirmação"} no extrato`,
    });
  }
  if (input.conferenciasAbertas > 0) {
    pendencias.push({
      tipo: "conferencia", quantidade: input.conferenciasAbertas,
      texto: `${input.conferenciasAbertas} ${input.conferenciasAbertas === 1
        ? "conta com saldo divergente" : "contas com saldo divergente"}`,
    });
  }
  const total = pendencias.reduce((s, p) => s + p.quantidade, 0);
  return { liberado: pendencias.length === 0, pendencias, total };
}
