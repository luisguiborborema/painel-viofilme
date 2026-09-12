/**
 * Linha do tempo das postagens.
 *
 * Barra mal posicionada não dá erro: ela desenha, e a pessoa lê um prazo que
 * não existe. Como a barra vai de "entrega" a "postagem", errar aqui é errar
 * sobre quando o conteúdo precisa estar pronto.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  agruparBarras, barraDoPost, cargaPorSemana, ddmm, diasEntre,
  janelaDaTimeline, semData, somarDias,
} from "../src/lib/data/editorial-timeline.ts";

const eq = (nome: string, a: unknown, b: unknown) =>
  test(nome, () => assert.deepStrictEqual(JSON.parse(JSON.stringify(a ?? null)), JSON.parse(JSON.stringify(b ?? null))));

const post = (over: Partial<Parameters<typeof barraDoPost>[0]> = {}) => ({
  id: "p1", n: 1, titulo: "Post", tipo: "Reels",
  entrega: "2026-09-23", postagem: "2026-09-30", responsavel: "gustavo",
  ...over,
});

/* ── datas ── */

eq("dias entre", diasEntre("2026-09-23", "2026-09-30"), 7);
eq("mesma data", diasEntre("2026-09-23", "2026-09-23"), 0);
eq("ordem invertida é negativa", diasEntre("2026-09-30", "2026-09-23"), -7);
eq("vira o mês", diasEntre("2026-09-28", "2026-10-02"), 4);
eq("somar dias vira o mês", somarDias("2026-09-30", 1), "2026-10-01");
eq("somar negativo volta", somarDias("2026-10-01", -1), "2026-09-30");
eq("formato curto", ddmm("2026-09-23"), "23/09");

/* ── janela ── */

test("cobre todas as datas com uma folga em cada ponta", () => {
  const j = janelaDaTimeline([post(), post({ entrega: "2026-10-05", postagem: "2026-10-12" })])!;
  assert.equal(j.inicio, "2026-09-22", "um dia antes da entrega mais cedo");
  assert.equal(j.fim, "2026-10-13", "um dia depois da postagem mais tarde");
});

test("a janela começa antes do mês da linha editorial", () => {
  // Produção de outubro começa em setembro: uma timeline presa ao mês de
  // referência cortaria justamente as entregas.
  const j = janelaDaTimeline([post({ entrega: "2026-09-23", postagem: "2026-10-02" })])!;
  assert.ok(j.inicio < "2026-10-01");
});

eq("sem posts não há janela", janelaDaTimeline([]), null);
eq("posts sem data não geram janela", janelaDaTimeline([post({ entrega: null, postagem: null })]), null);

test("as divisórias caem na segunda-feira", () => {
  const j = janelaDaTimeline([post({ entrega: "2026-09-21", postagem: "2026-10-12" })])!;
  for (const s of j.semanas) {
    assert.equal(new Date(`${s.iso}T00:00:00Z`).getUTCDay(), 1, `${s.iso} não é segunda`);
  }
  assert.ok(j.semanas.length >= 3);
});

test("hoje aparece se estiver dentro da janela", () => {
  const j = janelaDaTimeline([post()], "2026-09-25")!;
  assert.ok(j.hoje && j.hoje.left > 0 && j.hoje.left < 100);
});

test("hoje fora da janela não é marcado", () => {
  assert.equal(janelaDaTimeline([post()], "2027-01-01")!.hoje, null);
});

/* ── barras ── */

test("a barra cobre da entrega à postagem, incluindo o dia final", () => {
  const j = janelaDaTimeline([post()], "2026-09-25")!;
  const b = barraDoPost(post(), j)!;
  assert.equal(b.inicio, "2026-09-23");
  assert.equal(b.fim, "2026-09-30");
  assert.equal(b.folgaDias, 7);
  assert.ok(b.left > 0 && b.width > 0);
  assert.ok(b.left + b.width <= 100.01, "a barra não pode passar da janela");
});

