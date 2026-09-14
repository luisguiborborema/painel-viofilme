/**
 * Cor de cliente no Painel de Entregas.
 *
 * No Calendário e no Kanban a cor **é** o identificador do cliente — a pessoa
 * aprende "verde é o Jequitibá" e passa a ler o quadro pela cor, sem ler o
 * nome. Por isso a cor precisa ser propriedade do cliente, não da posição dele
 * numa lista.
 *
 * Client-safe: só constante e função pura.
 */

export const CLIENT_PALETTE = [
  "#2a63c9", "#059669", "#d97706", "#7c3aed", "#e11d48", "#0284c7", "#be185d", "#0f766e",
];

/**
 * Cor estável a partir do nome.
 *
 * Antes saía do índice do cliente numa lista ordenada dos que têm tarefa. No
 * dia em que um cliente novo recebia a primeira tarefa, ele entrava no meio da
 * ordem alfabética e empurrava a cor de todos os seguintes — quem lia o quadro
 * pela cor passava a ler errado, sem aviso nenhum.
 */
export function corDoCliente(nome: string): string {
  const s = String(nome ?? "");
  if (!s) return CLIENT_PALETTE[0];
  // djb2: espalha bem para nomes curtos e cabe em duas linhas.
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return CLIENT_PALETTE[Math.abs(h) % CLIENT_PALETTE.length];
}
