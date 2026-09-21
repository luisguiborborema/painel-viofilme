/**
 * Panorama — Bloco 5 do Dashboard (spec §9).
 *
 * Aqui ficam as frases de conclusão (§9.3) e a geometria dos gráficos. As
 * frases são **templates com condição, calculados no servidor** — sem IA nesta
 * versão, como a spec exige. Cada visão tem uma frase; quando nenhuma regra se
 * aplica, vale a padrão.
 *
 * Elas existem porque um gráfico sozinho não conclui nada: quem abre o
 * Dashboard entre duas reuniões precisa ler a resposta, não interpretá-la.
 *
 * Valores em centavos, como o resto do módulo.
 */

// Extensão explícita: este módulo é testado por `node --test`, que resolve o
// caminho literalmente — sem o `.ts` o teste quebra e o build não (ver ofx.ts).
import { brlCheio, ddmm } from "./dashboard-financeiro.ts";

/* ── Slides (§9.1: array de configuração, não markup fixo) ─────────────── */

export type SlideId = "caixa" | "receita" | "resultado" | "gastos";

export const SLIDES: { id: SlideId; aba: string }[] = [
  { id: "caixa", aba: "Caixa em 30 dias" },
  { id: "receita", aba: "Composição da receita" },
  { id: "resultado", aba: "Resultado em 6 meses" },
  { id: "gastos", aba: "Para onde vai o dinheiro" },
];

/** Navegação circular: da última volta para a primeira (§9.1). */
export function slideVizinho(atual: number, passo: number, total = SLIDES.length): number {
  return (atual + passo + total) % total;
}

/* ── Frase do Slide 1 · Caixa ──────────────────────────────────────────── */

export function fraseDoCaixa(input: {
  saldoHojeCent: number;
  menorCent: number | null;
  menorEmIso: string | null;
  reservaCent: number;
  /** A maior saída do dia do menor saldo — o que explica o aperto. */
  maiorSaidaDoDia: string | null;
}): string {
  const { saldoHojeCent, menorCent, menorEmIso, reservaCent, maiorSaidaDoDia } = input;
  if (menorCent == null || !menorEmIso) return "Ainda não há lançamentos suficientes para projetar o caixa.";
  const porCausa = maiorSaidaDoDia ? `, por causa de ${maiorSaidaDoDia}` : "";
  const com = maiorSaidaDoDia ? `, com ${maiorSaidaDoDia},` : "";

  // (a) fura a reserva — é o que muda a decisão do dia. Com reserva em zero
  //     (o padrão), "abaixo da reserva" não diz nada: o que houve foi caixa
  //     negativo, e é assim que se fala disso.
  if (menorCent < reservaCent) {
    const oQue = reservaCent > 0 ? "fica abaixo da reserva" : "fica negativo";
    return `O caixa ${oQue} em ${ddmm(menorEmIso)}${porCausa}.`;
  }
  // (b) aperta, mas aguenta. Só vale avisar se o saldo de hoje é positivo:
  //     "metade de zero" não aperta nem sobra.
  if (saldoHojeCent > 0 && menorCent < saldoHojeCent / 2) {
    return `O caixa aperta no dia ${Number(menorEmIso.slice(8, 10))}${com} mas continua acima da reserva mínima.`;
  }
  return "O caixa se mantém estável nos próximos 30 dias.";
}

/* ── Frase do Slide 2 · Receita ────────────────────────────────────────── */

/** Um serviço só é "o que mais depende de pontual" acima de 30% dele mesmo. */
export const LIMITE_DEPENDENCIA_PONTUAL = 30;

export function fraseDaReceita(input: {
  pctRecorrente: number;
  totalCent: number;
  servicos: { nome: string; recorrenteCent: number; pontualCent: number }[];
}): string {
  if (input.totalCent <= 0) return "Ainda não há receita faturada neste mês.";
  const partes = [`${Math.round(input.pctRecorrente)}% da receita é recorrente.`];

  const dependente = input.servicos
    .map((s) => {
      const total = s.recorrenteCent + s.pontualCent;
      return { nome: s.nome, pct: total > 0 ? (s.pontualCent / total) * 100 : 0 };
    })
    .filter((s) => s.pct > LIMITE_DEPENDENCIA_PONTUAL)
    .sort((a, b) => b.pct - a.pct)[0];

  if (dependente) {
    partes.push(`${dependente.nome} é o serviço que mais depende de trabalhos pontuais.`);
  }
  return partes.join(" ");
}

