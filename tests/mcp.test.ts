/**
 * Catálogo de ferramentas do MCP.
 *
 * O que uma IA consegue fazer com o painel depende inteiramente do `name`, da
 * `description` e do schema de cada ferramenta — é o único contrato que ela lê.
 * Nome duplicado, descrição vazia ou schema frouxo não quebram nada no build:
 * viram uma ferramenta que o Claude chama errado, ou nem chama.
 *
 * O arquivo é lido como texto porque `tools.ts` importa módulos server-only,
 * que não carregam fora do Next.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(import.meta.dirname, "..", "src", "lib", "mcp", "tools.ts"), "utf8");

type Ferramenta = { name: string; title: string; description: string; schema: string };

function ferramentas(): Ferramenta[] {
  const out: Ferramenta[] = [];
  const re = /\{\s*name:\s*"([a-z0-9_]+)",\s*title:\s*"([^"]*)",\s*description:\s*([^]*?),\s*inputSchema:\s*(\{[^]*?\n    \}),/g;
  for (const m of src.matchAll(re)) {
    out.push({ name: m[1], title: m[2], description: m[3], schema: m[4] });
  }
  return out;
}

const TOOLS = ferramentas();

test("o catálogo foi lido", () => {
  assert.ok(TOOLS.length >= 15, `esperava 15+ ferramentas, li ${TOOLS.length} — o padrão de leitura pode ter quebrado`);
});

test("nomes são únicos", () => {
  const vistos = new Set<string>();
  const repetidos = TOOLS.filter((t) => (vistos.has(t.name) ? true : (vistos.add(t.name), false)));
  assert.deepStrictEqual(repetidos.map((t) => t.name), [], "nome duplicado sobrescreve a ferramenta anterior no mapa");
});

test("nomes seguem snake_case", () => {
  const fora = TOOLS.filter((t) => !/^[a-z][a-z0-9_]*$/.test(t.name)).map((t) => t.name);
  assert.deepStrictEqual(fora, []);
});

test("toda ferramenta tem título e descrição úteis", () => {
  for (const t of TOOLS) {
    assert.ok(t.title.length >= 3, `${t.name}: título curto demais`);
    // A descrição é o que faz o Claude escolher a ferramenta certa.
    const texto = t.description.replace(/\s+/g, " ");
    assert.ok(texto.length >= 40, `${t.name}: descrição curta demais para orientar a escolha`);
  }
});

test("todo schema é fechado a campos extras", () => {
  // Sem additionalProperties:false, um argumento inventado passa em silêncio.
  const frouxos = TOOLS.filter((t) => !t.schema.includes("additionalProperties: false")).map((t) => t.name);
  assert.deepStrictEqual(frouxos, []);
});

test("todo schema declara type: object", () => {
  const fora = TOOLS.filter((t) => !t.schema.includes('type: "object"')).map((t) => t.name);
  assert.deepStrictEqual(fora, []);
});

test("nenhuma ferramenta escreve no banco", () => {
  // O MCP é somente leitura: o token dá acesso a tudo, sem sessão de usuário.
  const escritas = [...src.matchAll(/\.(insert|update|upsert|delete|rpc)\s*\(/g)].map((m) => m[1]);
  assert.deepStrictEqual([...new Set(escritas)], [], `operação de escrita encontrada em tools.ts: ${escritas.join(", ")}`);
});

test("as ferramentas do financeiro novo estão publicadas", () => {
  // Construído no painel mas ausente do MCP = a IA responde com dado velho.
  const nomes = new Set(TOOLS.map((t) => t.name));
  for (const esperada of [
    "dre", "aging_receivables", "financial_indicators",
    "budget_vs_actual", "cashflow_forecast", "reconciliation_status",
  ]) {
    assert.ok(nomes.has(esperada), `falta a ferramenta ${esperada}`);
  }
});
