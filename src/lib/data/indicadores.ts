/**
 * Indicadores que só existem com amostra.
 *
 * Contador e média são coisas diferentes. "3 contas em risco" com zero contas
 * é 0, e 0 está certo. Já a média das reuniões numa escala de 1 a 5 nunca
 * poderia ser 0.0 — e o NPS, que vai de −100 a +100, tem 0 como nota real e
 * medíocre. Quando não houve resposta, imprimir 0 não é neutro: afirma um
 * resultado ruim que ninguém mediu.
 *
 * O sintoma em produção era uma tela com "0.0 ★" em vermelho no cartão de cima
 * e "Nenhuma avaliação de reunião ainda" na lista logo abaixo — a mesma tela
 * se contradizendo.
 *
 * Client-safe: só funções puras.
 */

/** Traço quando não há amostra; o número formatado quando há. */
export function textoDoIndicador(valor: number, amostras: number, casas = 0): string {
  if (!Number.isFinite(amostras) || amostras <= 0) return "—";
  const n = Number(valor);
  if (!Number.isFinite(n)) return "—";
  return casas > 0 ? n.toFixed(casas) : String(Math.round(n));
}

/**
 * Cor do indicador. Sem amostra, a cor precisa ser neutra: vermelho em cima de
 * um traço ainda comunica "ruim" para quem lê rápido.
 */
export function tomDoIndicador(amostras: number, tomComDado: string, tomSemDado = "text-muted"): string {
  return Number.isFinite(amostras) && amostras > 0 ? tomComDado : tomSemDado;
}

/** Legenda abaixo do número. Plural correto e um empurrão quando está vazio. */
export function legendaDaAmostra(amostras: number, singular: string, plural: string, vazio: string): string {
  const n = Number(amostras);
  if (!Number.isFinite(n) || n <= 0) return vazio;
  return `${n} ${n === 1 ? singular : plural}`;
}
