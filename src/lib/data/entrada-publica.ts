/**
 * Saneamento das entradas que vêm da internet aberta.
 *
 * Os formulários públicos (captura, NPS, agendamento, pesquisa) não têm login:
 * qualquer pessoa com o link pode enviar. Duas consequências que precisam de
 * defesa explícita:
 *
 *  • Texto sem limite — nada impede um campo "nome" de 5 MB, que entra no banco
 *    e depois aparece esticando a tela de quem for ler.
 *  • Envio sem limite — dá para inundar o CRM de negócios falsos até ninguém
 *    conseguir achar os de verdade.
 *
 * Client-safe: só regras puras.
 */

/** Tamanhos máximos por tipo de campo, em caracteres. */
export const LIMITES = {
  nome: 120,
  empresa: 160,
  email: 200,
  telefone: 32,
  curto: 200,
  texto: 4000,
} as const;

export type TipoCampo = keyof typeof LIMITES;

/**
 * Apara e corta um campo de texto vindo de fora.
 *
 * Corta em vez de recusar: quem preencheu um formulário longo demais prefere
 * ver o cadastro entrar do que perder tudo o que digitou. O excesso quase
 * sempre é colagem acidental.
 */
export function limitar(v: unknown, tipo: TipoCampo = "curto"): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return s.slice(0, LIMITES[tipo]);
}

/** Só dígitos, limitado — telefone com lixo é comum em formulário. */
export function telefoneLimpo(v: unknown): string | null {
  const d = String(v ?? "").replace(/\D/g, "").slice(0, LIMITES.telefone);
  return d || null;
}

/**
 * E-mail plausível. Não valida entrega — só descarta o que claramente não é
 * e-mail, para não encher a base de lixo que ninguém vai conseguir usar.
 */
export function emailPlausivel(v: unknown): string | null {
  const s = limitar(v, "email");
  if (!s) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) ? s.toLowerCase() : null;
}

/**
 * Propriedades extras do formulário: limita quantidade E tamanho.
 *
 * Sem isto, um payload com dez mil chaves entra inteiro no jsonb do negócio.
 */
export function limitarPropriedades(
  props: unknown,
  maxChaves = 40,
): Record<string, string> {
  if (!props || typeof props !== "object" || Array.isArray(props)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(props as Record<string, unknown>)) {
    if (Object.keys(out).length >= maxChaves) break;
    const chave = String(k).slice(0, 80);
    const valor = limitar(v, "texto");
    if (chave && valor) out[chave] = valor;
  }
  return out;
}

/* ------------------------- Limite de envios por IP ------------------------- */

export const ENVIOS_POR_HORA = 20;
const JANELA_MS = 60 * 60_000;
const MAX_IPS = 2000;

export type EstadoEnvios = Map<string, number[]>;
export const novoEstadoEnvios = (): EstadoEnvios => new Map();

/**
 * Um formulário público legítimo é preenchido uma vez, talvez duas. Vinte por
 * hora do mesmo IP já é muito — e é o bastante para não atrapalhar quem está
 * atrás de um provedor compartilhado.
 */
export function podeEnviar(
  estado: EstadoEnvios,
  ip: string,
  agora: number,
  limite = ENVIOS_POR_HORA,
): { ok: true; restantes: number } | { ok: false; esperarMinutos: number } {
  const corte = agora - JANELA_MS;
  const recentes = (estado.get(ip) ?? []).filter((t) => t > corte);

  if (recentes.length >= limite) {
    estado.set(ip, recentes);
    return { ok: false, esperarMinutos: Math.max(1, Math.ceil((recentes[0] + JANELA_MS - agora) / 60_000)) };
  }

  recentes.push(agora);
  estado.set(ip, recentes);

  if (estado.size > MAX_IPS) {
    for (const [k, ts] of estado) {
      if (ts.every((t) => t <= corte)) estado.delete(k);
      if (estado.size <= MAX_IPS) break;
    }
  }
  return { ok: true, restantes: limite - recentes.length };
}
