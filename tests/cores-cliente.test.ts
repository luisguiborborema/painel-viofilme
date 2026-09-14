/**
 * Cor de cliente no Painel de Entregas.
 *
 * A cor é como o time lê o Calendário e o Kanban. Se ela troca sozinha, o
 * quadro continua bonito e passa a informar errado — que é pior do que não
 * informar.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { CLIENT_PALETTE, corDoCliente } from "../src/lib/data/cores-cliente.ts";

test("a cor não depende de quem mais tem tarefa", () => {
  // O caso real: a lista era ["APPTO","JEQUITIBÁ"] e virou
  // ["APPTO","BNEX","JEQUITIBÁ"] quando o BNEX ganhou a primeira tarefa. Pelo
  // índice, o Jequitibá trocava de cor. Aqui o nome decide, então não troca.
  const so = corDoCliente("JEQUITIBÁ");
  const comVizinhoNovo = corDoCliente("JEQUITIBÁ");
  assert.equal(so, comVizinhoNovo);
  assert.notEqual(corDoCliente("APPTO"), undefined);
});

test("determinística e dentro da paleta", () => {
  for (const c of ["APPTO", "BNEX", "JEQUITIBÁ", "DI MANGIARE", "BOX2RUN", "x"]) {
    const cor = corDoCliente(c);
    assert.ok(CLIENT_PALETTE.includes(cor), `${c} -> ${cor} fora da paleta`);
    assert.equal(cor, corDoCliente(c));
  }
});

test("espalha razoavelmente entre os clientes reais", () => {
  const nomes = ["APPTO", "BNEX", "BOX2RUN", "DI MANGIARE", "DIZC", "JEQUITIBÁ"];
  const cores = new Set(nomes.map(corDoCliente));
  assert.ok(cores.size >= 4, `só ${cores.size} cores distintas para ${nomes.length} clientes`);
});

test("nome vazio não quebra", () => {
  assert.ok(CLIENT_PALETTE.includes(corDoCliente("")));
});

test("acento e caixa são nomes distintos, como no cadastro", () => {
  // Não normalizamos: o nome vem do cadastro e é usado como está no quadro.
  assert.equal(corDoCliente("APPTO"), corDoCliente("APPTO"));
});
