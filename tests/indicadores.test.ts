/**
 * Indicadores sem amostra.
 *
 * Zero e "não medido" são coisas diferentes, e a tela tratava as duas igual —
 * com a agravante de pintar o zero de vermelho.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { legendaDaAmostra, textoDoIndicador, tomDoIndicador } from "../src/lib/data/indicadores.ts";

test("sem resposta mostra traço, não zero", () => {
  // NPS 0 é nota real e medíocre; média 0.0 numa escala de 1 a 5 é impossível.
  assert.equal(textoDoIndicador(0, 0), "—");
  assert.equal(textoDoIndicador(0, 0, 1), "—");
});

test("com amostra mostra o número", () => {
  assert.equal(textoDoIndicador(72, 10), "72");
  assert.equal(textoDoIndicador(4.25, 8, 1), "4.3");
  assert.equal(textoDoIndicador(-30, 5), "-30", "NPS negativo é válido");
});

test("zero medido de verdade continua aparecendo", () => {
  // Dez respostas com NPS exatamente 0 é informação, não ausência dela.
  assert.equal(textoDoIndicador(0, 10), "0");
});

test("valor inválido não vira NaN na tela", () => {
  assert.equal(textoDoIndicador(NaN, 5), "—");
  assert.equal(textoDoIndicador(0, NaN), "—");
});

test("sem amostra a cor é neutra", () => {
  // Vermelho em cima de um traço ainda comunica "ruim" para quem lê rápido.
  assert.equal(tomDoIndicador(0, "text-rose-500"), "text-muted");
  assert.equal(tomDoIndicador(3, "text-rose-500"), "text-rose-500");
});

test("a legenda usa plural certo e explica o vazio", () => {
  assert.equal(legendaDaAmostra(0, "resposta", "respostas", "sem respostas ainda"), "sem respostas ainda");
  assert.equal(legendaDaAmostra(1, "resposta", "respostas", "x"), "1 resposta");
  assert.equal(legendaDaAmostra(7, "resposta", "respostas", "x"), "7 respostas");
});
