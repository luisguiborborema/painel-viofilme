/**
 * Panorama — as frases de conclusão (§9.3) e a geometria dos gráficos.
 *
 * A frase é o que a pessoa lê antes de olhar o gráfico. Se ela errar a
 * direção — dizer "alta" numa queda, ou "abaixo da reserva" quando está
 * acima — o gráfico ao lado não desmente: quem lê já decidiu.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CAIXA_CAIXA, fraseDaReceita, fraseDoCaixa, fraseDoResultado, fraseDosGastos,
  larguraRelativa, mesPorExtenso, montarLinhaDoCaixa, rotuloCurto,
  sequenciaDeResultado, SLIDES, slideVizinho,
} from "../src/lib/data/dashboard-panorama.ts";
import { ordenarSemana, rotuloDaSemana } from "../src/lib/data/dashboard-financeiro.ts";

const R$ = (reais: number) => Math.round(reais * 100);
const HOJE = "2026-09-17";

/* ── Carrossel (§9.1) ──────────────────────────────────────────────────── */

test("a navegação é circular nos dois sentidos", () => {
  assert.equal(SLIDES.length, 4);
  assert.equal(slideVizinho(3, 1), 0, "da última volta para a primeira");
  assert.equal(slideVizinho(0, -1), 3, "e da primeira para a última");
  assert.equal(slideVizinho(1, 1), 2);
});

/* ── Frase do caixa ────────────────────────────────────────────────────── */

test("furar a reserva é o que a frase diz primeiro", () => {
  const f = fraseDoCaixa({
    saldoHojeCent: R$(84320), menorCent: R$(20000), menorEmIso: "2026-10-05",
    reservaCent: R$(30000), maiorSaidaDoDia: "a folha",
  });
  assert.match(f, /abaixo da reserva em 05\/10/);
  assert.match(f, /por causa de a folha/);
});

test("apertar sem furar é uma frase diferente, e tranquilizadora", () => {
  const f = fraseDoCaixa({
    saldoHojeCent: R$(84320), menorCent: R$(40050), menorEmIso: "2026-10-05",
    reservaCent: R$(30000), maiorSaidaDoDia: "a folha",
  });
  assert.match(f, /aperta no dia 5/);
  assert.match(f, /continua acima da reserva mínima/);
});

test("com reserva em zero, o caixa 'fica negativo' — não 'abaixo da reserva'", () => {
  const f = fraseDoCaixa({
    saldoHojeCent: R$(500), menorCent: R$(-1500), menorEmIso: "2026-09-21",
    reservaCent: 0, maiorSaidaDoDia: "o aluguel",
  });
  assert.match(f, /fica negativo em 21\/09/);
  assert.doesNotMatch(f, /reserva/, "não existe reserva de R$ 0 para ficar abaixo");
  assert.match(f, /por causa de o aluguel/);
});

test("caixa estável não inventa drama", () => {
  const f = fraseDoCaixa({
    saldoHojeCent: R$(84320), menorCent: R$(80000), menorEmIso: "2026-10-05",
    reservaCent: R$(30000), maiorSaidaDoDia: null,
  });
  assert.equal(f, "O caixa se mantém estável nos próximos 30 dias.");
});

test("saldo zerado hoje não vira 'aperto': metade de zero não aperta", () => {
  const f = fraseDoCaixa({
    saldoHojeCent: 0, menorCent: 0, menorEmIso: "2026-10-05",
    reservaCent: 0, maiorSaidaDoDia: null,
  });
  assert.equal(f, "O caixa se mantém estável nos próximos 30 dias.");
});

test("sem projeção, a frase diz que não sabe", () => {
  const f = fraseDoCaixa({
    saldoHojeCent: R$(100), menorCent: null, menorEmIso: null,
    reservaCent: 0, maiorSaidaDoDia: null,
  });
  assert.match(f, /Ainda não há lançamentos suficientes/);
});

/* ── Frase da receita ──────────────────────────────────────────────────── */

test("a receita diz o percentual recorrente e quem depende de pontual", () => {
  const f = fraseDaReceita({
    pctRecorrente: 81, totalCent: R$(119000),
    servicos: [
      { nome: "Social Media", recorrenteCent: R$(52800), pontualCent: 0 },
      { nome: "Audiovisual", recorrenteCent: R$(12400), pontualCent: R$(14600) },
    ],
  });
  assert.match(f, /81% da receita é recorrente/);
  assert.match(f, /Audiovisual é o serviço que mais depende/);
});

test("serviço só entra na frase acima de 30% de pontual", () => {
  const f = fraseDaReceita({
    pctRecorrente: 95, totalCent: R$(100000),
    servicos: [{ nome: "Social Media", recorrenteCent: R$(9000), pontualCent: R$(1000) }],
  });
  assert.equal(f, "95% da receita é recorrente.", "10% de pontual não é dependência");
});

