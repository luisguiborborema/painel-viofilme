/**
 * Configuração do WhatsApp via Uazapi.
 * - UAZAPI_URL: base do servidor (ex.: https://xxxx.uazapi.com).
 * - UAZAPI_TOKEN: token da instância conectada.
 * - UAZAPI_NOTIFY_NUMBERS: números que recebem os alertas INTERNOS (agência),
 *   separados por vírgula (com DDI/DDD, ex.: 5527999998888).
 */
export const UAZAPI_URL = (process.env.UAZAPI_URL ?? "").replace(/\/+$/, "");
export const UAZAPI_TOKEN = process.env.UAZAPI_TOKEN ?? "";

export const WHATSAPP_NOTIFY_NUMBERS = (process.env.UAZAPI_NOTIFY_NUMBERS ?? "")
  .split(",")
  .map((s) => s.replace(/\D/g, ""))
  .filter((s) => s.length >= 10);

export function isWhatsappConfigured(): boolean {
  return UAZAPI_URL.startsWith("http") && UAZAPI_TOKEN.length > 0;
}

/** Mantém só dígitos (Uazapi espera o número com DDI/DDD, sem símbolos). */
export function normalizeNumber(n: string): string {
  return (n ?? "").replace(/\D/g, "");
}
