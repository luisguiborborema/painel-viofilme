#!/usr/bin/env node
/**
 * Restaura um backup do painel para um projeto Supabase.
 *
 * Um backup que nunca foi restaurado é hipótese, não backup. Este script existe
 * para que a restauração seja um procedimento testado, e não uma improvisação
 * no pior dia possível.
 *
 * Uso:
 *   node scripts/restaurar-backup.mjs painel-2026-08-26.json.gz --dry-run
 *   node scripts/restaurar-backup.mjs painel-2026-08-26.json.gz --destino=.env.restore --confirmo
 *
 * Opções:
 *   --dry-run           só relata o que faria (padrão se faltar --confirmo)
 *   --confirmo          executa a escrita de verdade
 *   --destino=ARQUIVO   .env com SUPABASE_URL e SUPABASE_SERVICE_ROLE do DESTINO
 *   --tabelas=a,b,c     restaura só estas
 *   --pular=a,b         não restaura estas
 *
 * Segurança:
 *   • Escreve com upsert por `id`: rodar duas vezes dá o mesmo resultado.
 *   • NUNCA apaga nada. Linha que existe no banco e não no backup fica onde está.
 *   • Recusa rodar contra a mesma URL de NEXT_PUBLIC_SUPABASE_URL sem --confirmo,
 *     para não sobrescrever produção por engano.
 *   • Tokens de integração vêm redigidos do backup; reconecte Google/Meta depois.
 */
import { readFileSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createClient } from "@supabase/supabase-js";
import { restaurarEmPasses } from "./restore-core.mjs";

const args = process.argv.slice(2);
const arquivo = args.find((a) => !a.startsWith("--"));
const opt = (nome) => args.find((a) => a.startsWith(`--${nome}=`))?.split("=").slice(1).join("=");
const tem = (nome) => args.includes(`--${nome}`);

const confirmo = tem("confirmo");
const dryRun = tem("dry-run") || !confirmo;
const somente = opt("tabelas")?.split(",").map((s) => s.trim()).filter(Boolean);
const pular = new Set(opt("pular")?.split(",").map((s) => s.trim()).filter(Boolean) ?? []);

if (!arquivo) {
  console.error("Informe o arquivo de backup. Ex.: node scripts/restaurar-backup.mjs painel-2026-08-26.json.gz --dry-run");
  process.exit(1);
}
if (!existsSync(arquivo)) {
  console.error(`Arquivo não encontrado: ${arquivo}`);
  process.exit(1);
}

/** Lê variáveis de um .env simples, sem depender de pacote externo. */
function lerEnv(caminho) {
  const out = {};
  if (!caminho || !existsSync(caminho)) return out;
  for (const linha of readFileSync(caminho, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linha);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const envDestino = lerEnv(opt("destino"));
const URL = envDestino.SUPABASE_URL || envDestino.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = envDestino.SUPABASE_SERVICE_ROLE || envDestino.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
  console.error("Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE (no ambiente ou via --destino=arquivo.env).");
  process.exit(1);
}

// ── lê o backup ──────────────────────────────────────────────────────────────
const bruto = readFileSync(arquivo);
const conteudo = arquivo.endsWith(".gz") ? gunzipSync(bruto) : bruto;
const backup = JSON.parse(conteudo.toString("utf8"));
const dados = backup.dados ?? {};

const tabelas = Object.keys(dados)
  .filter((t) => (somente ? somente.includes(t) : true))
  .filter((t) => !pular.has(t));

console.log(`\nBackup:  ${arquivo}`);
console.log(`Gerado:  ${backup.gerado_em ?? "?"}   Origem: ${backup.origem ?? "?"}`);
console.log(`Destino: ${URL}`);
console.log(`Tabelas: ${tabelas.length} de ${Object.keys(dados).length}   Linhas: ${backup.linhas ?? "?"}`);
console.log(dryRun ? "\nMODO SIMULAÇÃO — nada será escrito. Use --confirmo para valer.\n" : "\nESCREVENDO DE VERDADE.\n");

if (dryRun) {
  for (const t of tabelas) console.log(`  ${String(dados[t].length).padStart(6)}  ${t}`);
  console.log("\nNenhuma escrita feita.");
  process.exit(0);
}

const db = createClient(URL, KEY, { auth: { persistSession: false } });
const LOTE = 500;

/** Grava uma tabela em lotes; devolve null em sucesso ou a mensagem de erro. */
async function gravar(tabela, linhas) {
  for (let i = 0; i < linhas.length; i += LOTE) {
    const { error } = await db.from(tabela).upsert(linhas.slice(i, i + LOTE), { onConflict: "id" });
    if (error) return error.message;
  }
  process.stdout.write(`  ok ${String(linhas.length).padStart(6)}  ${tabela}\n`);
  return null;
}

const { feitas, pendentes, erros, passes } = await restaurarEmPasses(tabelas, dados, gravar);
console.log(`\nPasses necessários: ${passes}`);

console.log(`\nRestauradas: ${feitas.length} tabela(s), ${feitas.reduce((s, f) => s + f.linhas, 0)} linha(s).`);
if (pendentes.length > 0) {
  console.log(`\n❌ NÃO restauradas (${pendentes.length}):`);
  for (const e of erros) console.log(`   ${e.tabela}: ${e.erro}`);
  console.log("\nCausas comuns: tabela ausente (rode as migrações no destino primeiro)");
  console.log("ou referência a usuário que não existe (restaure/convide os usuários antes).");
}
console.log("\nDepois de restaurar: reconecte Google e Meta — os tokens vêm redigidos do backup.\n");
process.exit(pendentes.length > 0 ? 1 : 0);
