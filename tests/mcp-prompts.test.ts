/**
 * Análises prontas do MCP.
 *
 * Um prompt que depende de uma área fechada falharia no meio — depois de já
 * ter começado a responder, com o usuário esperando. Por isso a filtragem por
 * escopo importa tanto quanto a das ferramentas.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PROMPTS, promptsPermitidos } from "../src/lib/mcp/prompts.ts";
import { DOMINIOS } from "../src/lib/data/api-keys.ts";

const eq = (nome: string, a: unknown, b: unknown) =>
  test(nome, () => assert.deepStrictEqual(a, b));

test("todo prompt exige áreas que existem", () => {
  const areas = new Set(DOMINIOS.map((d) => d.key));
  for (const p of PROMPTS) {
    for (const r of p.requer) assert.ok(areas.has(r), `${p.name} exige área inexistente: ${r}`);
    assert.ok(p.requer.length > 0, `${p.name} não declara área`);
  }
});

test("chave sem restrição vê todos", () => {
  assert.equal(promptsPermitidos([]).length, PROMPTS.length);
});

test("chave só de conteúdo não vê o fechamento financeiro", () => {
  const nomes = promptsPermitidos(["conteudo"]).map((p) => p.name);
  assert.ok(nomes.includes("falta_na_linha_editorial"));
  assert.ok(!nomes.includes("fechamento_do_mes"));
  assert.ok(!nomes.includes("quem_cobrar_hoje"));
});

test("prompt que cruza áreas exige as duas", () => {
  // "saude_da_carteira" precisa de clientes E financeiro.
  assert.ok(!promptsPermitidos(["clientes"]).some((p) => p.name === "saude_da_carteira"));
  assert.ok(!promptsPermitidos(["financeiro"]).some((p) => p.name === "saude_da_carteira"));
  assert.ok(promptsPermitidos(["clientes", "financeiro"]).some((p) => p.name === "saude_da_carteira"));
});

test("o texto cita as ferramentas que manda usar", () => {
  // Sem isso o prompt vira conselho vago e o Claude escolhe sozinho.
  for (const p of PROMPTS) {
    const texto = p.montar({});
    assert.match(texto, /`[a-z_]+`/, `${p.name} não cita ferramenta nenhuma`);
    assert.ok(texto.length > 200, `${p.name} é curto demais para orientar`);
  }
});

test("argumento opcional muda o texto", () => {
  const p = PROMPTS.find((x) => x.name === "falta_na_linha_editorial")!;
  assert.ok(!p.montar({}).includes('client="'));
  assert.match(p.montar({ cliente: "Padaria" }), /Padaria/);
});

eq("nomes únicos", new Set(PROMPTS.map((p) => p.name)).size, PROMPTS.length);
eq("nomes em snake_case", PROMPTS.filter((p) => !/^[a-z][a-z0-9_]*$/.test(p.name)).map((p) => p.name), []);
