/**
 * Teto de chamadas por chave no MCP.
 *
 * Uma chave vazada ou um cliente em laço podem martelar o endpoint sem parar.
 * Cada chamada dispara várias consultas ao banco, então o custo aparece na
 * cota do Supabase antes de aparecer em qualquer outro lugar.
 *
 * Janela deslizante em memória, de propósito:
 *
 *  • Contar no banco custaria uma escrita por requisição — o próprio remédio
 *    viraria parte da doença.
 *  • Em serverless cada instância tem a sua contagem, então o teto real é por
 *    instância. Isso NÃO protege contra um ataque distribuído, e não pretende:
 *    serve para o caso provável, que é um cliente repetindo a mesma chamada e
 *    caindo sempre na instância quente.
 *
 * Módulo puro: o relógio entra por parâmetro, para poder ser testado.
 */

export const LIMITE_POR_MINUTO = 60;
const JANELA_MS = 60_000;

/** Quantas chaves distintas guardar — evita crescer sem limite. */
const MAX_CHAVES = 500;

export type Veredito =
  | { permitido: true; restantes: number }
  | { permitido: false; esperarSegundos: number };

export type Estado = Map<string, number[]>;

export function novoEstado(): Estado {
  return new Map();
}

/**
 * Registra uma chamada e diz se ela pode seguir.
 *
 * `agora` em milissegundos. A janela é deslizante: conta o que aconteceu nos
 * últimos 60s, não “desde o início do minuto” — assim ninguém consegue o dobro
 * do teto disparando na virada.
 */
export function registrarChamada(
  estado: Estado,
  chave: string,
  agora: number,
  limite = LIMITE_POR_MINUTO,
): Veredito {
  const corte = agora - JANELA_MS;
  const anteriores = (estado.get(chave) ?? []).filter((t) => t > corte);

  if (anteriores.length >= limite) {
    estado.set(chave, anteriores);
    // Libera quando a chamada mais antiga sair da janela.
    const esperar = Math.ceil((anteriores[0] + JANELA_MS - agora) / 1000);
    return { permitido: false, esperarSegundos: Math.max(1, esperar) };
  }

  anteriores.push(agora);
  estado.set(chave, anteriores);

  // Faxina: sem isto, uma chave usada uma vez ficaria na memória para sempre.
  if (estado.size > MAX_CHAVES) {
    for (const [k, ts] of estado) {
      if (ts.every((t) => t <= corte)) estado.delete(k);
      if (estado.size <= MAX_CHAVES) break;
    }
  }

  return { permitido: true, restantes: limite - anteriores.length };
}
