/**
 * Configuração de Web Push (VAPID).
 * A chave pública é exposta ao cliente (NEXT_PUBLIC); a privada só no servidor.
 */
export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

/** Há chave pública VAPID configurada? (habilita a UI de push.) */
export function isPushConfigured(): boolean {
  return VAPID_PUBLIC_KEY.length > 20;
}
