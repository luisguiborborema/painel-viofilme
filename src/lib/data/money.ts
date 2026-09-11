/**
 * Leitura de valores monetários escritos por gente.
 *
 * Vive num módulo próprio porque o mesmo problema aparece em toda entrada de
 * dado do mundo real — extrato de banco, planilha importada, campo digitado.
 * Errar aqui não dá erro: grava um número errado com cara de certo.
 */

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
