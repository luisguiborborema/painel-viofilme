/**
 * Escrita no financeiro precisa invalidar o cache da leitura.
 *
 * As seis telas do financeiro leem por `unstable_cache(..., { tags:
 * ["financeiro"] })` — **sem janela de expiração**. Quem não chama
 * `revalidateTag("financeiro")` depois de gravar não mostra um erro: mostra o
 * estado anterior, e mostra para sempre. O toast diz "pronto", a tela não muda,
 * e o relato que chega é "o sistema não salvou".
 *
 * Foi exatamente o que aconteceu: o commit que trouxe o cache deixou sete
 * caminhos de escrita sem invalidação — movimentação, transferência,
 * conciliação, classificação e desfazer no caixa, mais criar título e importar
 * extrato. Nenhum teste quebrou, porque não havia nenhum cobrando isto.
 *
 * O teste deriva a lista de tabelas dos próprios leitores, em vez de repeti-la,
 * para que uma tabela nova entre na cobrança sozinha.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath e não .pathname: o diretório tem espaço no nome, e .pathname
// devolve "Painel%20Viofilme", que o fs não abre.
const RAIZ = fileURLToPath(new URL("..", import.meta.url));

/** Os seis leitores cacheados sob a tag "financeiro". */
const LEITORES = [
  "caixa", "dashboard-financeiro", "pagamentos",
  "recebimentos", "resultados", "planejamento",
].map((n) => `src/lib/data/${n}-server.ts`);

/**
 * Rotas que tocam tabela do financeiro mas não precisam invalidar, com o motivo
 * — a mesma convenção do backup.test.ts. Uma rota só entra aqui se o que ela
 * **grava** não for lido por nenhum leitor cacheado.
 */
const SO_LEEM: Record<string, string> = {
  "pacotes/route.ts":
    "grava packages e package_items, que nenhum leitor cacheado lê; de finance_settings só lê a meta de margem.",
  "asaas/subscription/route.ts":
    "de payments só lê o espelho do Asaas; não grava nada que o financeiro leia.",
};

/**
 * Cadastro compartilhado com o resto do painel. Os leitores do financeiro fazem
 * join nessas tabelas para mostrar **nome** — nunca valor. Renomear um cliente
 * no Comercial deixa o nome velho na tela do financeiro até a próxima escrita
 * financeira, e isso é uma inconsistência cosmética conhecida: o número está
 * certo, o rótulo atrasa.
 *
 * Elas ficam fora da cobrança porque exigir que toda escrita de cadastro do
 * painel invalide o cache do financeiro espalharia a regra por áreas que não
 * têm nada a ver com dinheiro. Se um dia o nome atrasado incomodar, o conserto
 * é tirar a tabela daqui — não afrouxar o teste.
 */
const PERIFERIA = new Set([
  "clients", "collaborators", "services", "client_services", "projects",
  "squads", "team_allocations", "parties", "attachments", "audit_events",
  "dashboard_visits",
]);

/**
 * Saídas de sucesso que não gravam nada e por isso não invalidam. A prévia da
 * importação de extrato lê o arquivo, conta as linhas e devolve o que
 * aconteceria — a gravação só vem no segundo passo, que invalida.
 */
const SAIDAS_DE_LEITURA: Record<string, string> = {
  "caixa/importar/route.ts": "a prévia (etapa !== confirmar) só lê e conta; quem grava é o segundo passo.",
};

const arquivo = (p: string) => readFileSync(join(RAIZ, p), "utf8");

function rotasDe(dir: string): string[] {
  const base = join(RAIZ, dir);
  const saida: string[] = [];
  for (const nome of readdirSync(base)) {
    const caminho = join(base, nome);
    if (statSync(caminho).isDirectory()) saida.push(...rotasDe(join(dir, nome)));
    else if (nome === "route.ts") saida.push(join(dir, nome));
  }
  return saida;
}

/* ── O que os leitores cacheados leem ──────────────────────────────────── */

const tabelasLidas = new Set<string>();
for (const p of LEITORES) {
  for (const m of arquivo(p).matchAll(/from\("([a-z_]+)"\)/g)) {
    if (!PERIFERIA.has(m[1])) tabelasLidas.add(m[1]);
  }
}

