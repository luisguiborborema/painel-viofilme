/**
 * A data de hoje, de verdade.
 *
 * Existe porque o painel usava por engano a data fixa dos dados de
 * demonstração: marcava "Qua (hoje)" em qualquer dia da semana e criava tarefas
 * vencendo em 24/06/2026. Módulo próprio e sem dependências, para poder ser
 * testado — data errada não dá erro, só entrega um prazo que não existe.
 */

/** Hoje como "AAAA-MM-DD", no fuso de quem está olhando. */
export function hojeIso(base = new Date()): string {
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
}

/**
 * Índice de hoje na régua Seg–Sex (0=Seg … 4=Sex).
 *
 * Sábado e domingo devolvem -1: a régua só tem dias úteis, e destacar um deles
 * como "hoje" no fim de semana é mentira.
 */
export function hojeIdxSemana(base = new Date()): number {
  const dow = base.getDay(); // 0=Dom … 6=Sáb
  return dow >= 1 && dow <= 5 ? dow - 1 : -1;
}

/** Dia que a régua abre: o de hoje, ou segunda quando é fim de semana. */
export function diaUtilPadrao(base = new Date()): number {
  const idx = hojeIdxSemana(base);
  return idx >= 0 ? idx : 0;
}