/* ── Frase do Slide 3 · Resultado ──────────────────────────────────────── */

const ORDINAIS = ["", "", "Segundo", "Terceiro", "Quarto", "Quinto", "Sexto"];

/**
 * Quantos meses SEGUIDOS de alta ou de queda, contando de trás para frente.
 *
 * Conta as subidas, não os pontos: um mês que subiu em relação ao anterior é
 * o primeiro mês de alta, e só o seguinte é o "segundo mês seguido". Contar os
 * pontos daria "segundo mês seguido de alta" na primeira subida — o que faz a
 * frase anunciar uma tendência que ainda não existe.
 */
export function sequenciaDeResultado(
  resultados: number[],
): { direcao: "alta" | "queda" | "estavel"; meses: number } {
  if (resultados.length < 2) return { direcao: "estavel", meses: 0 };
  const ultimo = resultados.length - 1;
  const subiu = resultados[ultimo] > resultados[ultimo - 1];
  const caiu = resultados[ultimo] < resultados[ultimo - 1];
  if (!subiu && !caiu) return { direcao: "estavel", meses: 0 };

  let meses = 0;
  for (let i = ultimo; i > 0; i--) {
    const passo = subiu ? resultados[i] > resultados[i - 1] : resultados[i] < resultados[i - 1];
    if (!passo) break;
    meses++;
  }
  return { direcao: subiu ? "alta" : "queda", meses };
}

export function fraseDoResultado(input: {
  resultados: number[];
  mediaCent: number;
  mesEmCurso: boolean;
  /** Menos de 6 meses de histórico: a spec pede que a frase diga desde quando. */
  desdeIso: string | null;
  mesesDisponiveis: number;
}): string {
  const { resultados, mediaCent, mesEmCurso, desdeIso, mesesDisponiveis } = input;
  if (!resultados.length) return "Ainda não há histórico de resultado para comparar.";

  const partes: string[] = [];
  const seq = sequenciaDeResultado(resultados);

  if (seq.direcao !== "estavel" && seq.meses >= 2) {
    const palavra = seq.direcao === "alta" ? "alta" : "queda";
    const ordinal = ORDINAIS[Math.min(seq.meses, 6)] || `${seq.meses}º`;
    partes.push(`${ordinal} mês seguido de ${palavra} no resultado.`);
  } else {
    // Sem sequência, a referência útil é a média do período.
    const atual = resultados[resultados.length - 1];
    if (atual > mediaCent) partes.push("O resultado do mês está acima da média do período.");
    else if (atual < mediaCent) partes.push("O resultado do mês está abaixo da média do período.");
    else partes.push("O resultado do mês está na média do período.");
  }

  if (mesEmCurso) partes.push("Mês ainda em curso.");
  if (mesesDisponiveis < 6 && desdeIso) partes.push(`Histórico a partir de ${mesPorExtenso(desdeIso)}.`);
  return partes.join(" ");
}

