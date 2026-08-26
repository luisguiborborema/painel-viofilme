/**
 * Leitura do extrato bancário e casamento com os lançamentos do painel.
 *
 * Client-safe e sem dependências: só parsing e regras puras, para poder ser
 * testado isoladamente. O acesso ao banco fica em `reconciliation-server.ts`.
 *
 * Aceita OFX (o "extrato para o gerenciador financeiro" que todo banco exporta,
 * nas versões SGML 1.x e XML 2.x) e CSV, porque nem toda conta oferece OFX.
 */

export type BankEntry = {
  /** Identificador do banco. Só existe em OFX; é o que evita reimportar. */
  fitid: string | null;
  date: string;   // YYYY-MM-DD
  /** Com sinal: positivo entrou, negativo saiu. */
  amount: number;
  memo: string;
};

export type ExtratoLido = {
  entries: BankEntry[];
  from: string | null;
  to: string | null;
  /** Conta informada pelo arquivo, quando houver (só para exibir). */
  accountHint: string | null;
  formato: "ofx" | "csv";
};

/* --------------------------------- datas ---------------------------------- */

/** OFX usa YYYYMMDD, às vezes com hora e fuso: `20260815120000[-3:BRT]`. */
export function parseDataOfx(raw: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(raw.trim());
  if (!m) return null;
  const [, y, mo, d] = m;
  if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31) return null;
  return `${y}-${mo}-${d}`;
}

/** Aceita dd/mm/aaaa, dd-mm-aaaa, aaaa-mm-dd e dd/mm/aa. */
export function parseDataBr(raw: string): string | null {
  const s = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(s);
  if (!br) return null;
  const d = br[1].padStart(2, "0");
  const mo = br[2].padStart(2, "0");
  // Ano com 2 dígitos: 00–79 → 2000s, 80–99 → 1900s.
  const yRaw = Number(br[3]);
  const y = br[3].length === 4 ? br[3] : String(yRaw < 80 ? 2000 + yRaw : 1900 + yRaw);
  if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31) return null;
  return `${y}-${mo}-${d}`;
}

/* -------------------------------- valores --------------------------------- */

/**
 * Converte valor monetário em número, tolerando os formatos que aparecem em
 * extrato brasileiro: `1.234,56`, `1234.56`, `R$ -1.234,56`, `(1.234,56)`
 * (parênteses = negativo, herança de planilha), `1.234,56 D` (débito).
 */
export function parseValor(raw: string): number | null {
  let s = String(raw).trim();
  if (!s) return null;

  let negativo = false;
  if (/^\(.*\)$/.test(s)) { negativo = true; s = s.slice(1, -1); }
  // Sufixo C/D usado por alguns bancos no lugar do sinal.
  const cd = /\s*([CD])$/i.exec(s);
  if (cd) { if (cd[1].toUpperCase() === "D") negativo = true; s = s.slice(0, cd.index); }

  s = s.replace(/R\$/gi, "").replace(/\s/g, "");
  if (s.startsWith("-")) { negativo = true; s = s.slice(1); }
  else if (s.startsWith("+")) s = s.slice(1);

  // Decide o separador decimal pelo último símbolo presente. O caso ambíguo é
  // um separador só: `1.234` é MILHAR (mil duzentos e trinta e quatro) e
  // `1.23` é decimal — o que distingue é o grupo final ter 3 dígitos, que é
  // como todo extrato brasileiro escreve milhar. Errar isso divide por mil.
  const ultimoSep = Math.max(s.lastIndexOf(","), s.lastIndexOf("."));
  if (ultimoSep < 0) {
    // sem separador: já é inteiro
  } else {
    const decimais = s.length - ultimoSep - 1;
    if (decimais === 3) s = s.replace(/[.,]/g, "");          // milhar
    else s = s.slice(0, ultimoSep).replace(/[.,]/g, "") + "." + s.slice(ultimoSep + 1);
  }

  if (!/^\d*\.?\d*$/.test(s) || s === "" || s === ".") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negativo ? -n : n;
}

/* ---------------------------------- OFX ----------------------------------- */

/** Lê o conteúdo de uma tag SGML/XML do OFX (`<TAG>valor` ou `<TAG>valor</TAG>`). */
function tag(bloco: string, nome: string): string | null {
  const re = new RegExp(`<${nome}>([^<\\r\\n]*)`, "i");
  const m = re.exec(bloco);
  return m ? m[1].trim() : null;
}