test("mês sem receita não recebe frase de composição", () => {
  assert.match(fraseDaReceita({ pctRecorrente: 0, totalCent: 0, servicos: [] }), /Ainda não há receita/);
});

/* ── Frase do resultado ────────────────────────────────────────────────── */

test("a sequência conta as altas, não os pontos", () => {
  assert.deepEqual(sequenciaDeResultado([10, 20, 30, 40]), { direcao: "alta", meses: 3 });
  assert.deepEqual(sequenciaDeResultado([40, 30, 20]), { direcao: "queda", meses: 2 });
  // Uma subida só ainda não é tendência: não pode virar "segundo mês seguido".
  assert.deepEqual(sequenciaDeResultado([10, 50, 20, 30]), { direcao: "alta", meses: 1 });
  assert.deepEqual(sequenciaDeResultado([10, 20]), { direcao: "alta", meses: 1 });
  assert.deepEqual(sequenciaDeResultado([10, 10]), { direcao: "estavel", meses: 0 });
  assert.deepEqual(sequenciaDeResultado([10]), { direcao: "estavel", meses: 0 });
});

test("os números do mockup dão 'Terceiro mês seguido de alta'", () => {
  // Resultados de abr a set do mockup (receita − custos), em centavos.
  const seq = sequenciaDeResultado(
    [27300, 30300, 25400, 35500, 36500, 41200].map((v) => v * 100),
  );
  assert.deepEqual(seq, { direcao: "alta", meses: 3 });
});

test("três altas seguidas viram 'Terceiro mês seguido'", () => {
  const f = fraseDoResultado({
    resultados: [R$(500), R$(1000), R$(2000), R$(3000)], mediaCent: R$(1625),
    mesEmCurso: true, desdeIso: null, mesesDisponiveis: 6,
  });
  assert.match(f, /Terceiro mês seguido de alta no resultado/);
  assert.match(f, /Mês ainda em curso/);
});

test("duas altas seguidas ainda são 'Segundo', não 'Terceiro'", () => {
  const f = fraseDoResultado({
    resultados: [R$(1000), R$(2000), R$(3000)], mediaCent: R$(2000),
    mesEmCurso: false, desdeIso: null, mesesDisponiveis: 6,
  });
  assert.match(f, /Segundo mês seguido de alta/);
});

test("uma subida isolada não vira tendência: cai na média do período", () => {
  const f = fraseDoResultado({
    resultados: [R$(3000), R$(1000), R$(5000)], mediaCent: R$(3000),
    mesEmCurso: false, desdeIso: null, mesesDisponiveis: 6,
  });
  assert.match(f, /acima da média do período/);
  assert.doesNotMatch(f, /seguido/);
});

test("histórico curto é declarado, em vez de fingir 6 meses", () => {
  const f = fraseDoResultado({
    resultados: [R$(1000), R$(2000)], mediaCent: R$(1500),
    mesEmCurso: false, desdeIso: "2026-08-01", mesesDisponiveis: 2,
  });
  assert.match(f, /Histórico a partir de agosto de 2026/);
});

test("mesPorExtenso escreve o mês por nome", () => {
  assert.equal(mesPorExtenso("2026-08-01"), "agosto de 2026");
  assert.equal(mesPorExtenso("2026-12-31"), "dezembro de 2026");
});

/* ── Frase dos gastos ──────────────────────────────────────────────────── */

test("'quase metade' só quando realmente é perto da metade", () => {
  const perto = fraseDosGastos({
    totalCent: R$(100000),
    grupos: [
      { nome: "Equipe de entrega", valorCent: R$(49000), acimaDoOrcado: false, pctDoOrcado: null },
      { nome: "Estrutura", valorCent: R$(51000), acimaDoOrcado: false, pctDoOrcado: null },
    ],
  });
  assert.match(perto, /Estrutura é quase metade de tudo que sai/);

  const longe = fraseDosGastos({
    totalCent: R$(100000),
    grupos: [
      { nome: "Equipe", valorCent: R$(80000), acimaDoOrcado: false, pctDoOrcado: null },
      { nome: "Estrutura", valorCent: R$(20000), acimaDoOrcado: false, pctDoOrcado: null },
    ],
  });
  assert.match(longe, /Equipe é 80% de tudo que sai/);
});

