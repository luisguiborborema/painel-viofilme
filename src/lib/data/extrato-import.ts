/**
 * Leitura de extrato: OFX e CSV.
 *
 * O arquivo do banco é a fonte mais confiável que o sistema tem, e também a
 * mais fácil de duplicar: reimportar a mesma semana dobraria o saldo sem
 * nenhum erro aparecer. Por isso a dedupe é parte do parse, não um cuidado
 * posterior — e por isso a descrição original nunca é alterada.
 *
 * Dinheiro em centavos; datas "AAAA-MM-DD".
 *
 * Client-safe: puro, sem I/O.
 */

import { impressaoDigital } from "./caixa.ts";

export type LinhaDoExtrato = {
  dataIso: string;
  valorCent: number;
  descricaoRaw: string;
  /** FITID do OFX, quando existe: é a dedupe mais forte que há. */
  idExterno: string | null;
  documento: string | null;
};

export type ExtratoLido = {
  linhas: LinhaDoExtrato[];
  /** Saldo final informado pelo arquivo, quando ele traz. */
  saldoFinalCent: number | null;
  saldoDataIso: string | null;
  /** Conta do arquivo, para conferir com a conta escolhida (§18). */
  agencia: string | null;
  conta: string | null;
  erro: string | null;
};

const vazio = (erro: string): ExtratoLido => ({
  linhas: [], saldoFinalCent: null, saldoDataIso: null, agencia: null, conta: null, erro,
});

/* ── OFX ───────────────────────────────────────────────────────────────── */

/** `20260916120000[-3:BRT]` e variações viram "2026-09-16". */
function dataDoOfx(bruto: string): string | null {
  const m = String(bruto ?? "").trim().match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

const tag = (bloco: string, nome: string): string | null => {
  // O OFX é SGML: a tag pode não ter fechamento, então o valor vai até a
  // próxima tag ou o fim da linha.
  const m = bloco.match(new RegExp(`<${nome}>([^<\\r\\n]*)`, "i"));
  return m ? m[1].trim() : null;
};

/**
 * Lê um OFX de extrato bancário ou de fatura de cartão.
 *
 * Aceita OFX 1.x (SGML) e 2.x (XML): as duas formas usam as mesmas tags, e a
 * diferença de fechamento não muda o que interessa aqui.
 */
export function lerOfx(conteudo: string): ExtratoLido {
  const texto = String(conteudo ?? "");
  if (!/<STMTTRN>/i.test(texto)) {
    return vazio("O arquivo não parece um OFX de extrato: não há transações nele.");
  }

  const linhas: LinhaDoExtrato[] = [];
  for (const m of texto.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)) {
    const bloco = m[1];
    const dataIso = dataDoOfx(tag(bloco, "DTPOSTED") ?? "");
    const valorBruto = tag(bloco, "TRNAMT");
    if (!dataIso || valorBruto === null) continue;

    // O OFX usa ponto decimal; alguns bancos mandam vírgula.
    const valor = Number(String(valorBruto).replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(valor)) continue;

    const memo = tag(bloco, "MEMO") ?? tag(bloco, "NAME") ?? "";
    linhas.push({
      dataIso,
      valorCent: Math.round(valor * 100),
      descricaoRaw: memo.trim(),
      idExterno: tag(bloco, "FITID"),
      documento: memo.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{3}\.?\d{3}\.?\d{3}-?\d{2}/)?.[0] ?? null,
    });
  }

  const saldo = tag(texto, "BALAMT");
  const saldoData = dataDoOfx(tag(texto, "DTASOF") ?? "");

  return {
    linhas: linhas.sort((a, b) => a.dataIso.localeCompare(b.dataIso)),
    saldoFinalCent: saldo !== null && Number.isFinite(Number(saldo.replace(",", ".")))
      ? Math.round(Number(saldo.replace(",", ".")) * 100) : null,
    saldoDataIso: saldoData,
    agencia: tag(texto, "BRANCHID"),
    conta: tag(texto, "ACCTID"),
    erro: linhas.length ? null : "Nenhuma transação legível no arquivo.",
  };
}