test("só uma data vira marco de um dia", () => {
  const p = post({ entrega: "2026-09-23", postagem: null });
  const j = janelaDaTimeline([p])!;
  const b = barraDoPost(p, j)!;
  assert.equal(b.pontual, true);
  assert.equal(b.folgaDias, null);
  assert.ok(b.width > 0, "marco ainda precisa ser visível");
});

test("entrega depois da postagem é desenhada e sinalizada", () => {
  // Some seria pior: é justamente o caso que precisa ser visto e corrigido.
  const p = post({ entrega: "2026-10-05", postagem: "2026-09-30" });
  const j = janelaDaTimeline([p])!;
  const b = barraDoPost(p, j)!;
  assert.equal(b.invertida, true);
  assert.equal(b.inicio, "2026-09-30", "desenha do menor para o maior");
  assert.equal(b.folgaDias, null);
});

eq("post sem data nenhuma não vira barra",
  barraDoPost(post({ entrega: null, postagem: null }), janelaDaTimeline([post()])!), null);

test("entrega e postagem no mesmo dia ainda tem largura", () => {
  const p = post({ entrega: "2026-09-30", postagem: "2026-09-30" });
  const j = janelaDaTimeline([p])!;
  const b = barraDoPost(p, j)!;
  assert.ok(b.width > 0);
  assert.equal(b.folgaDias, 0);
});

/* ── agrupamento ── */

test("agrupa por tipo na ordem das colunas", () => {
  const posts = [
    post({ id: "a", tipo: "Feed" }),
    post({ id: "b", tipo: "Reels" }),
    post({ id: "c", tipo: "Carrossel" }),
  ];
  const j = janelaDaTimeline(posts)!;
  const linhas = agruparBarras(posts, j, "tipo", ["Reels", "Carrossel", "Feed", "Stories", "Extra"]);
  assert.deepStrictEqual(linhas.map((l) => l.chave), ["Reels", "Carrossel", "Feed"]);
});

test("sem responsável vai para o fim — é pendência, não pessoa", () => {
  const posts = [
    post({ id: "a", responsavel: null }),
    post({ id: "b", responsavel: "ana" }),
    post({ id: "c", responsavel: "bruno" }),
  ];
  const j = janelaDaTimeline(posts)!;
  const linhas = agruparBarras(posts, j, "responsavel");
  assert.equal(linhas.at(-1)!.chave, "— sem responsável");
  assert.deepStrictEqual(linhas.slice(0, 2).map((l) => l.chave), ["ana", "bruno"]);
});

test("dentro da linha, as barras saem em ordem de data", () => {
  const posts = [
    post({ id: "a", entrega: "2026-10-01", postagem: "2026-10-08" }),
    post({ id: "b", entrega: "2026-09-23", postagem: "2026-09-30" }),
  ];
  const j = janelaDaTimeline(posts)!;
  const [linha] = agruparBarras(posts, j, "tipo", ["Reels"]);
  assert.deepStrictEqual(linha.barras.map((b) => b.post.id), ["b", "a"]);
});

/* ── o que a timeline existe para mostrar ── */

test("carga por semana revela o dia sobrecarregado", () => {
  // Cinco entregas na mesma semana é problema de capacidade que o kanban não
  // denuncia — todas aparecem como cards iguais em colunas diferentes.
  const posts = [
    post({ id: "1", entrega: "2026-09-23" }), post({ id: "2", entrega: "2026-09-24" }),
    post({ id: "3", entrega: "2026-09-25" }), post({ id: "4", entrega: "2026-09-30" }),
  ];
  assert.deepStrictEqual(cargaPorSemana(posts), [
    { semana: "2026-09-21", entregas: 3 },
    { semana: "2026-09-28", entregas: 1 },
  ]);
});

eq("posts sem data ficam listados à parte",
  semData([post(), post({ id: "x", entrega: null, postagem: null })]).map((p) => p.id), ["x"]);
