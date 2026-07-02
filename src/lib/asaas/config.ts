/**
 * Configuração da integração Asaas.
 * - ASAAS_WEBHOOK_TOKEN: token que o Asaas envia no header `asaas-access-token`.
 * - ASAAS_API_KEY: chave para chamadas de saída (backfill/consulta) — futuro.
 * - ASAAS_ENV: "sandbox" | "production" (base da API para chamadas de saída).
 */
export const ASAAS_WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN ?? "";
export const ASAAS_API_KEY = process.env.ASAAS_API_KEY ?? "";
export const ASAAS_ENV = process.env.ASAAS_ENV === "production" ? "production" : "sandbox";

export const ASAAS_API_BASE =
  ASAAS_ENV === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";

export function isAsaasWebhookConfigured(): boolean {
  return ASAAS_WEBHOOK_TOKEN.length > 0;
}

/** Comparação em tempo constante (evita timing attack no token). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
