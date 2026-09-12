/**
 * Entradas vindas da internet aberta.
 *
 * Formulário público não tem login: quem manda o payload decide o conteúdo.
 * Sem limite de tamanho, um campo "nome" de 5 MB entra no banco; sem limite de
 * envios, dá para encher o CRM de negócios falsos até os verdadeiros sumirem.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ENVIOS_POR_HORA, LIMITES, emailPlausivel, limitar, limitarPropriedades,
  novoEstadoEnvios, podeEnviar, telefoneLimpo,
} from "../src/lib/data/entrada-publica.ts";

const eq = (nome: string, a: unknown, b: unknown) =>
  test(nome, () => assert.deepStrictEqual(a, b));

/* ── tamanho ── */

eq("texto normal passa inteiro", limitar("Padaria do Zé", "empresa"), "Padaria do Zé");
eq("apara espaços", limitar("  Ana  ", "nome"), "Ana");
eq("vazio vira nulo", limitar("   ", "nome"), null);
eq("ausente vira nulo", limitar(undefined), null);

test("texto gigante é cortado, não recusado", () => {
  // Quem preencheu um formulário longo prefere o cadastro entrar a perder tudo.
  const enorme = "x".repeat(1_000_000);
  assert.equal(limitar(enorme, "nome")!.length, LIMITES.nome);
  assert.equal(limitar(enorme, "texto")!.length, LIMITES.texto);
});

/* ── telefone e e-mail ── */

eq("telefone perde a formatação", telefoneLimpo("(27) 99123-4567"), "27991234567");
eq("telefone vazio", telefoneLimpo("sem telefone"), null);
eq("telefone absurdo é cortado", telefoneLimpo("9".repeat(500))!.length, LIMITES.telefone);

eq("e-mail válido vira minúsculo", emailPlausivel("Contato@Empresa.COM.BR"), "contato@empresa.com.br");
eq("sem arroba é descartado", emailPlausivel("contato.empresa.com"), null);
eq("sem domínio é descartado", emailPlausivel("a@b"), null);
eq("espaço no meio é descartado", emailPlausivel("a b@c.com"), null);
eq("vazio", emailPlausivel(""), null);

/* ── propriedades extras ── */

test("limita a quantidade de chaves", () => {
  // Sem isto, um payload com dez mil chaves entra inteiro no jsonb do negócio.
  const muitas = Object.fromEntries(Array.from({ length: 5000 }, (_, i) => [`k${i}`, "v"]));
  assert.equal(Object.keys(limitarPropriedades(muitas)).length, 40);
});

test("limita o tamanho de cada valor", () => {
  const r = limitarPropriedades({ obs: "y".repeat(50_000) });
  assert.equal(r.obs.length, LIMITES.texto);
});

eq("não é objeto vira vazio", limitarPropriedades("texto"), {});
eq("array vira vazio", limitarPropriedades([1, 2]), {});
eq("nulo vira vazio", limitarPropriedades(null), {});
eq("valor vazio é descartado", limitarPropriedades({ a: "  ", b: "ok" }), { b: "ok" });

/* ── limite de envios ── */

const T0 = 1_700_000_000_000;

test("preenchimento normal passa", () => {
  const e = novoEstadoEnvios();
  for (let i = 0; i < 3; i++) assert.equal(podeEnviar(e, "1.2.3.4", T0 + i * 1000).ok, true);
});

test("bloqueia enxurrada do mesmo IP", () => {
  const e = novoEstadoEnvios();
  for (let i = 0; i < ENVIOS_POR_HORA; i++) podeEnviar(e, "ip", T0 + i);
  const v = podeEnviar(e, "ip", T0 + 1000);
  assert.equal(v.ok, false);
  assert.ok("esperarMinutos" in v && v.esperarMinutos >= 1);
});

test("um IP não consome o limite do outro", () => {
  const e = novoEstadoEnvios();
  for (let i = 0; i < ENVIOS_POR_HORA; i++) podeEnviar(e, "a", T0 + i);
  assert.equal(podeEnviar(e, "a", T0 + 500).ok, false);
  assert.equal(podeEnviar(e, "b", T0 + 500).ok, true);
});

test("passada a hora, libera", () => {
  const e = novoEstadoEnvios();
  for (let i = 0; i < ENVIOS_POR_HORA; i++) podeEnviar(e, "ip", T0 + i);
  assert.equal(podeEnviar(e, "ip", T0 + 61 * 60_000).ok, true);
});

test("IP inativo não fica na memória para sempre", () => {
  const e = novoEstadoEnvios();
  for (let i = 0; i < 2100; i++) podeEnviar(e, `ip-${i}`, T0 + i);
  podeEnviar(e, "novo", T0 + 3 * 60 * 60_000);
  assert.ok(e.size < 2100, `esperava faxina, ficaram ${e.size}`);
});
