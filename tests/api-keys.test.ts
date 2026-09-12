/**
 * Chaves de API.
 *
 * Uma chave dá leitura de tudo pelo MCP. O que se testa aqui é o que impede a
 * lista de virar um monte de chave anônima que ninguém ousa revogar — e o
 * recorte do prefixo, que é a única parte do token que sobrevive à criação.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { desde, nomeValido, prefixoDe, situacao, PREFIXO } from "../src/lib/data/api-keys.ts";

const eq = (nome: string, a: unknown, b: unknown) =>
  test(nome, () => assert.deepStrictEqual(JSON.parse(JSON.stringify(a ?? null)), JSON.parse(JSON.stringify(b ?? null))));

/* ── nome ── */

eq("nome comum", nomeValido("Claude do Guilherme"), { ok: true, nome: "Claude do Guilherme" });
eq("apara espaços", nomeValido("  Time  "), { ok: true, nome: "Time" });
eq("curto demais é recusado", nomeValido("ab").ok, false);
eq("vazio é recusado", nomeValido("").ok, false);
eq("só espaço é recusado", nomeValido("    ").ok, false);
eq("ausente é recusado", nomeValido(undefined).ok, false);
eq("longo demais é recusado", nomeValido("x".repeat(61)).ok, false);
eq("no limite passa", nomeValido("x".repeat(60)).ok, true);

/* ── prefixo visível ── */

test("prefixo identifica a origem e mostra pouco do token", () => {
  const token = `${PREFIXO}a1b2c3d4e5f6a7b8c9d0`;
  const p = prefixoDe(token);
  assert.ok(p.startsWith(PREFIXO), "tem de começar com vio_");
  assert.equal(p, "vio_a1b2c3");
  // O que sobra guardado não pode ser suficiente para reconstruir a chave.
  assert.ok(p.length < token.length / 2, "prefixo revelaria demais");
});

/* ── situação ── */

eq("revogada", situacao({ revokedAt: "2026-09-01T00:00:00Z", lastUsedAt: "2026-08-01T00:00:00Z" }), "revogada");
eq("revogada vence sobre uso recente", situacao({ revokedAt: "2026-09-01T00:00:00Z", lastUsedAt: null }), "revogada");
eq("ativa", situacao({ revokedAt: null, lastUsedAt: "2026-09-01T00:00:00Z" }), "ativa");
eq("criada e nunca usada", situacao({ revokedAt: null, lastUsedAt: null }), "nunca usada");

/* ── último uso ── */

const agora = new Date("2026-09-11T12:00:00Z");
eq("nunca usada", desde(null, agora), "nunca");
eq("agora há pouco", desde("2026-09-11T11:59:30Z", agora), "agora há pouco");
eq("minutos", desde("2026-09-11T11:20:00Z", agora), "há 40 min");
eq("horas", desde("2026-09-11T06:00:00Z", agora), "há 6h");
eq("um dia", desde("2026-09-10T06:00:00Z", agora), "há 1 dia");
eq("dias no plural", desde("2026-09-05T12:00:00Z", agora), "há 6 dias");
eq("meses", desde("2026-06-11T12:00:00Z", agora), "há 3 meses");
eq("um mês no singular", desde("2026-08-05T12:00:00Z", agora), "há 1 mês");

/* ── escopos: o que cada chave alcança ── */
import {
  DOMINIOS, ferramentasPermitidas, liberaTudo, normalizarEscopos,
  podeUsarFerramenta, rotuloEscopos, TOOL_BUSCA,
} from "../src/lib/data/api-keys.ts";

const TODAS = DOMINIOS.flatMap((d) => d.tools).concat(TOOL_BUSCA);

// Chave antiga (array vazio) tem de continuar lendo tudo — foi assim que ela
// foi criada, e restringir retroativamente quebraria integrações em uso.
eq("vazio libera tudo", liberaTudo([]), true);
eq("nulo libera tudo", liberaTudo(null), true);
eq("com área definida não libera tudo", liberaTudo(["financeiro"]), false);
eq("sem escopo, todas as ferramentas aparecem", ferramentasPermitidas(TODAS, []).length, TODAS.length);