/* ── CSV ───────────────────────────────────────────────────────────────── */

export type MapaCsv = {
  /** Índices das colunas, contando do zero. */
  data: number;
  descricao: number;
  /** Uma coluna com sinal, ou duas (débito e crédito). */
  valor?: number;
  debito?: number;
  credito?: number;
  separadorDecimal?: "," | ".";
  /** Quantas linhas pular no começo (cabeçalho). */
  pular?: number;
  formatoData?: "dmy" | "ymd";
};

function partirLinha(linha: string, separador: string): string[] {
  const campos: string[] = [];
  let atual = "";
  let dentroDeAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') { dentroDeAspas = !dentroDeAspas; continue; }
    if (c === separador && !dentroDeAspas) { campos.push(atual); atual = ""; continue; }
    atual += c;
  }
  campos.push(atual);
  return campos.map((c) => c.trim());
}

/** O separador que aparece mais vezes fora de aspas: ponto e vírgula ou vírgula. */
export function separadorDoCsv(conteudo: string): string {
  const amostra = String(conteudo ?? "").split(/\r?\n/).slice(0, 5).join("\n");
  const pv = (amostra.match(/;/g) ?? []).length;
  const v = (amostra.match(/,/g) ?? []).length;
  // Empate vai para ponto e vírgula: é o padrão dos bancos brasileiros, que
  // usam a vírgula como decimal.
  return pv >= v ? ";" : ",";
}

