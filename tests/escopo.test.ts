/**
 * Escopo meus/squad/todos.
 *
 * O botão "squad" existia nas duas telas e não filtrava nada — em VioFlux era
 * até o padrão. Um controle que não muda nada ensina a pessoa a desconfiar dos
 * outros controles.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { escoposUteis, noEscopo, normalizarEscopo } from "../src/lib/data/escopo.ts";

const meu = { ehMeu: true, squadId: "A" };
const doSquad = { ehMeu: false, squadId: "A" };
const deOutro = { ehMeu: false, squadId: "B" };

test("todos não esconde nada", () => {
  for (const i of [meu, doSquad, deOutro]) assert.equal(noEscopo("todos", i, "A"), true);
});

test("meus mostra só o que é meu", () => {
  assert.equal(noEscopo("meus", meu, "A"), true);
  assert.equal(noEscopo("meus", doSquad, "A"), false);
});

test("squad é diferente de todos — que era o bug", () => {
  assert.equal(noEscopo("squad", doSquad, "A"), true, "do meu squad, mesmo não sendo meu");
  assert.equal(noEscopo("squad", deOutro, "A"), false, "de outro squad fica de fora");
  assert.equal(noEscopo("squad", meu, "A"), true);
});

test("usuário sem squad não fica com a tela vazia", () => {
  // Melhor mostrar demais do que esconder tudo de quem só não teve o squad
  // preenchido no cadastro.
  assert.equal(noEscopo("squad", deOutro, null), true);
  assert.equal(noEscopo("squad", deOutro, undefined), true);
});

test("item sem squad não entra no squad de ninguém", () => {
  assert.equal(noEscopo("squad", { ehMeu: false, squadId: null }, "A"), false);
});

test("valor desconhecido cai em todos", () => {
  assert.equal(normalizarEscopo("inventado"), "todos");
  assert.equal(normalizarEscopo(null), "todos");
  assert.equal(normalizarEscopo("SQUAD"), "squad");
});

/* ── quando o botão merece existir ── */

test("com um squad só, o botão some", () => {
  // Era o caso da agência quando isto foi escrito: "squad" e "todos" davam
  // sempre o mesmo resultado.
  assert.deepStrictEqual(escoposUteis("A", ["A", "A", "A"]), ["meus", "todos"]);
});

test("com squads diferentes, o botão aparece", () => {
  assert.deepStrictEqual(escoposUteis("A", ["A", "B"]), ["meus", "squad", "todos"]);
});

test("usuário sem squad não vê o botão", () => {
  assert.deepStrictEqual(escoposUteis(null, ["A", "B"]), ["meus", "todos"]);
});
