/**
 * Ordem de restauração.
 *
 * É o único trecho da restauração com lógica de verdade: descobrir sozinho a
 * ordem que a chave estrangeira exige, sem uma lista fixa que envelhece. Se
 * este laço estiver errado, o erro só aparece no dia em que o backup for usado
 * — e nesse dia não há margem para depurar.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { restaurarEmPasses } from "../scripts/restore-core.mjs";

const dados = {
  clients: [{ id: "c1" }],
  payments: [{ id: "p1", client_id: "c1" }],
  expenses: [{ id: "e1" }],
};

/** Simula o banco: `payments` só aceita depois de `clients`. */
function bancoComFk(dependencias: Record<string, string>) {
  const gravadas = new Set<string>();
  const ordem: string[] = [];
  return {
    gravadas, ordem,
    gravar: async (tabela: string) => {
      const precisa = dependencias[tabela];
      if (precisa && !gravadas.has(precisa)) return `violates foreign key constraint on ${precisa}`;
      gravadas.add(tabela);
      ordem.push(tabela);
      return null;
    },
  };
}

test("descobre a ordem sozinho quando a dependência vem depois", async () => {
  const banco = bancoComFk({ payments: "clients" });
  // De propósito na ordem ERRADA: payments antes de clients.
  const r = await restaurarEmPasses(["payments", "clients", "expenses"], dados, banco.gravar);
  assert.equal(r.pendentes.length, 0, "nada deveria sobrar");
  assert.equal(r.feitas.length, 3);
  assert.ok(banco.ordem.indexOf("clients") < banco.ordem.indexOf("payments"), "clients tem de vir antes");
  assert.equal(r.passes, 2, "um passe para descobrir, outro para concluir");
});

test("uma tabela já na ordem certa resolve em um passe", async () => {
  const banco = bancoComFk({ payments: "clients" });
  const r = await restaurarEmPasses(["clients", "payments"], dados, banco.gravar);
  assert.equal(r.passes, 1);
  assert.equal(r.pendentes.length, 0);
});

test("cadeia longa converge", async () => {
  const banco = bancoComFk({ b: "a", c: "b", d: "c" });
  const d2 = { a: [{ id: 1 }], b: [{ id: 1 }], c: [{ id: 1 }], d: [{ id: 1 }] };
  const r = await restaurarEmPasses(["d", "c", "b", "a"], d2, banco.gravar);
  assert.equal(r.pendentes.length, 0);
  assert.deepStrictEqual(banco.ordem, ["a", "b", "c", "d"]);
});

test("erro real não vira laço infinito", async () => {
  const gravar = async (t: string) => (t === "quebrada" ? "column x does not exist" : null);
  const r = await restaurarEmPasses(["ok1", "quebrada", "ok2"], { ok1: [{ id: 1 }], quebrada: [{ id: 1 }], ok2: [{ id: 1 }] }, gravar);
  assert.deepStrictEqual(r.pendentes, ["quebrada"]);
  assert.equal(r.feitas.length, 2, "as boas foram restauradas mesmo assim");
  assert.match(r.erros[0].erro, /does not exist/);
});

test("nenhuma tabela grava: para sem repetir para sempre", async () => {
  const gravar = async () => "permission denied";
  const r = await restaurarEmPasses(["a", "b"], { a: [{ id: 1 }], b: [{ id: 1 }] }, gravar);
  assert.equal(r.passes, 1, "não insiste quando nada progride");
  assert.deepStrictEqual(r.pendentes, ["a", "b"]);
});

test("tabela vazia não é erro", async () => {
  const gravar = async () => "nunca deveria ser chamado";
  const r = await restaurarEmPasses(["vazia"], { vazia: [] }, gravar);
  assert.equal(r.pendentes.length, 0);
  assert.deepStrictEqual(r.feitas, [{ tabela: "vazia", linhas: 0 }]);
});
