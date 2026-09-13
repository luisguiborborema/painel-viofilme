/**
 * Base de conhecimento.
 *
 * O que se valida é o mínimo para a página servir a quem for ler depois: um
 * título que identifique e conteúdo que caiba. Página sem título vira um item
 * anônimo na lista que ninguém abre.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_CONTEUDO, MAX_TAGS, MAX_TITULO, categoriaValida, paginaValida,
} from "../src/lib/data/knowledge.ts";

const eq = (nome: string, a: unknown, b: unknown) =>
  test(nome, () => assert.deepStrictEqual(a, b));

/* ── página ── */

test("página comum", () => {
  const r = paginaValida({ title: "Como abrir um chamado", content: "Passo 1..." });
  assert.equal(r.ok, true);
  assert.equal((r as { pagina: { title: string } }).pagina.title, "Como abrir um chamado");
});

eq("título curto é recusado", paginaValida({ title: "ab" }).ok, false);
eq("sem título é recusado", paginaValida({}).ok, false);
eq("só espaço é recusado", paginaValida({ title: "   " }).ok, false);
eq("título gigante é recusado", paginaValida({ title: "x".repeat(MAX_TITULO + 1) }).ok, false);

test("conteúdo acima do limite é recusado antes do banco", () => {
  // Sem isto o Postgres responde "value too long", um 500 sem explicação.
  const r = paginaValida({ title: "Processo", content: "y".repeat(MAX_CONTEUDO + 1) });
  assert.equal(r.ok, false);
  assert.match((r as { erro: string }).erro, /limite/);
});

test("página pode nascer só com título", () => {
  // Rascunho é uso legítimo: escreve o título hoje, o conteúdo depois.
  const r = paginaValida({ title: "A escrever" });
  assert.equal(r.ok, true);
  assert.equal((r as { pagina: { content: string | null } }).pagina.content, null);
});

/* ── tags ── */

test("tags viram minúsculas, sem repetição nem vazias", () => {
  const r = paginaValida({ title: "Processo", tags: ["Vendas", "vendas", "  ", "CS", "cs "] });
  assert.deepStrictEqual((r as { pagina: { tags: string[] } }).pagina.tags, ["vendas", "cs"]);
});

test("excesso de tags é cortado", () => {
  const muitas = Array.from({ length: 50 }, (_, i) => `t${i}`);
  const r = paginaValida({ title: "Processo", tags: muitas });
  assert.equal((r as { pagina: { tags: string[] } }).pagina.tags.length, MAX_TAGS);
});

/* ── vídeo ── */

test("link de vídeo precisa ser http", () => {
  const bom = paginaValida({ title: "Processo", videoUrl: "https://youtu.be/abc" });
  assert.equal((bom as { pagina: { videoUrl: string | null } }).pagina.videoUrl, "https://youtu.be/abc");
  // Um "javascript:" gravado aqui viraria link clicável na tela de quem lê.
  const ruim = paginaValida({ title: "Processo", videoUrl: "javascript:alert(1)" });
  assert.equal((ruim as { pagina: { videoUrl: string | null } }).pagina.videoUrl, null);
});

/* ── categoria ── */

eq("categoria comum", categoriaValida("Processos", "#ff0000"), { ok: true, nome: "Processos", cor: "#ff0000" });
eq("nome curto é recusado", categoriaValida("a", "#ff0000").ok, false);
eq("cor inválida cai no padrão", categoriaValida("Processos", "vermelho"), { ok: true, nome: "Processos", cor: "#2a63c9" });
eq("sem cor cai no padrão", categoriaValida("Processos", undefined), { ok: true, nome: "Processos", cor: "#2a63c9" });