test("chave de conteúdo não alcança o financeiro nem o funil", () => {
  const s = ["conteudo"];
  assert.equal(podeUsarFerramenta("editorial_pending", s), true);
  assert.equal(podeUsarFerramenta("content_calendar", s), true);
  assert.equal(podeUsarFerramenta("dre", s), false);
  assert.equal(podeUsarFerramenta("pipeline_summary", s), false);
  // A busca cruza clientes e negócios — conteúdo sozinho não abre essa porta.
  assert.equal(podeUsarFerramenta(TOOL_BUSCA, s), false);
});

test("chave só de marketing não alcança o financeiro", () => {
  const s = ["marketing"];
  assert.equal(podeUsarFerramenta("campaign_results", s), true);
  assert.equal(podeUsarFerramenta("nps_summary", s), true);
  for (const t of DOMINIOS.find((d) => d.key === "financeiro")!.tools) {
    assert.equal(podeUsarFerramenta(t, s), false, `${t} não deveria ser alcançável`);
  }
});

test("financeiro não dá acesso ao funil nem à carteira", () => {
  const s = ["financeiro"];
  assert.equal(podeUsarFerramenta("dre", s), true);
  assert.equal(podeUsarFerramenta("pipeline_summary", s), false);
  assert.equal(podeUsarFerramenta("list_clients", s), false);
});

test("busca só aparece para quem lê clientes ou comercial", () => {
  // A busca cruza áreas: liberá-la para uma chave de marketing exporia a
  // mensalidade dos clientes por outro caminho.
  assert.equal(podeUsarFerramenta(TOOL_BUSCA, ["marketing"]), false);
  assert.equal(podeUsarFerramenta(TOOL_BUSCA, ["financeiro"]), false);
  assert.equal(podeUsarFerramenta(TOOL_BUSCA, ["clientes"]), true);
  assert.equal(podeUsarFerramenta(TOOL_BUSCA, ["comercial"]), true);
});

eq("ferramenta inexistente nunca é liberada", podeUsarFerramenta("apagar_tudo", ["financeiro"]), false);

test("toda ferramenta do MCP pertence a algum domínio", () => {
  // Ferramenta órfã ficaria invisível para qualquer chave com escopo — some da
  // lista sem ninguém perceber.
  const src = readFileSync(join(import.meta.dirname, "..", "src", "lib", "mcp", "tools.ts"), "utf8");
  const nomes = [...src.matchAll(/^\s{4}name: "([a-z0-9_]+)",$/gm)].map((m) => m[1]);
  assert.ok(nomes.length >= 15, `li ${nomes.length} ferramentas — padrão de leitura pode ter quebrado`);
  const cobertas = new Set(TODAS);
  const orfas = nomes.filter((n) => !cobertas.has(n));
  assert.deepStrictEqual(orfas, [], `ferramentas sem domínio: ${orfas.join(", ")}`);
});

/* ── normalização ── */

eq("descarta área inventada", normalizarEscopos(["financeiro", "inventada"]), ["financeiro"]);
eq("remove repetidas", normalizarEscopos(["financeiro", "financeiro"]), ["financeiro"]);
eq("não é array", normalizarEscopos("financeiro"), []);
// Marcar tudo é o mesmo que não restringir: guardar vazio faz a chave valer
// também para uma área criada depois.
eq("todas as áreas viram vazio", normalizarEscopos(DOMINIOS.map((d) => d.key)), []);

eq("rótulo de acesso total", rotuloEscopos([]), "tudo");
eq("rótulo de uma área", rotuloEscopos(["financeiro"]), "Financeiro");
eq("rótulo de nenhuma válida", rotuloEscopos(["inventada"]), "nada");