test("os estourados de orçamento entram na frase, e no plural certo", () => {
  const base = { valorCent: R$(10000), pctDoOrcado: 120 };
  const um = fraseDosGastos({
    totalCent: R$(20000),
    grupos: [
      { nome: "Softwares", acimaDoOrcado: true, ...base },
      { nome: "Estrutura", acimaDoOrcado: false, valorCent: R$(10000), pctDoOrcado: null },
    ],
  });
  assert.match(um, /Softwares está acima do orçado/);

  const dois = fraseDosGastos({
    totalCent: R$(20000),
    grupos: [
      { nome: "Softwares", acimaDoOrcado: true, ...base },
      { nome: "Estrutura", acimaDoOrcado: true, ...base },
    ],
  });
  assert.match(dois, /Softwares e Estrutura estão acima do orçado/);
});

/* ── Geometria do gráfico de linha ─────────────────────────────────────── */

test("a linha cabe na caixa, inclusive com saldo negativo", () => {
  const serie = [
    { dataIso: "2026-09-17", saldoCent: R$(-1500) },
    { dataIso: "2026-09-18", saldoCent: R$(500) },
    { dataIso: "2026-09-19", saldoCent: R$(3000) },
  ];
  const g = montarLinhaDoCaixa(serie, 0);
  assert.ok(g, "série de 3 pontos já desenha");
  for (const p of g!.pontos) {
    assert.ok(
      p.y >= CAIXA_CAIXA.topo - 0.5 && p.y <= CAIXA_CAIXA.base + 0.5,
      `ponto fora da caixa: y=${p.y}. Saldo negativo desenhado fora não avisa ninguém.`,
    );
    assert.ok(p.x >= CAIXA_CAIXA.esquerda - 0.5 && p.x <= CAIXA_CAIXA.largura);
  }
  assert.equal(g!.yReserva, null, "reserva zero não vira linha tracejada");
});

test("com reserva configurada, a linha dela também cabe", () => {
  const serie = Array.from({ length: 31 }, (_, i) => ({
    dataIso: `2026-09-${String(i + 1).padStart(2, "0")}`,
    saldoCent: R$(50000 + i * 1000),
  }));
  const g = montarLinhaDoCaixa(serie, R$(30000));
  assert.ok(g!.yReserva != null);
  assert.ok(g!.yReserva! >= CAIXA_CAIXA.topo && g!.yReserva! <= CAIXA_CAIXA.base);
  assert.equal(g!.pontos.length, 31);
  assert.ok(g!.grade.length >= 2, "o eixo precisa de pelo menos dois níveis");
});

test("série curta demais não vira gráfico", () => {
  assert.equal(montarLinhaDoCaixa([], 0), null);
  assert.equal(montarLinhaDoCaixa([{ dataIso: HOJE, saldoCent: 0 }], 0), null);
});

test("o rótulo do eixo é curto e sem centavo", () => {
  assert.equal(rotuloCurto(R$(120000)), "120 mil");
  assert.equal(rotuloCurto(0), "0");
  assert.equal(rotuloCurto(R$(-40000)), "−40 mil");
  assert.equal(rotuloCurto(R$(2_500_000)), "2,5 mi");
});

test("largura relativa nunca escapa de 0 a 100", () => {
  assert.equal(larguraRelativa(R$(50), R$(100)), 50);
  assert.equal(larguraRelativa(R$(200), R$(100)), 100, "não transborda o trilho");
  assert.equal(larguraRelativa(R$(-10), R$(100)), 0);
  assert.equal(larguraRelativa(R$(10), 0), 0, "sem maior, nada de dividir por zero");
});

/* ── Bloco 4 · ordem e rótulos (§8) ────────────────────────────────────── */

test("no mesmo dia, a saída vem antes da entrada", () => {
  const ordem = ordenarSemana([
    { dataIso: "2026-09-18", entrada: false, valorCent: R$(300) },
    { dataIso: "2026-09-17", entrada: true, valorCent: R$(4800) },
    { dataIso: "2026-09-17", entrada: false, valorCent: R$(449) },
    { dataIso: "2026-09-17", entrada: false, valorCent: R$(370) },
  ]).map((x) => [x.dataIso, x.entrada, x.valorCent / 100]);

  assert.deepEqual(ordem, [
    ["2026-09-17", false, 449],
    ["2026-09-17", false, 370],
    ["2026-09-17", true, 4800],
    ["2026-09-18", false, 300],
  ], "data asc, saída antes de entrada, valor desc — nessa ordem");
});

test("a coluna Data destaca hoje e amanhã pelo nome", () => {
  assert.equal(rotuloDaSemana(HOJE, HOJE), "Hoje");
  assert.equal(rotuloDaSemana("2026-09-18", HOJE), "Amanhã");
  // 21/09/2026 é uma segunda-feira.
  assert.equal(rotuloDaSemana("2026-09-21", HOJE), "Seg 21");
  assert.doesNotMatch(rotuloDaSemana("2026-09-21", HOJE), /\./, "o ponto de 'seg.' não cabe na coluna");
});
