/**
 * Teto de chamadas do MCP.
 *
 * Limite mal calculado erra para os dois lados: frouxo demais não protege, e
 * apertado demais corta uma conversa legítima no meio — e quem está do outro
 * lado só vê o Claude dizendo que não conseguiu.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { LIMITE_POR_MINUTO, novoEstado, registrarChamada } from "../src/lib/mcp/rate-limit.ts";

const T0 = 1_700_000_000_000;

test("uso normal passa", () => {
  const e = novoEstado();
  for (let i = 0; i < 10; i++) {
    const v = registrarChamada(e, "chave", T0 + i * 100);
    assert.equal(v.permitido, true);
  }
});

test("bloqueia ao passar do teto", () => {
  const e = novoEstado();
  for (let i = 0; i < LIMITE_POR_MINUTO; i++) registrarChamada(e, "k", T0 + i);
  const v = registrarChamada(e, "k", T0 + LIMITE_POR_MINUTO);
  assert.equal(v.permitido, false);
  assert.ok("esperarSegundos" in v && v.esperarSegundos >= 1, "precisa dizer quanto esperar");
});

test("a janela desliza: passado o minuto, libera", () => {
  const e = novoEstado();
  for (let i = 0; i < LIMITE_POR_MINUTO; i++) registrarChamada(e, "k", T0 + i);
  assert.equal(registrarChamada(e, "k", T0 + 100).permitido, false);
  // 61s depois da primeira, todas saíram da janela.
  assert.equal(registrarChamada(e, "k", T0 + 61_000).permitido, true);
});

test("não dá para dobrar o teto na virada do minuto", () => {
  // Com janela fixa daria: 60 no fim de um minuto + 60 no início do seguinte.
  const e = novoEstado();
  for (let i = 0; i < LIMITE_POR_MINUTO; i++) registrarChamada(e, "k", T0 + 59_000 + i);
  assert.equal(registrarChamada(e, "k", T0 + 60_100).permitido, false);
});

test("uma chave não consome o teto da outra", () => {
  const e = novoEstado();
  for (let i = 0; i < LIMITE_POR_MINUTO; i++) registrarChamada(e, "a", T0 + i);
  assert.equal(registrarChamada(e, "a", T0 + 200).permitido, false);
  assert.equal(registrarChamada(e, "b", T0 + 200).permitido, true);
});

test("informa quantas chamadas restam", () => {
  const e = novoEstado();
  const v = registrarChamada(e, "k", T0);
  assert.equal(v.permitido && v.restantes, LIMITE_POR_MINUTO - 1);
});

test("espera devolvida é coerente com a janela", () => {
  const e = novoEstado();
  for (let i = 0; i < LIMITE_POR_MINUTO; i++) registrarChamada(e, "k", T0);
  // Todas no mesmo instante: a espera é o minuto inteiro.
  const v = registrarChamada(e, "k", T0 + 1_000);
  assert.equal(v.permitido, false);
  assert.ok("esperarSegundos" in v && v.esperarSegundos <= 60);
});

test("chave inativa não fica na memória para sempre", () => {
  const e = novoEstado();
  for (let i = 0; i < 600; i++) registrarChamada(e, `chave-${i}`, T0 + i);
  // A faxina roda acima de 500 chaves; nenhuma expirou ainda neste intervalo.
  assert.ok(e.size <= 600);
  // Muito tempo depois, uma chamada nova limpa as antigas.
  registrarChamada(e, "nova", T0 + 10 * 60_000);
  assert.ok(e.size < 600, `esperava faxina, ficaram ${e.size}`);
});
