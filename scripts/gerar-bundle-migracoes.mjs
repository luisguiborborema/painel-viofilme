#!/usr/bin/env node
/**
 * Junta todas as migrações num arquivo só, na ordem correta.
 *
 * Aplicar 140 arquivos à mão num projeto novo é o passo que faz o ensaio de
 * restauração nunca acontecer. Com o bundle é um copiar e colar no SQL Editor.
 *
 * Uso:
 *   node scripts/gerar-bundle-migracoes.mjs           → escreve bundle-migracoes.sql
 *   node scripts/gerar-bundle-migracoes.mjs --partes  → divide em blocos de ~400 KB
 *
 * O editor SQL do Supabase engasga com arquivos muito grandes; `--partes` gera
 * pedaços que colam sem travar, numerados na ordem de execução.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(raiz, "supabase", "migrations");
const emPartes = process.argv.includes("--partes");
const LIMITE = 400 * 1024;

const arquivos = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
if (!arquivos.length) {
  console.error("Nenhuma migração encontrada.");
  process.exit(1);
}

const cabecalho = (n, total) => `-- ═══════════════════════════════════════════════════════════════════
-- Painel Viofilme — migrações${total > 1 ? ` (parte ${n} de ${total})` : ""}
-- Gerado por scripts/gerar-bundle-migracoes.mjs
--
-- Cole no SQL Editor do Supabase e execute${total > 1 ? " — NA ORDEM DAS PARTES" : ""}.
-- As migrações são idempotentes (create if not exists / add column if not
-- exists), então reexecutar não quebra nada.
-- ═══════════════════════════════════════════════════════════════════

`;

const blocos = arquivos.map((f) => {
  const sql = readFileSync(join(dir, f), "utf8").trim();
  return `\n-- ─── ${f} ${"─".repeat(Math.max(0, 60 - f.length))}\n\n${sql}\n`;
});

const partes = [];
if (emPartes) {
  let atual = "";
  for (const b of blocos) {
    if (atual.length + b.length > LIMITE && atual) { partes.push(atual); atual = ""; }
    atual += b;
  }
  if (atual) partes.push(atual);
} else {
  partes.push(blocos.join(""));
}

const nomes = [];
partes.forEach((conteudo, i) => {
  const nome = partes.length > 1 ? `bundle-migracoes-${String(i + 1).padStart(2, "0")}.sql` : "bundle-migracoes.sql";
  writeFileSync(join(raiz, nome), cabecalho(i + 1, partes.length) + conteudo);
  nomes.push({ nome, kb: Math.round(conteudo.length / 1024) });
});

console.log(`\n${arquivos.length} migrações → ${nomes.length} arquivo(s):\n`);
for (const n of nomes) console.log(`  ${n.nome.padEnd(30)} ${String(n.kb).padStart(5)} KB`);
console.log(`\nDa primeira (${arquivos[0]}) à última (${arquivos.at(-1)}).`);
console.log("Os arquivos gerados não são versionados — estão no .gitignore.\n");