test("os seis leitores do financeiro estão todos sob a tag, e sem janela de expiração", () => {
  for (const p of LEITORES) {
    const s = arquivo(p);
    assert.match(s, /unstable_cache\(/, `${p} deixou de usar unstable_cache`);
    assert.match(s, /tags:\s*\["financeiro"\]/, `${p} não declara a tag "financeiro"`);
  }
  // A ausência de `revalidate` é deliberada: o dado financeiro não pode ficar
  // velho por tempo nenhum. É ela que torna a invalidação obrigatória — se um
  // dia alguém adicionar uma janela, este teste deixa de fazer sentido.
  assert.ok(tabelasLidas.size > 15, "a lista de tabelas do núcleo encolheu demais — o grep quebrou?");
});

/* ── Quem grava precisa invalidar ──────────────────────────────────────── */

const MUTA = /export async function (POST|PATCH|PUT|DELETE)\b/;
const GRAVA = /\.(insert|update|upsert|delete)\(/;

test("toda rota que grava tabela do financeiro invalida a tag", () => {
  const faltando: string[] = [];
  for (const rota of rotasDe("src/app/api/gerencial")) {
    const s = arquivo(rota);
    if (!MUTA.test(s) || !GRAVA.test(s)) continue;

    const toca = [...s.matchAll(/from\("([a-z_]+)"\)/g)].some((m) => tabelasLidas.has(m[1]));
    if (!toca) continue;

    const chave = rota.replace("src/app/api/gerencial/", "");
    if (chave in SO_LEEM) continue;
    if (!s.includes('revalidateTag("financeiro"')) faltando.push(chave);
  }
  assert.deepEqual(
    faltando, [],
    "estas rotas gravam tabela lida pelo financeiro e não invalidam o cache — " +
    "a tela vai mostrar o estado anterior. Chame revalidateTag(\"financeiro\", { expire: 0 }) " +
    "no sucesso, ou declare o motivo em SO_LEEM:",
  );
});

/**
 * Uma invalidação por arquivo não basta. A rota de Pagamentos tinha quatro e
 * mesmo assim "pagar" — a ação mais importante da página — saía sem invalidar:
 * o teste anterior via as quatro e dava por satisfeito. O mesmo em Recebimentos
 * com "receber".
 *
 * A regra que pega isso: numa rota que invalida, **nenhuma** saída de sucesso
 * pode ser um `NextResponse.json({ ok: true` solto. Ou cada saída invalida na
 * própria linha, ou a rota usa o envelope no despacho — que é a forma de não
 * precisar lembrar a cada ação nova.
 */
test("nenhuma saída de sucesso escapa da invalidação", () => {
  const escapando: string[] = [];
  for (const rota of rotasDe("src/app/api/gerencial")) {
    const s = arquivo(rota);
    if (!s.includes('revalidateTag("financeiro"')) continue;
    // Envelope: uma invalidação no despacho cobre todas as saídas.
    if (/if \(resposta\.ok\) revalidateTag\("financeiro"/.test(s)) continue;

    const chave = rota.replace("src/app/api/gerencial/", "");
    const linhas = s.split("\n");
    linhas.forEach((linha, i) => {
      if (!/(return|=>)\s*NextResponse\.json\(\{?\s*$|ok: true/.test(linha)) return;
      if (!/ok: true/.test(linha) && !/ok: true/.test(linhas[i + 1] ?? "")) return;
      // Caminho sem banco: não há nada gravado para invalidar.
      if (/persisted: false/.test(linha)) return;
      if (SAIDAS_DE_LEITURA[chave]) return;
      // Na própria linha ou nas três anteriores — invalidar antes do return é
      // tão válido quanto o operador vírgula, e mais legível em objeto grande.
      const janela = linhas.slice(Math.max(0, i - 3), i + 1).join("\n");
      if (!janela.includes('revalidateTag("financeiro"')) escapando.push(`${chave}:${i + 1}`);
    });
  }
  assert.deepEqual(
    escapando, [],
    "estas saídas de sucesso gravam e não invalidam — a ação escapa e a tela " +
    "não muda. Use o envelope no despacho (`if (resposta.ok) revalidateTag(...)`) " +
    "em vez de repetir por saída:",
  );
});

test("a dispensa em SO_LEEM não vira depósito de rota que sumiu", () => {
  for (const chave of Object.keys(SO_LEEM)) {
    const existe = rotasDe("src/app/api/gerencial").some(
      (r) => r.replace("src/app/api/gerencial/", "") === chave,
    );
    assert.ok(existe, `${chave} está dispensada em SO_LEEM mas não existe mais`);
  }
});

test("ninguém importa revalidateTag sem chamar", () => {
  // Import sem chamada foi o sintoma visível das sete rotas esquecidas: o lint
  // avisava, e o aviso passou. Aqui ele vira erro.
  const mortos: string[] = [];
  for (const rota of rotasDe("src/app/api/gerencial")) {
    const s = arquivo(rota);
    if (!s.includes("import { revalidateTag }")) continue;
    if (!s.includes("revalidateTag(")) mortos.push(rota.replace("src/app/api/gerencial/", ""));
  }
  assert.deepEqual(mortos, [], "importam revalidateTag e nunca chamam:");
});
