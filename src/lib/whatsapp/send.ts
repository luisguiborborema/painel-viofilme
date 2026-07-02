/**
 * Envio de mensagens via Uazapi (WhatsApp). Server-only.
 * No-op silencioso se não estiver configurado.
 */
import {
  UAZAPI_TOKEN,
  UAZAPI_URL,
  isWhatsappConfigured,
  normalizeNumber,
} from "./config";

/** Envia um texto para um número. Retorna true se o envio foi aceito. */
export async function sendWhatsappText(
  number: string,
  text: string,
): Promise<boolean> {
  if (!isWhatsappConfigured()) return false;
  const num = normalizeNumber(number);
  if (num.length < 10) return false;

  try {
    const res = await fetch(`${UAZAPI_URL}/send/text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token: UAZAPI_TOKEN,
      },
      body: JSON.stringify({ number: num, text }),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}
