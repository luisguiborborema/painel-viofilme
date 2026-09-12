/**
 * Dados de demonstração não podem aparecer na interface real.
 *
 * Já aconteceu duas vezes: a data fixa do mock virou o "hoje" do painel (tarefa
 * nascia vencendo três meses atrás) e a equipe fictícia virou a lista de
 * responsáveis (dava para atribuir tarefa a alguém que não existe). Nos dois
 * casos nada quebrou — o sistema respondia normalmente, com dado errado.
 *
 * Este teste é a trava: se um componente voltar a importar dado de
 * demonstração, ele falha.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const raiz = join(import.meta.dirname, "..", "src");

function arquivos(dir: string, out: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) arquivos(p, out);
    else if (/\.tsx?$/.test(nome)) out.push(p);
  }
  return out;
}

/** Só o que a pessoa vê: componentes e páginas. */
const daInterface = arquivos(join(raiz, "components"))
  .concat(arquivos(join(raiz, "app")))
  .filter((p) => !p.includes("/api/"));

/** Símbolos de demonstração que não podem ser usados fora da camada de dados. */
const PROIBIDOS = [
  { nome: "OPS_TEAM", porque: "equipe fictícia — use o hook useEquipe()" },
  { nome: "REFERENCE_DATE", porque: "data fixa do mock — use hojeIso()" },
  { nome: "DEMO_TODAY_ISO", porque: "hoje dos dados de demonstração — use hojeIso()" },
];

for (const { nome, porque } of PROIBIDOS) {
  test(`nenhum componente importa ${nome}`, () => {
    const culpados = daInterface.filter((p) => {
      const src = readFileSync(p, "utf8");
      // Comentário citando o símbolo é permitido — o que não pode é importar.
      return new RegExp(`^\\s*${nome},?\\s*$|\\{[^}]*\\b${nome}\\b[^}]*\\}\\s*from`, "m").test(src);
    });
    assert.deepStrictEqual(
      culpados.map((p) => p.replace(raiz + "/", "")), [],
      `${nome} não pode chegar à interface: ${porque}`,
    );
  });
}

test("a lista de responsáveis não tem nomes fixos no código", () => {
  // Um seletor com nome escrito à mão é o mesmo problema por outro caminho.
  const fic = ["Robert", "Ana Lima", "Mariana", "Lucas"];
  const culpados: string[] = [];
  for (const p of daInterface) {
    const src = readFileSync(p, "utf8");
    for (const n of fic) {
      // placeholder ("Ex.: Ana Lima") é exemplo para o usuário, não dado.
      const re = new RegExp(`["'\`][^"'\`]*${n}[^"'\`]*["'\`]`, "g");
      for (const m of src.match(re) ?? []) {
        if (!/Ex\.:|placeholder|exemplo/i.test(m)) culpados.push(`${p.replace(raiz + "/", "")}: ${m}`);
      }
    }
  }
  assert.deepStrictEqual(culpados, []);
});
