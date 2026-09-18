/**
 * Pré-checagem da configuração da Meta.
 *
 * O erro de domínio é o que mais custa tempo: aparece como uma tela do Facebook
 * dizendo "URL bloqueada", ou como uma conexão que falha sem motivo visível,
 * depois de a pessoa já ter passado pela App Review.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { diagnosticarMeta, dominioBate, hostDe, podeConectar } from "../src/lib/meta/diagnostico.ts";

const base = {
  appId: "123",
  temSecret: true,
  appUrl: "https://www.viofilme.com.br",
  hostAtual: "www.viofilme.com.br",
  redirectUri: "https://www.viofilme.com.br/api/meta/callback",
};

test("host sai da URL", () => {
  assert.equal(hostDe("https://www.viofilme.com.br/api/x"), "www.viofilme.com.br");
  assert.equal(hostDe("não é url"), "");
});

/* ── o caso real que motivou isto ── */

test("apex configurado e www no navegador não batem", () => {
  // Era exatamente o estado da produção: NEXT_PUBLIC_APP_URL sem www, painel
  // servido em www, e o apex redirecionando 308 para www no meio do OAuth.
  assert.equal(dominioBate("https://viofilme.com.br", "www.viofilme.com.br"), false);
});

test("mesmo domínio bate", () => {
  assert.equal(dominioBate("https://www.viofilme.com.br", "www.viofilme.com.br"), true);
  assert.equal(dominioBate("https://www.viofilme.com.br", "WWW.VIOFILME.COM.BR"), true, "caixa não importa");
});

test("porta no host não atrapalha o desenvolvimento local", () => {
  assert.equal(dominioBate("http://localhost:3000", "localhost:3000"), true);
});

test("sem como comparar, não inventa alarme", () => {
  assert.equal(dominioBate("", "www.viofilme.com.br"), true);
  assert.equal(dominioBate("https://x.com", ""), true);
});

/* ── diagnóstico ── */

test("tudo configurado só pede o registro da URL", () => {
  const c = diagnosticarMeta(base);
  assert.equal(c.filter((x) => x.nivel === "falta").length, 0);
  assert.ok(podeConectar(c));
  assert.ok(c.some((x) => x.titulo.includes("Registre esta URL")));
});

test("sem App ID bloqueia", () => {
  const c = diagnosticarMeta({ ...base, appId: "" });
  assert.equal(podeConectar(c), false);
  assert.ok(c.some((x) => x.nivel === "falta" && x.detalhe.includes("NEXT_PUBLIC_META_APP_ID")));
});

test("sem Secret bloqueia", () => {
  assert.equal(podeConectar(diagnosticarMeta({ ...base, temSecret: false })), false);
});

test("domínio diferente avisa mas não bloqueia", () => {
  // Bloquear seria errado: funciona por redirecionamento em alguns casos, e
  // impedir a tentativa esconderia a única forma de descobrir.
  const c = diagnosticarMeta({ ...base, appUrl: "https://viofilme.com.br" });
  const d = c.find((x) => x.titulo.includes("Domínio"));
  assert.equal(d?.nivel, "atencao");
  assert.match(d?.detalhe ?? "", /NEXT_PUBLIC_APP_URL/);
  assert.ok(podeConectar(c), "aviso não impede tentar");
});

test("não afirma o que não verificou", () => {
  // Se a permissão saiu da App Review, só a Meta sabe. Dizer "tudo certo" sobre
  // isso seria pior que não dizer nada.
  const c = diagnosticarMeta(base);
  assert.ok(!c.some((x) => x.nivel === "ok" && /App Review|permiss/i.test(x.titulo)));
});
