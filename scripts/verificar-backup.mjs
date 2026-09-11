#!/usr/bin/env node
/**
 * Audita um arquivo de backup — sem banco, sem credencial, em segundos.
 *
 * Metade do ensaio de restauração é responder "este arquivo presta?". Isso não
 * exige destino nenhum: dá para conferir se todas as tabelas esperadas estão
 * lá, se os campos sensíveis saíram redigidos e se o conteúdo bate com o
 * tamanho do negócio. O que sobra para o ensaio com banco é só a escrita.
 *
 * Uso:
 *   node scripts/verificar-backup.mjs painel-2026-09-11.json.gz
 */
import { readFileSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const arquivo = process.argv[2];
if (!arquivo || !existsSync(arquivo)) {
  console.error("Informe o arquivo. Ex.: node scripts/verificar-backup.mjs painel-2026-09-11.json.gz");
  process.exit(1);
}

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Tabelas que o backup DEVERIA conter, lidas da fonte da verdade. */
function tabelasEsperadas() {
  const src = readFileSync(join(raiz, "src", "lib", "data", "backup.ts"), "utf8");
  const bloco = /export const TABELAS_BACKUP = \[([^]*?)\] as const;/.exec(src);
  return new Set([...bloco[1].matchAll(/"([a-z_0-9]+)"/g)].map((m) => m[1]));
}

/** Colunas que precisam vir redigidas. */
function redigidas() {
  const src = readFileSync(join(raiz, "src", "lib", "data", "backup.ts"), "utf8");
  const bloco = /const REDIGIR: Record<string, string\[\]> = \{([^]*?)\n\};/.exec(src);
  const out = {};
  for (const m of bloco[1].matchAll(/(\w+):\s*\[([^\]]*)\]/g)) {
    out[m[1]] = [...m[2].matchAll(/"([a-z_0-9]+)"/g)].map((x) => x[1]);
  }
  return out;
}

const bruto = readFileSync(arquivo);
const conteudo = arquivo.endsWith(".gz") ? gunzipSync(bruto) : bruto;
let backup;
try {
  backup = JSON.parse(conteudo.toString("utf8"));
} catch (e) {
  console.error(`\n❌ Arquivo ilegível — não é um backup válido.\n   ${e.message}\n`);
  process.exit(1);
}

const dados = backup.dados ?? {};
const presentes = Object.keys(dados);
const linhas = presentes.reduce((s, t) => s + (dados[t]?.length ?? 0), 0);

const gerado = backup.gerado_em ? new Date(backup.gerado_em) : null;
const idadeH = gerado ? Math.round((Date.now() - gerado.getTime()) / 3_600_000) : null;

console.log(`\nArquivo:  ${arquivo}`);
console.log(`Gerado:   ${backup.gerado_em ?? "?"}${idadeH !== null ? `  (${idadeH}h atrás)` : ""}`);
console.log(`Origem:   ${backup.origem ?? "?"}`);
console.log(`Tamanho:  ${(bruto.length / 1024 / 1024).toFixed(2)} MB comprimido · ${(conteudo.length / 1024 / 1024).toFixed(2)} MB cru`);
console.log(`Conteúdo: ${presentes.length} tabelas com dado · ${linhas.toLocaleString("pt-BR")} linhas\n`);

let problemas = 0;
const alerta = (msg) => { problemas++; console.log(`  ❌ ${msg}`); };
const aviso = (msg) => console.log(`  ⚠️  ${msg}`);

// 1. Cobertura: tabela esperada que não veio pode ser "estava vazia" ou "falhou".
const esperadas = tabelasEsperadas();
const faltando = [...esperadas].filter((t) => !presentes.includes(t));
const extras = presentes.filter((t) => !esperadas.has(t));
console.log("Cobertura");
if (extras.length) aviso(`no arquivo mas fora da lista atual: ${extras.join(", ")}`);
if (faltando.length) {
  console.log(`  ${faltando.length} tabela(s) sem dado no arquivo (vazias ou ausentes no banco):`);
  console.log(`     ${faltando.join(", ")}`);
}
// O que não pode faltar de jeito nenhum.
for (const t of ["clients", "payments", "expenses", "crm_leads", "profiles"]) {
  if (!presentes.includes(t)) alerta(`"${t}" sem nenhuma linha — improvável num painel em uso; confira se o backup falhou`);
}

// 2. Redação: token em claro num arquivo que vai para o Drive é vazamento.
console.log("\nDados sensíveis");
let redOk = true;
for (const [tabela, colunas] of Object.entries(redigidas())) {
  for (const linha of dados[tabela] ?? []) {
    for (const col of colunas) {
      if (col in linha && linha[col] && !String(linha[col]).includes("redigido")) {
        alerta(`${tabela}.${col} NÃO foi redigido — há credencial em claro neste arquivo`);
        redOk = false;
      }
    }
  }
}
if (redOk) console.log("  ✓ tokens e hashes redigidos como esperado");

// 3. Integridade grosseira: linha sem id não volta no upsert por id.
console.log("\nIntegridade");
let semId = 0;
for (const [t, linhas2] of Object.entries(dados)) {
  const faltam = (linhas2 ?? []).filter((l) => l && typeof l === "object" && !("id" in l)).length;
  if (faltam) { semId += faltam; aviso(`${t}: ${faltam} linha(s) sem "id" — o restore grava por id e vai ignorá-las`); }
}
if (!semId) console.log("  ✓ todas as linhas têm id");

// 4. Frescor.
console.log("\nFrescor");
if (idadeH === null) aviso("sem data de geração no arquivo");
else if (idadeH > 48) alerta(`gerado há ${Math.round(idadeH / 24)} dias — o backup diário pode ter parado de rodar`);
else console.log(`  ✓ gerado há ${idadeH}h`);

// 5. Maiores tabelas: onde o teto de 50.000 linhas morde primeiro.
const TETO = 50_000;
console.log("\nMaiores tabelas");
for (const [t, l] of Object.entries(dados).map(([t, l]) => [t, l?.length ?? 0]).sort((a, b) => b[1] - a[1]).slice(0, 5)) {
  const marca = l >= TETO ? "  ❌ NO TETO — pode haver linhas não salvas" : l > TETO * 0.8 ? "  ⚠️  perto do teto" : "";
  if (l >= TETO) problemas++;
  console.log(`  ${String(l).padStart(7)}  ${t}${marca}`);
}

console.log(
  problemas === 0
    ? "\n✅ Arquivo íntegro. Falta só o ensaio de escrita num projeto de destino.\n"
    : `\n❌ ${problemas} problema(s) acima. Não confie neste arquivo até resolver.\n`,
);
process.exit(problemas > 0 ? 1 : 0);
