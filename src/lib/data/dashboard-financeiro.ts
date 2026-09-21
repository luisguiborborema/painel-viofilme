/**
 * Dashboard Financeiro — camada de métricas (spec §12) e regras das exceções
 * (§5.3), separadas da leitura do banco.
 *
 * Fica aqui tudo o que é conta pura: ordenação por gravidade, saldo projetado,
 * aging, barra dia a dia, pagos em dia. O front não calcula nada (§2) e o
 * servidor não repete regra — os dois chamam estas funções, e os testes cobrem
 * as invariantes sem precisar de banco.
 *
 * Valores em CENTAVOS inteiros (§24 do documento-mãe). Datas como "AAAA-MM-DD"
 * no fuso de São Paulo (§17): "hoje", "vencido" e "desde ontem" mudam de
 * resposta se o fuso escorregar, e escorregar não dá erro — só mostra outro dia.
 */

export const TZ = "America/Sao_Paulo";

/* ── Datas ─────────────────────────────────────────────────────────────── */

/** Hoje em São Paulo, "AAAA-MM-DD". `en-CA` já sai no formato ISO. */
export function hojeSP(agora: Date = new Date()): string {
  return agora.toLocaleDateString("en-CA", { timeZone: TZ });
}

/** Hora de São Paulo, "hh:mm" — o "Atualizado às" do Bloco 1 (§15). */
export function horaSP(agora: Date = new Date()): string {
  return agora.toLocaleTimeString("pt-BR", {
    timeZone: TZ, hour: "2-digit", minute: "2-digit",
  });
}

/**
 * Aritmética de calendário sobre a data ISO, em UTC de propósito: somar dias
 * com `new Date(iso)` local erraria na virada do horário de verão.
 */
export function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  const base = new Date(Date.UTC(a, (m || 1) - 1, d || 1));
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

