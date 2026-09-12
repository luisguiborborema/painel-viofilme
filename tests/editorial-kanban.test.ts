/**
 * Kanban da linha editorial.
 *
 * Duas regras carregam o fluxo novo: o que torna um card "pronto" (porque post
 * publicado com campo em branco é retrabalho do social media) e quantos cards a
 * etapa 1 cria (porque errar aqui enche a tela de card vazio ou deixa faltando).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COLUNAS, MAX_POR_TIPO, QUANTIDADES_ZERADAS, TIPOS,
  camposFaltando, cardPronto, descreverPendencias, normalizarQuantidade,
  planejarCards, quantidadesSugeridas, tipoDoPost, totalDeCards,
} from "../src/lib/data/editorial-kanban.ts";

const eq = (nome: string, a: unknown, b: unknown) =>
  test(nome, () => assert.deepStrictEqual(JSON.parse(JSON.stringify(a ?? null)), JSON.parse(JSON.stringify(b ?? null))));

const completo = {
  title: "Rotina de treino",
  description: "gancho, desenvolvimento, CTA",
  deliveryDate: "2026-09-23",
  postDateIso: "2026-09-30",
  assignee: "gustavo",
};

/* ── card pronto ── */

eq("card completo está pronto", cardPronto(completo), true);
eq("card vazio lista tudo que falta", camposFaltando({}),
  ["Título", "Roteiro", "Data de entrega", "Data de postagem", "Responsável"]);

eq("sem roteiro não está pronto", cardPronto({ ...completo, description: "" }), false);
eq("sem responsável não está pronto", cardPronto({ ...completo, assignee: "" }), false);
eq("sem data de entrega não está pronto", cardPronto({ ...completo, deliveryDate: null }), false);

// Link de referência é o único opcional — está no briefing e faz sentido:
// nem todo post nasce de uma referência visual.
eq("sem link de referência continua pronto", cardPronto(completo), true);

eq("só espaço não conta como preenchido", camposFaltando({ ...completo, title: "   " }), ["Título"]);

eq("uma pendência", descreverPendencias({ ...completo, description: "" }), "falta Roteiro");
eq("duas pendências", descreverPendencias({ ...completo, description: "", assignee: "" }),
  "faltam Roteiro e Responsável");
eq("três pendências", descreverPendencias({ ...completo, title: "", description: "", assignee: "" }),
  "faltam Título, Roteiro e Responsável");
eq("card pronto não tem frase", descreverPendencias(completo), null);

/* ── colunas ── */

eq("cinco colunas", COLUNAS.length, 5);
eq("ordem das colunas", TIPOS, ["Reels", "Carrossel", "Feed", "Stories", "Extra"]);

eq("formato conhecido", tipoDoPost("Reels"), "Reels");
// Post antigo com formato que não existe mais não pode sumir da tela: cai em
// Extras, onde alguém vê e decide o que fazer.
eq("formato desconhecido cai em Extras", tipoDoPost("Boomerang"), "Extra");
eq("formato nulo cai em Extras", tipoDoPost(null), "Extra");

/* ── quantidades sugeridas ── */

const contrato = [
  { format: "Reels", monthlyQty: 4 },
  { format: "Carrossel", monthlyQty: 4 },
  { format: "Feed", monthlyQty: 4 },
  { format: "Stories", monthlyQty: 8 },
];

test("mês novo sugere o contrato inteiro", () => {
  const q = quantidadesSugeridas(contrato);
  assert.deepStrictEqual(q, { Reels: 4, Carrossel: 4, Feed: 4, Stories: 8, Extra: 0 });
});

test("linha em andamento sugere só o que falta", () => {
  const q = quantidadesSugeridas(contrato, [
    { format: "Reels" }, { format: "Reels" }, { format: "Carrossel" },
  ]);
  assert.deepStrictEqual(q, { Reels: 2, Carrossel: 3, Feed: 4, Stories: 8, Extra: 0 });
});

test("entregar além do contrato não sugere número negativo", () => {
  const q = quantidadesSugeridas([{ format: "Reels", monthlyQty: 2 }], [
    { format: "Reels" }, { format: "Reels" }, { format: "Reels" },
  ]);
  assert.equal(q.Reels, 0);
});

eq("sem contrato, tudo zero", quantidadesSugeridas([]), QUANTIDADES_ZERADAS());
// Extras é exceção pedida, não planejada: nunca nasce preenchido.
eq("Extras nunca é sugerido", quantidadesSugeridas([{ format: "Extra", monthlyQty: 5 }]).Extra, 0);

/* ── criação dos cards ── */

test("cria na ordem das colunas, numerando em sequência", () => {
  const cards = planejarCards({ Reels: 2, Carrossel: 1, Feed: 0, Stories: 0, Extra: 1 });
  assert.deepStrictEqual(cards, [
    { n: 1, format: "Reels" },
    { n: 2, format: "Reels" },
    { n: 3, format: "Carrossel" },
    { n: 4, format: "Extra" },
  ]);
});

test("continua a numeração da linha existente", () => {
  const cards = planejarCards({ Reels: 1, Carrossel: 0, Feed: 1, Stories: 0, Extra: 0 }, 12);
  assert.deepStrictEqual(cards.map((c) => c.n), [12, 13]);
});

eq("nada marcado não cria nada", planejarCards(QUANTIDADES_ZERADAS()), []);
eq("total soma os tipos", totalDeCards({ Reels: 3, Carrossel: 4, Feed: 4, Stories: 0, Extra: 1 }), 12);

/* ── proteção contra engano ── */

eq("negativo vira zero", normalizarQuantidade(-3), 0);
eq("texto vira zero", normalizarQuantidade("abc"), 0);
eq("fracionário arredonda", normalizarQuantidade(2.6), 3);
// Digitar 999 por engano encheria a tela de card vazio — e apagar um a um.
eq("acima do teto é limitado", normalizarQuantidade(999), MAX_POR_TIPO);
eq("total respeita o teto", totalDeCards({ Reels: 999, Carrossel: 0, Feed: 0, Stories: 0, Extra: 0 }), MAX_POR_TIPO);