function dataDoCsv(bruto: string, formato: "dmy" | "ymd"): string | null {
  const limpo = String(bruto ?? "").trim();
  const so = limpo.match(/(\d{1,4})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (!so) return null;
  if (formato === "ymd") {
    return `${so[1].padStart(4, "20")}-${so[2].padStart(2, "0")}-${so[3].padStart(2, "0")}`;
  }
  const ano = so[3].length === 2 ? `20${so[3]}` : so[3];
  return `${ano}-${so[2].padStart(2, "0")}-${so[1].padStart(2, "0")}`;
}

function valorDoCsv(bruto: string, decimal: "," | "."): number | null {
  const limpo = String(bruto ?? "").replace(/[R$\s]/gi, "").trim();
  if (!limpo) return null;
  const normal = decimal === ","
    ? limpo.replace(/\./g, "").replace(",", ".")
    : limpo.replace(/,/g, "");
  const n = Number(normal);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/**
 * Lê um CSV de extrato, usando o mapeamento de colunas da conta.
 *
 * CSV não tem formato: cada banco inventa o seu. O mapeamento fica salvo por
 * conta justamente para a segunda importação não repetir o trabalho da
 * primeira — e é por isso que ele é parâmetro, não adivinhação.
 */
export function lerCsv(conteudo: string, mapa: MapaCsv): ExtratoLido {
  const texto = String(conteudo ?? "");
  const separador = separadorDoCsv(texto);
  const decimal = mapa.separadorDecimal ?? ",";
  const formato = mapa.formatoData ?? "dmy";

  const linhasBrutas = texto.split(/\r?\n/).slice(mapa.pular ?? 1).filter((l) => l.trim());
  const linhas: LinhaDoExtrato[] = [];

  for (const bruta of linhasBrutas) {
    const campos = partirLinha(bruta, separador);
    const dataIso = dataDoCsv(campos[mapa.data] ?? "", formato);
    if (!dataIso) continue;

    let valorCent: number | null = null;
    if (mapa.valor !== undefined) {
      valorCent = valorDoCsv(campos[mapa.valor] ?? "", decimal);
    } else {
      const debito = valorDoCsv(campos[mapa.debito ?? -1] ?? "", decimal) ?? 0;
      const credito = valorDoCsv(campos[mapa.credito ?? -1] ?? "", decimal) ?? 0;
      // Débito em coluna própria vem positivo: o sinal é a coluna, não o número.
      valorCent = credito - Math.abs(debito);
    }
    if (valorCent === null || valorCent === 0) continue;

    const descricao = (campos[mapa.descricao] ?? "").trim();
    linhas.push({
      dataIso, valorCent, descricaoRaw: descricao,
      idExterno: null,
      documento: descricao.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{3}\.?\d{3}\.?\d{3}-?\d{2}/)?.[0] ?? null,
    });
  }

  return {
    linhas: linhas.sort((a, b) => a.dataIso.localeCompare(b.dataIso)),
    saldoFinalCent: null, saldoDataIso: null, agencia: null, conta: null,
    erro: linhas.length ? null : "Nenhuma linha legível: confira o mapeamento de colunas.",
  };
}

/* ── Análise antes de importar (§7, passo 2) ───────────────────────────── */

export type SituacaoDaLinha = "nova" | "existente" | "confirma";

export type LinhaAnalisada = LinhaDoExtrato & {
  situacao: SituacaoDaLinha;
  /** Baixa manual que esta linha confirma, quando é o caso. */
  baixaId: string | null;
};

export type AnaliseDaImportacao = {
  linhas: LinhaAnalisada[];
  total: number;
  novas: number;
  existentes: number;
  confirmam: number;
  periodoInicio: string | null;
  periodoFim: string | null;
};

/**
 * Classifica cada linha do arquivo antes de gravar qualquer coisa.
 *
 * Três destinos, e a ordem importa: o `external_id` é a prova mais forte de
 * que a linha já existe; depois a impressão digital; e só então a fusão com
 * uma baixa manual que esperava o extrato (§13.3) — que NÃO cria movimentação
 * nova, apenas confirma a que já estava lá.
 */
export function analisarImportacao(input: {
  lidas: LinhaDoExtrato[];
  contaId: string;
  /** `external_id` e `fingerprint` do que já está no banco. */
  jaExistentes: { externalId: string | null; fingerprint: string | null }[];
  /** Baixas manuais aguardando o extrato, da mesma conta. */
  baixasPendentes: { id: string; dataIso: string; valorCent: number }[];
  toleranciaDias?: number;
}): AnaliseDaImportacao {
  const ids = new Set(input.jaExistentes.map((e) => e.externalId).filter(Boolean) as string[]);
  const digitais = new Set(input.jaExistentes.map((e) => e.fingerprint).filter(Boolean) as string[]);
  const tolerancia = input.toleranciaDias ?? 3;
  const usadas = new Set<string>();

  const linhas: LinhaAnalisada[] = input.lidas.map((l) => {
    const digital = impressaoDigital({
      contaId: input.contaId, dataIso: l.dataIso,
      valorCent: l.valorCent, descricaoRaw: l.descricaoRaw,
    });

    if (l.idExterno && ids.has(l.idExterno)) {
      return { ...l, situacao: "existente", baixaId: null };
    }
    if (digitais.has(digital)) {
      return { ...l, situacao: "existente", baixaId: null };
    }

    const baixa = input.baixasPendentes.find((b) =>
      !usadas.has(b.id) &&
      Math.abs(b.valorCent) === Math.abs(l.valorCent) &&
      Math.abs(dias(b.dataIso, l.dataIso)) <= tolerancia);
    if (baixa) {
      usadas.add(baixa.id);
      return { ...l, situacao: "confirma", baixaId: baixa.id };
    }

    return { ...l, situacao: "nova", baixaId: null };
  });

  const datas = linhas.map((l) => l.dataIso).sort();
  return {
    linhas,
    total: linhas.length,
    novas: linhas.filter((l) => l.situacao === "nova").length,
    existentes: linhas.filter((l) => l.situacao === "existente").length,
    confirmam: linhas.filter((l) => l.situacao === "confirma").length,
    periodoInicio: datas[0] ?? null,
    periodoFim: datas[datas.length - 1] ?? null,
  };
}

const dias = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
