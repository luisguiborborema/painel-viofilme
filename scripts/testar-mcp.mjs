#!/usr/bin/env node
/**
 * Exercita TODAS as ferramentas do MCP contra um servidor de verdade.
 *
 * O protocolo dá para testar sem banco; o caminho de dados, não — ele exige a
 * service-role, que só existe em produção. Este script fecha essa lacuna: chama
 * cada ferramenta uma vez e diz qual respondeu, qual falhou e qual veio vazia.
 *
 * Uso:
 *   MCP_TOKEN=xxx node scripts/testar-mcp.mjs
 *   MCP_TOKEN=xxx node scripts/testar-mcp.mjs http://localhost:3999/api/mcp
 *
 * Só lê — nenhuma ferramenta do MCP escreve.
 */
const URL_MCP = process.argv[2] ?? "https://www.viofilme.com.br/api/mcp";
const TOKEN = process.env.MCP_TOKEN ?? "";

if (!TOKEN) {
  console.error("Faltou MCP_TOKEN. Ex.: MCP_TOKEN=xxx node scripts/testar-mcp.mjs");
  process.exit(1);
}

/** Argumentos de exemplo para as ferramentas que exigem um alvo. */
const EXEMPLOS = { client: "a", deal: "a", query: "a" };

async function rpc(method, params) {
  const res = await fetch(URL_MCP, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok && res.status !== 200) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${txt.slice(0, 120)}`);
  }
  const j = await res.json();
  if (j.error) throw new Error(`${j.error.code}: ${j.error.message}`);
  return j.result;
}

const { tools } = await rpc("tools/list");
console.log(`\n${URL_MCP}\n${tools.length} ferramentas\n`);

let ok = 0, falhas = 0, vazias = 0;
for (const t of tools) {
  const req = t.inputSchema?.required ?? [];
  const args = Object.fromEntries(req.map((k) => [k, EXEMPLOS[k] ?? "a"]));
  const rotulo = t.name.padEnd(22);

  try {
    const r = await rpc("tools/call", { name: t.name, arguments: args });
    const texto = r?.content?.[0]?.text ?? "";
    if (r?.isError) {
      falhas++;
      console.log(`  FALHOU  ${rotulo} ${texto.slice(0, 90)}`);
      continue;
    }
    // Resposta válida mas sem conteúdo útil ainda não é defeito — só falta dado.
    const dados = r?.structuredContent ?? {};
    const temNumero = JSON.stringify(dados).match(/[1-9]/);
    if (!temNumero) { vazias++; console.log(`  vazia   ${rotulo} respondeu, sem dados no recorte`); }
    else { ok++; console.log(`  ok      ${rotulo} ${texto.replace(/\s+/g, " ").slice(0, 80)}`); }
  } catch (e) {
    falhas++;
    console.log(`  FALHOU  ${rotulo} ${String(e.message).slice(0, 90)}`);
  }
}

console.log(`\n${ok} com dados · ${vazias} vazias · ${falhas} com falha\n`);
if (falhas > 0) {
  console.log("Ferramenta que falha aqui falha também na conversa com o Claude —");
  console.log("ele vai dizer que não conseguiu, sem saber por quê.\n");
}
process.exit(falhas > 0 ? 1 : 0);