/** Dias inteiros de `deIso` até `ateIso`. Negativo se `ateIso` é passado. */
export function diasEntre(deIso: string, ateIso: string): number {
  const ms = Date.parse(`${ateIso}T00:00:00Z`) - Date.parse(`${deIso}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** "AAAA-MM-DD" → "21/09". */
export function ddmm(iso: string): string {
  const [, m, d] = iso.split("-");
  return d && m ? `${d}/${m}` : iso;
}

/** "Segunda-feira, 21 de setembro de 2026" — a data do cabeçalho (§4). */
export function dataPorExtenso(iso: string): string {
  const texto = new Date(`${iso}T12:00:00Z`).toLocaleDateString("pt-BR", {
    timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Primeiro e último dia do mês da data. */
export function limitesDoMes(iso: string): { primeiro: string; ultimo: string } {
  const [a, m] = iso.split("-").map(Number);
  return {
    primeiro: `${a}-${String(m).padStart(2, "0")}-01`,
    ultimo: new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10),
  };
}

/* ── Dinheiro ──────────────────────────────────────────────────────────── */

/**
 * "R$ 84.320" — sem centavos. No Dashboard o centavo é ruído: o número existe
 * para responder "dá ou não dá", e a ficha do lançamento mostra o valor exato.
 */
export function brlCheio(cent: number): string {
  return (Math.round(cent) / 100).toLocaleString("pt-BR", {
    style: "currency", currency: "BRL", maximumFractionDigits: 0,
  });
}

/**
 * Centavos a partir do que a pessoa digitou num campo de valor.
 *
 * O campo aceita as duas escritas que aparecem de verdade: a brasileira
 * ("1.234,56") e a que o próprio código produz com `toFixed` ("1234.56").
 * Tratar todo ponto como separador de milhar multiplicava o valor por cem —
 * "10.47" virava R$ 1.047 — e o erro passava despercebido porque a baixa
 * limita o principal ao saldo: a parcela fechava certo, e só um recebimento
 * PARCIAL revelaria que o número digitado não foi o usado.
 *
 * A regra: com os dois separadores, o ponto é milhar. Só com vírgula, ela é
 * decimal. Só com ponto, é milhar quando há mais de um ou quando sobram três
 * dígitos depois dele ("2.000"); nos demais casos é decimal ("10.47").
 */
export function centavosDoTexto(valor: string): number {
  const limpo = String(valor ?? "").replace(/[^\d.,-]/g, "").trim();
  if (!limpo) return 0;

  const temVirgula = limpo.includes(",");
  const pontos = (limpo.match(/\./g) ?? []).length;

  let normal = limpo;
  if (temVirgula) {
    normal = limpo.replace(/\./g, "").replace(",", ".");
  } else if (pontos > 1) {
    normal = limpo.replace(/\./g, "");
  } else if (pontos === 1) {
    const depois = limpo.length - limpo.indexOf(".") - 1;
    normal = depois === 3 ? limpo.replace(".", "") : limpo;
  }
  const n = Number(normal);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** O valor como o campo deve mostrá-lo: "1.234,56", sem o símbolo. */
export function valorEditavel(cent: number): string {
  return (Math.round(cent) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

/** Com sinal explícito, para deltas: "+ R$ 4.500" / "− R$ 1.200". */
export function brlComSinal(cent: number): string {
  const sinal = cent < 0 ? "−" : "+";
  return `${sinal} ${brlCheio(Math.abs(cent))}`;
}

/* ── Parâmetros configuráveis (§13) ────────────────────────────────────── */

export type ParametrosDashboard = {
  /** E2 e Slide 1. Abaixo disso o caixa vira exceção. */
  reservaMinimaCent: number;
  /** E5: cobrança não enviada com vencimento em até N dias. */
  diasAntecedenciaCobranca: number;
  /** I1 e popover de saldo: conta sem importação há mais de N dias. */
  diasSemExtrato: number;
  /** E8: baixa sem confirmação no extrato há mais de N dias. */
  diasBaixaSemConfirmacao: number;
  /** E7: a partir daqui a conciliação pendente sobe de aviso para atenção. */
  limiteConciliacaoQtd: number;
  limiteConciliacaoDias: number;
  /** I2: categoria acima de N% do orçado. */
  toleranciaOrcamentoPct: number;
  /** I3: dia do mês a partir do qual o fechamento do mês anterior é cobrado. */
  diaCobrancaFechamento: number;
};

/** Ninguém precisa configurar nada para começar (§13). */
export const PARAMETROS_PADRAO: ParametrosDashboard = {
  reservaMinimaCent: 0,
  diasAntecedenciaCobranca: 5,
  diasSemExtrato: 7,
  diasBaixaSemConfirmacao: 7,
  limiteConciliacaoQtd: 20,
  limiteConciliacaoDias: 7,
  toleranciaOrcamentoPct: 110,
  diaCobrancaFechamento: 10,
};

/* ── Exceções (§5) ─────────────────────────────────────────────────────── */

export type Gravidade = "critico" | "atencao" | "aviso";

export const GRAVIDADE_LABEL: Record<Gravidade, string> = {
  critico: "Crítico",
  atencao: "Atenção",
  aviso: "Aviso",
};

const PESO: Record<Gravidade, number> = { critico: 3, atencao: 2, aviso: 1 };

export type ExcecaoTipo =
  | "E1" | "E2" | "E3" | "E4" | "E5" | "E6" | "E7" | "E8"
  | "I1" | "I2" | "I3" | "I4";

export type Excecao = {
  /** tipo + escopo (§5.3 regra 4). Muda de escopo, o aviso volta. */
  chave: string;
  tipo: ExcecaoTipo;
  gravidade: Gravidade;
  /** O que é + quanto (§5.2). */
  titulo: string;
  /** Quantos e o mais relevante. */
  detalhe: string;
  destino: string;
  /** O destino já com o filtro aplicado (§2). */
  href: string;
  /** Só ordena; não aparece na tela. */
  valorCent: number;
};

/**
 * `E1` sem escopo, `I1:conta-<id>` com. O escopo faz parte da chave porque o
 * silêncio é por problema, não por tipo: silenciar "extrato do Sicoob parado"
 * não pode calar "extrato do Inter parado" (§5.3 regra 4).
 */
export function chaveDeExcecao(tipo: ExcecaoTipo, escopo?: string | null): string {
  return escopo ? `${tipo}:${escopo}` : tipo;
}

/** Gravidade desc → valor desc (§5.3 regra 1). Não muda o array recebido. */
export function ordenarExcecoes(lista: Excecao[]): Excecao[] {
  return [...lista].sort(
    (a, b) => PESO[b.gravidade] - PESO[a.gravidade] || b.valorCent - a.valorCent,
  );
}

/**
 * 🔴 e 🟠 aparecem sempre; ⚪ ficam recolhidos em "N avisos" (§5.3 regra 2).
 * A contagem do título do bloco considera só as principais (regra 5).
 */
export function separarExcecoes(lista: Excecao[]): {
  principais: Excecao[];
  avisos: Excecao[];
  totalPrincipais: number;
} {
  const ordenadas = ordenarExcecoes(lista);
  const principais = ordenadas.filter((e) => e.gravidade !== "aviso");
  const avisos = ordenadas.filter((e) => e.gravidade === "aviso");
  return { principais, avisos, totalPrincipais: principais.length };
}

/**
 * Só ⚪ pode ser silenciado (§5.3 regras 3 e 4). Crítico e atenção saem quando
 * o problema é resolvido, e não quando alguém cansa de olhar para eles.
 */
export function podeSilenciar(e: Pick<Excecao, "gravidade">): boolean {
  return e.gravidade === "aviso";
}

/** Sete dias a partir de hoje (§5.3 regra 4). */
export const DIAS_DE_SILENCIO = 7;

export function silencioAte(hojeIso: string): string {
  return somarDias(hojeIso, DIAS_DE_SILENCIO);
}

/** Silêncio vencido não cala mais nada. */
export function estaSilenciada(
  chave: string,
  silencios: { chave: string; ateIso: string }[],
  hojeIso: string,
): boolean {
  return silencios.some((s) => s.chave === chave && s.ateIso > hojeIso);
}

/* ── Gravidades que dependem de conta (§5.1) ───────────────────────────── */

/** E2: 🔴 se o menor saldo cai em até 7 dias, 🟠 entre 8 e 30. */
export function gravidadeCaixaMinimo(diasAteOMenor: number): Gravidade {
  return diasAteOMenor <= 7 ? "critico" : "atencao";
}

/** E3: 🟠, mas 🔴 se alguma parcela passou de 30 dias de atraso. */
export function gravidadeRecebimentosVencidos(maiorAtrasoDias: number): Gravidade {
  return maiorAtrasoDias > 30 ? "critico" : "atencao";
}

/** E7: 🟠 se a mais antiga passou do limite de dias ou a fila passou da qtd. */
export function gravidadeConciliacao(
  qtd: number,
  diasDaMaisAntiga: number,
  p: Pick<ParametrosDashboard, "limiteConciliacaoQtd" | "limiteConciliacaoDias">,
): Gravidade {
  return diasDaMaisAntiga > p.limiteConciliacaoDias || qtd > p.limiteConciliacaoQtd
    ? "atencao"
    : "aviso";
}

/* ── Saldo projetado (§12) ─────────────────────────────────────────────── */

export type ParcelaAberta = { dataIso: string; valorCent: number };

/**
 * Saldo projetado no dia D: disponível de hoje + entradas abertas que vencem
 * de hoje até D − saídas abertas no mesmo intervalo − saídas JÁ VENCIDAS.
 *
 * As duas assimetrias são de propósito:
 *  • saída vencida conta como saída de hoje — o dinheiro ainda vai sair, e
 *    ignorá-la infla a projeção justamente de quem está atrasado;
 *  • entrada vencida NÃO entra — quem não pagou no dia pode não pagar nunca,
 *    e contar com ela é a forma mais rápida de projetar um caixa que não existe.
 */
export function saldoProjetadoEm(
  saldoHojeCent: number,
  entradas: ParcelaAberta[],
  saidas: ParcelaAberta[],
  hojeIso: string,
  diaIso: string,
): number {
  let saldo = saldoHojeCent;
  for (const e of entradas) {
    if (e.dataIso >= hojeIso && e.dataIso <= diaIso) saldo += e.valorCent;
  }
  for (const s of saidas) {
    // `<= diaIso` já engloba as vencidas, porque diaIso nunca é antes de hoje.
    if (s.dataIso <= diaIso) saldo -= s.valorCent;
  }
  return saldo;
}

export type PontoProjecao = { dataIso: string; saldoCent: number };

/** A projeção dia a dia de hoje até hoje+`dias`, inclusive nas duas pontas. */
export function serieProjecao(
  saldoHojeCent: number,
  entradas: ParcelaAberta[],
  saidas: ParcelaAberta[],
  hojeIso: string,
  dias = 30,
): PontoProjecao[] {
  const delta = new Map<string, number>();
  // Vencidas viram movimento de hoje — mesma regra de `saldoProjetadoEm`.
  for (const s of saidas) {
    const dia = s.dataIso < hojeIso ? hojeIso : s.dataIso;
    delta.set(dia, (delta.get(dia) ?? 0) - s.valorCent);
  }
  for (const e of entradas) {
    if (e.dataIso < hojeIso) continue;
    delta.set(e.dataIso, (delta.get(e.dataIso) ?? 0) + e.valorCent);
  }

  const out: PontoProjecao[] = [];
  let saldo = saldoHojeCent;
  for (let i = 0; i <= dias; i++) {
    const dia = somarDias(hojeIso, i);
    saldo += delta.get(dia) ?? 0;
    out.push({ dataIso: dia, saldoCent: saldo });
  }
  return out;
}

/** O menor saldo da série e o dia em que ocorre. Empate: o dia mais próximo. */
export function menorSaldo(serie: PontoProjecao[]): PontoProjecao | null {
  let menor: PontoProjecao | null = null;
  for (const p of serie) if (!menor || p.saldoCent < menor.saldoCent) menor = p;
  return menor;
}

/** Fôlego de caixa: quantos meses o disponível cobre da saída média. */
export function folegoEmMeses(saldoCent: number, saidaMensalCent: number): number | null {
  if (saidaMensalCent <= 0) return null;
  return saldoCent / saidaMensalCent;
}

/* ── Aging dos vencidos (§7.2) ─────────────────────────────────────────── */

export const FAIXAS_ATRASO: { key: string; label: string; min: number; max: number }[] = [
  { key: "1-7", label: "1–7 d", min: 1, max: 7 },
  { key: "8-15", label: "8–15 d", min: 8, max: 15 },
  { key: "16-30", label: "16–30 d", min: 16, max: 30 },
  { key: "31-60", label: "31–60 d", min: 31, max: 60 },
  { key: "60+", label: "60+ d", min: 61, max: Number.POSITIVE_INFINITY },
];

export type FaixaAging = { key: string; label: string; valorCent: number; alturaPct: number };

/** Faixa vazia continua na lista: a spec pede que ela mostre "—". */
export function aging(vencidos: { diasAtraso: number; valorCent: number }[]): FaixaAging[] {
  const soma = FAIXAS_ATRASO.map((f) => ({
    key: f.key,
    label: f.label,
    valorCent: vencidos
      .filter((v) => v.diasAtraso >= f.min && v.diasAtraso <= f.max)
      .reduce((s, v) => s + v.valorCent, 0),
  }));
  const maior = Math.max(0, ...soma.map((f) => f.valorCent));
  return soma.map((f) => ({
    ...f,
    alturaPct: maior > 0 ? (f.valorCent / maior) * 100 : 0,
  }));
}

/* ── Barra dia a dia (§7.2) ────────────────────────────────────────────── */

export type ColunaDia = {
  dataIso: string;
  valorCent: number;
  /** Hoje e depois são PREVISTO (barra só com contorno); antes, realizado. */
  previsto: boolean;
  hoje: boolean;
  /** Proporcional ao maior valor do próprio painel (§7.2). */
  alturaPct: number;
};

/**
 * 15 colunas: 7 dias passados + hoje + 7 futuros. Passado são as baixas que
 * aconteceram; hoje e futuro, as parcelas previstas.
 *
 * A altura é relativa ao maior valor DESTE painel, não ao do outro: a barra
 * mostra o ritmo de recebimentos ou de pagamentos, e uma escala comum
 * achataria o painel menor até virar uma linha reta.
 */
export function barraDiaADia(
  realizadas: ParcelaAberta[],
  previstas: ParcelaAberta[],
  hojeIso: string,
): ColunaDia[] {
  const colunas = Array.from({ length: 15 }, (_, i) => {
    const dataIso = somarDias(hojeIso, i - 7);
    const previsto = dataIso >= hojeIso;
    const fonte = previsto ? previstas : realizadas;
    return {
      dataIso,
      previsto,
      hoje: dataIso === hojeIso,
      valorCent: fonte
        .filter((p) => p.dataIso === dataIso)
        .reduce((s, p) => s + p.valorCent, 0),
    };
  });
  const maior = Math.max(0, ...colunas.map((c) => c.valorCent));
  return colunas.map((c) => ({
    ...c,
    alturaPct: maior > 0 ? (c.valorCent / maior) * 100 : 0,
  }));
}

/* ── Pagamentos: situação do que falta pagar (§7.2) ────────────────────── */

export type ParcelaAPagar = {
  valorCent: number;
  vencimentoIso: string;
  /** `scheduled_payment_date` do documento-mãe. */
  programadaParaIso: string | null;
  aguardandoAprovacao: boolean;
};

export type SituacaoPagar = {
  vencidoCent: number;
  aguardandoAprovacaoCent: number;
  programadoCent: number;
  semProgramacaoCent: number;
  totalCent: number;
};

/**
 * Reparte, sem sobreposição, todo o saldo em aberto do mês. É uma PARTIÇÃO de
 * propósito: a barra empilhada tem que somar o total, senão a legenda mente.
 *
 * Vencido vem primeiro para bater com o número "Vencido" do mesmo painel
 * (§7.1) — dois valores com o mesmo nome e contas diferentes na mesma tela é
 * bug garantido. Aprovação vem em seguida porque é o que trava o pagamento.
 */
export function situacaoDoQueFaltaPagar(
  parcelas: ParcelaAPagar[],
  hojeIso: string,
  aprovacaoLigada: boolean,
): SituacaoPagar {
  const out: SituacaoPagar = {
    vencidoCent: 0, aguardandoAprovacaoCent: 0,
    programadoCent: 0, semProgramacaoCent: 0, totalCent: 0,
  };
  for (const p of parcelas) {
    out.totalCent += p.valorCent;
    if (p.vencimentoIso < hojeIso) out.vencidoCent += p.valorCent;
    else if (aprovacaoLigada && p.aguardandoAprovacao) out.aguardandoAprovacaoCent += p.valorCent;
    else if (p.programadaParaIso) out.programadoCent += p.valorCent;
    else out.semProgramacaoCent += p.valorCent;
  }
  return out;
}

/* ── Pagos em dia, 90 dias (§12) ───────────────────────────────────────── */

/**
 * Valor das saídas liquidadas ATÉ o vencimento ÷ valor total liquidado nos
 * últimos 90 dias, em %. `null` quando nada foi liquidado: 0% diria que a
 * empresa não paga nada em dia, e o certo é não ter resposta ainda.
 */
export function pagosEmDia(
  liquidadas: { vencimentoIso: string; pagamentoIso: string; valorCent: number }[],
): number | null {
  let total = 0;
  let emDia = 0;
  for (const l of liquidadas) {
    total += l.valorCent;
    if (l.pagamentoIso <= l.vencimentoIso) emDia += l.valorCent;
  }
  return total > 0 ? Math.round((emDia / total) * 100) : null;
}

/** Atraso médio das baixas de entrada, em dias. `null` sem baixas. */
export function atrasoMedio(
  baixas: { vencimentoIso: string; pagamentoIso: string }[],
): number | null {
  if (!baixas.length) return null;
  const soma = baixas.reduce(
    (s, b) => s + Math.max(0, diasEntre(b.vencimentoIso, b.pagamentoIso)), 0,
  );
  return soma / baixas.length;
}

/* ── Rótulos (§17) ─────────────────────────────────────────────────────── */

/**
 * "Adobe", "Adobe e Google", "4 contas". Acima de dois nomes a lista deixa de
 * caber e de informar: o que importa passa a ser quantas são.
 */
export function rotuloDePessoas(nomes: string[], substantivo = "contas"): string {
  const limpos = [...new Set(nomes.map((n) => n.trim()).filter(Boolean))];
  if (limpos.length === 0) return "";
  if (limpos.length === 1) return limpos[0];
  if (limpos.length === 2) return `${limpos[0]} e ${limpos[1]}`;
  return `${limpos.length} ${substantivo}`;
}

/**
 * "hoje", "amanhã", "daqui a 12 dias". Existe porque "daqui a 0 dias" chegou a
 * aparecer na tela: tecnicamente certo, e ninguém fala assim.
 */
export function emQuantoTempo(dias: number): string {
  if (dias <= 0) return "hoje";
  if (dias === 1) return "amanhã";
  return `daqui a ${dias} dias`;
}

/** "hoje", "amanhã" ou "21/09" — como o vencimento aparece nas linhas. */
export function rotuloDeDia(iso: string, hojeIso: string): string {
  const d = diasEntre(hojeIso, iso);
  if (d === 0) return "hoje";
  if (d === 1) return "amanhã";
  if (d === -1) return "ontem";
  return ddmm(iso);
}

/** "Hoje", "Amanhã", "Seg 21" — a coluna Data do Bloco 4 (§8.2). */
export function rotuloDaSemana(iso: string, hojeIso: string): string {
  const d = diasEntre(hojeIso, iso);
  if (d === 0) return "Hoje";
  if (d === 1) return "Amanhã";
  const dia = new Date(`${iso}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC", weekday: "short" });
  // O pt-BR devolve "seg." — o ponto não cabe numa coluna de 76px.
  const curto = dia.replace(".", "");
  return `${curto.charAt(0).toUpperCase()}${curto.slice(1)} ${iso.slice(8, 10)}`;
}

/**
 * Ordem do Bloco 4 (§8.1): data asc → saída antes de entrada no mesmo dia →
 * valor desc. A saída vem primeiro de propósito: no mesmo dia, o que sai é
 * que decide se o que entra chega a tempo.
 */
export function ordenarSemana<T extends { dataIso: string; entrada: boolean; valorCent: number }>(
  itens: T[],
): T[] {
  return [...itens].sort(
    (a, b) =>
      a.dataIso.localeCompare(b.dataIso) ||
      Number(a.entrada) - Number(b.entrada) ||
      b.valorCent - a.valorCent,
  );
}

/* ── Progresso do mês (§7.1) ───────────────────────────────────────────── */

export type ProgressoMes = {
  /** O número grande: quanto do mês já entrou (ou já foi pago). */
  pct: number;
  baixadoCent: number;
  vencidoCent: number;
  totalCent: number;
  /** Larguras da barra, já limitadas para nunca passar de 100 somadas. */
  larguraBaixada: number;
  larguraVencida: number;
};

export function progressoDoMes(
  baixadoCent: number,
  vencidoCent: number,
  totalCent: number,
): ProgressoMes {
  const base = totalCent > 0 ? totalCent : 0;
  const larguraBaixada = base > 0 ? Math.min(100, (baixadoCent / base) * 100) : 0;
  const larguraVencida = base > 0
    ? Math.min(100 - larguraBaixada, (vencidoCent / base) * 100)
    : 0;
  return {
    pct: base > 0 ? Math.round((baixadoCent / base) * 100) : 0,
    baixadoCent, vencidoCent, totalCent,
    larguraBaixada, larguraVencida,
  };
}

/* ── Faixa "Desde ontem" (§4) ──────────────────────────────────────────── */

export type JanelaDesdeOntem = { desdeIso: string; label: string };

/**
 * Desde as 00:00 de ontem. Mas se a pessoa ficou mais de um dia fora, a janela
 * vira "desde a sua última visita" — senão o que aconteceu na ausência dela
 * some da tela sem nunca ter sido visto.
 */
export function janelaDesdeOntem(
  hojeIso: string,
  ultimaVisitaIso: string | null,
): JanelaDesdeOntem {
  const ontem = somarDias(hojeIso, -1);
  if (ultimaVisitaIso && ultimaVisitaIso < ontem) {
    return { desdeIso: ultimaVisitaIso, label: "Desde a sua última visita" };
  }
  return { desdeIso: ontem, label: "Desde ontem" };
}
