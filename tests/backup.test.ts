/**
 * O backup precisa cobrir toda tabela de dados.
 *
 * Uma tabela fora da lista não dá erro em lugar nenhum: o backup roda, diz
 * "ok", e o buraco só aparece no dia da restauração — o pior dia possível para
 * descobrir. Este teste lê as migrações e cobra a lista.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Fora do backup de propósito:
 *  • api_logs / wa_webhook_log — diagnóstico, com purga própria e volume alto.
 *  • notifications — avisos efêmeros na sineta; restaurar avisos antigos como
 *    não lidos seria pior que não restaurar.
 */
const FORA_DE_PROPOSITO = new Set(["api_logs", "wa_webhook_log", "notifications"]);

function tabelasDasMigracoes(): Set<string> {
  const dir = join(import.meta.dirname, "..", "supabase", "migrations");
  const tabelas = new Set<string>();
  for (const arquivo of readdirSync(dir).filter((f) => f.endsWith(".sql"))) {
    const sql = readFileSync(join(dir, arquivo), "utf8");
    for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z_0-9]+)"?/gi)) {
      tabelas.add(m[1]);
    }
    for (const m of sql.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?(?:public\.)?"?([a-z_0-9]+)"?/gi)) {
      tabelas.delete(m[1]);
    }
  }
  return tabelas;
}

function listaDoBackup(): Set<string> {
  const src = readFileSync(join(import.meta.dirname, "..", "src", "lib", "data", "backup.ts"), "utf8");
  const bloco = /export const TABELAS_BACKUP = \[([^]*?)\] as const;/.exec(src);
  assert.ok(bloco, "não achei TABELAS_BACKUP em backup.ts");
  return new Set([...bloco[1].matchAll(/"([a-z_0-9]+)"/g)].map((m) => m[1]));
}

test("toda tabela criada nas migrações está no backup", () => {
  const noBanco = tabelasDasMigracoes();
  const noBackup = listaDoBackup();
  const faltando = [...noBanco].filter((t) => !noBackup.has(t) && !FORA_DE_PROPOSITO.has(t)).sort();
  assert.deepStrictEqual(
    faltando, [],
    `tabelas sem backup: ${faltando.join(", ")}. Inclua em TABELAS_BACKUP ou, se for log/fila, em FORA_DE_PROPOSITO.`,
  );
});

test("o backup não lista tabela que não existe", () => {
  const noBanco = tabelasDasMigracoes();
  const noBackup = listaDoBackup();
  const fantasmas = [...noBackup].filter((t) => !noBanco.has(t)).sort();
  assert.deepStrictEqual(fantasmas, [], `tabelas inexistentes na lista: ${fantasmas.join(", ")}`);
});