export function parseOfx(texto: string): ExtratoLido {
  const entries: BankEntry[] = [];
  // Cada transação vive entre <STMTTRN> e </STMTTRN> nas duas versões do OFX.
  const blocos = texto.split(/<STMTTRN>/i).slice(1);

  for (const bruto of blocos) {
    const bloco = bruto.split(/<\/STMTTRN>/i)[0];
    const dataRaw = tag(bloco, "DTPOSTED") ?? tag(bloco, "DTUSER");
    const valorRaw = tag(bloco, "TRNAMT");
    if (!dataRaw || !valorRaw) continue;
    const date = parseDataOfx(dataRaw);
    const amount = parseValor(valorRaw);
    if (!date || amount === null) continue;

    const memo = [tag(bloco, "MEMO"), tag(bloco, "NAME"), tag(bloco, "CHECKNUM")]
      .filter(Boolean)
      .join(" · ");
    entries.push({
      fitid: tag(bloco, "FITID") || null,
      date,
      amount,
      memo: memo || tag(bloco, "TRNTYPE") || "Lançamento",
    });
  }

  const from = parseDataOfx(tag(texto, "DTSTART") ?? "");
  const to = parseDataOfx(tag(texto, "DTEND") ?? "");
  return {
    entries,
    from: from ?? (entries.length ? entries.map((e) => e.date).sort()[0] : null),
    to: to ?? (entries.length ? entries.map((e) => e.date).sort().at(-1)! : null),
    accountHint: tag(texto, "ACCTID"),
    formato: "ofx",
  };
}

/* ---------------------------------- CSV ----------------------------------- */

/** Quebra uma linha de CSV respeitando aspas. */
function colunas(linha: string, sep: string): string[] {
  const out: string[] = [];
  let atual = "";
  let dentro = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (dentro && linha[i + 1] === '"') { atual += '"'; i++; }
      else dentro = !dentro;
    } else if (c === sep && !dentro) { out.push(atual); atual = ""; }
    else atual += c;
  }
  out.push(atual);
  return out.map((c) => c.trim());
}

/**
 * CSV de extrato: descobre sozinho o separador e quais colunas são data, valor
 * e histórico — bancos brasileiros não seguem um padrão único.
 *
 * Quando há colunas separadas de débito e crédito (layout comum), usa as duas.
 */
export function parseCsvExtrato(texto: string): ExtratoLido {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim());
  if (linhas.length === 0) return { entries: [], from: null, to: null, accountHint: null, formato: "csv" };

  // Separador = o que mais aparece na primeira linha densa.
  const amostra = linhas.slice(0, 5).join("\n");
  const sep = [";", ",", "\t"].sort(
    (a, b) => (amostra.split(b).length - amostra.split(a).length),
  )[0];

  const norm = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  // Cabeçalho, se houver: a primeira linha cuja primeira célula não é data.
  const primeira = colunas(linhas[0], sep);
  const temCabecalho = parseDataBr(primeira[0] ?? "") === null;
  const head = temCabecalho ? primeira.map(norm) : [];

  const acha = (...termos: string[]) =>
    head.findIndex((h) => termos.some((t) => h.includes(t)));

  let iData = temCabecalho ? acha("data", "date") : 0;
  let iValor = temCabecalho ? acha("valor", "amount", "montante") : -1;
  const iDesc = temCabecalho ? acha("descri", "historico", "memo", "lancamento", "detalhe") : -1;
  const iDeb = temCabecalho ? acha("debito", "saida") : -1;
  const iCred = temCabecalho ? acha("credito", "entrada") : -1;
  if (iData < 0) iData = 0;

  const entries: BankEntry[] = [];
  for (const linha of linhas.slice(temCabecalho ? 1 : 0)) {
    const c = colunas(linha, sep);
    const date = parseDataBr(c[iData] ?? "");
    if (!date) continue;

    let amount: number | null = null;
    if (iDeb >= 0 || iCred >= 0) {
      const deb = iDeb >= 0 ? parseValor(c[iDeb] ?? "") : null;
      const cred = iCred >= 0 ? parseValor(c[iCred] ?? "") : null;
      if (cred) amount = Math.abs(cred);
      else if (deb) amount = -Math.abs(deb);
    }
    if (amount === null && iValor >= 0) amount = parseValor(c[iValor] ?? "");
    if (amount === null) {
      // Sem cabeçalho útil: usa a última célula que parece dinheiro.
      for (let i = c.length - 1; i > iData; i--) {
        const v = parseValor(c[i]);
        if (v !== null && /[.,]\d{2}\s*[CD]?$|^\(?\s*R?\$?\s*-?\d/.test(c[i])) { amount = v; iValor = i; break; }
      }
    }
    if (amount === null || amount === 0) continue;

    const memo = iDesc >= 0
      ? (c[iDesc] ?? "")
      : c.filter((_, i) => i !== iData && i !== iValor).find((x) => x && parseValor(x) === null) ?? "Lançamento";
    entries.push({ fitid: null, date, amount, memo: memo || "Lançamento" });
  }

  const datas = entries.map((e) => e.date).sort();
  return { entries, from: datas[0] ?? null, to: datas.at(-1) ?? null, accountHint: null, formato: "csv" };
}

/** Detecta o formato pelo conteúdo e lê. */
export function lerExtrato(texto: string): ExtratoLido {
  return /<(OFX|STMTTRN)>/i.test(texto) ? parseOfx(texto) : parseCsvExtrato(texto);
}