const MESES_ANO = [
  "", "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "agosto de 2026" — usado quando o histórico é mais curto que 6 meses. */
export function mesPorExtenso(iso: string): string {
  return `${MESES_ANO[Number(iso.slice(5, 7))] ?? ""} de ${iso.slice(0, 4)}`;
}

/* ── Frase do Slide 4 · Gastos ─────────────────────────────────────────── */

export function fraseDosGastos(input: {
  grupos: { nome: string; valorCent: number; acimaDoOrcado: boolean; pctDoOrcado: number | null }[];
  totalCent: number;
}): string {
  if (input.totalCent <= 0) return "Ainda não há saídas lançadas neste mês.";
  const partes: string[] = [];

  const maior = [...input.grupos].sort((a, b) => b.valorCent - a.valorCent)[0];
  if (maior) {
    const pct = Math.round((maior.valorCent / input.totalCent) * 100);
    // "Quase metade" diz mais que "47%" quando o número está perto disso.
    partes.push(
      pct >= 45 && pct <= 55
        ? `${maior.nome} é quase metade de tudo que sai.`
        : `${maior.nome} é ${pct}% de tudo que sai.`,
    );
  }

  const estourados = input.grupos.filter((g) => g.acimaDoOrcado).map((g) => g.nome);
  if (estourados.length === 1) partes.push(`${estourados[0]} está acima do orçado.`);
  else if (estourados.length === 2) partes.push(`${estourados[0]} e ${estourados[1]} estão acima do orçado.`);
  else if (estourados.length > 2) partes.push(`${estourados.length} grupos estão acima do orçado.`);

  return partes.join(" ");
}

/* ── Geometria do gráfico de linha (Slide 1) ───────────────────────────── */

export type Caixa = { largura: number; altura: number; esquerda: number; topo: number; base: number };

export const CAIXA_CAIXA: Caixa = { largura: 660, altura: 250, esquerda: 48, topo: 14, base: 216 };

export type LinhaProjetada = {
  linha: string;
  area: string;
  /** Posição de cada dia, para o hover e para o ponto do menor saldo. */
  pontos: { x: number; y: number }[];
  /** Linhas de grade com o rótulo do valor. */
  grade: { y: number; label: string }[];
  /** y da reserva mínima; null quando ela é 0 e a linha não diz nada. */
  yReserva: number | null;
  topoCent: number;
};

/**
 * Converte a série projetada em coordenadas SVG.
 *
 * O topo da escala é arredondado para cima até um múltiplo redondo, e o piso
 * acompanha o menor valor quando ele é negativo — sem isso, um caixa negativo
 * sairia desenhado fora da caixa, sem nenhum aviso.
 */
export function montarLinhaDoCaixa(
  serie: { dataIso: string; saldoCent: number }[],
  reservaCent: number,
  caixa: Caixa = CAIXA_CAIXA,
): LinhaProjetada | null {
  if (serie.length < 2) return null;

  const valores = serie.map((p) => p.saldoCent);
  const maior = Math.max(...valores, reservaCent, 0);
  const menor = Math.min(...valores, 0);
  const passo = escalaRedonda(maior - menor);
  const topo = Math.ceil(maior / passo) * passo;
  const piso = Math.floor(menor / passo) * passo;
  const amplitude = topo - piso || 1;

  const larguraUtil = caixa.largura - caixa.esquerda - 10;
  const alturaUtil = caixa.base - caixa.topo;
  const x = (i: number) => caixa.esquerda + (i * larguraUtil) / (serie.length - 1);
  const y = (v: number) => caixa.topo + alturaUtil * (1 - (v - piso) / amplitude);

  const pontos = serie.map((p, i) => ({ x: x(i), y: y(p.saldoCent) }));
  const linha = `M ${pontos.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" L ")}`;
  const area = `${linha} L ${x(serie.length - 1).toFixed(1)} ${y(piso).toFixed(1)} L ${caixa.esquerda} ${y(piso).toFixed(1)} Z`;

  const grade: { y: number; label: string }[] = [];
  for (let v = piso; v <= topo; v += passo) {
    grade.push({ y: y(v), label: rotuloCurto(v) });
  }

  return {
    linha, area, pontos, grade,
    yReserva: reservaCent > 0 ? y(reservaCent) : null,
    topoCent: topo,
  };
}

/** Passo de grade redondo (1, 2 ou 5 × 10ⁿ) para uns 4 níveis. */
function escalaRedonda(amplitudeCent: number): number {
  const alvo = Math.max(1, amplitudeCent) / 4;
  const ordem = 10 ** Math.floor(Math.log10(alvo));
  for (const m of [1, 2, 5, 10]) {
    if (ordem * m >= alvo) return ordem * m;
  }
  return ordem * 10;
}

/** "120 mil", "0", "-40 mil" — o eixo não precisa de centavo nem de "R$". */
export function rotuloCurto(cent: number): string {
  const reais = cent / 100;
  if (reais === 0) return "0";
  const abs = Math.abs(reais);
  const sinal = reais < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sinal}${(abs / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1_000) return `${sinal}${Math.round(abs / 1_000)} mil`;
  return `${sinal}${Math.round(abs)}`;
}

/** Largura de barra em %, sempre sobre o maior da própria visão. */
export function larguraRelativa(valorCent: number, maiorCent: number): number {
  return maiorCent > 0 ? Math.max(0, Math.min(100, (valorCent / maiorCent) * 100)) : 0;
}

/* ── Resumo de um slide, como a coluna da esquerda mostra ──────────────── */

export type LinhaResumo = { rotulo: string; valor: string; tom?: "bom" | "ruim" | "atencao" };

export function linhaResumo(rotulo: string, valorCent: number, tom?: LinhaResumo["tom"]): LinhaResumo {
  return { rotulo, valor: brlCheio(valorCent), tom };
}
