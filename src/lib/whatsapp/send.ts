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

export type WaMediaType = "image" | "audio" | "video" | "document";

/** Conexão Uazapi opcional (instância/atendente específico). Sem ela, usa o env. */
export type WaConn = { url?: string; token?: string };
const connUrl = (c?: WaConn) => (c?.url && c.url.startsWith("http") ? c.url.replace(/\/+$/, "") : UAZAPI_URL);
const connToken = (c?: WaConn) => (c?.token && c.token.length > 0 ? c.token : UAZAPI_TOKEN);
const connReady = (c?: WaConn) => connUrl(c).startsWith("http") && connToken(c).length > 0;

/**
 * Envia um texto para um alvo que pode ser número OU JID de grupo (…@g.us).
 * Grupos não passam por normalizeNumber (o JID contém "@" e "-").
 */
export async function sendWhatsappTo(target: string, text: string, conn?: WaConn): Promise<boolean> {
  if (!connReady(conn)) return false;
  const isJid = target.includes("@");
  const num = isJid ? target : normalizeNumber(target);
  if (!num || (!isJid && num.length < 10)) return false;

  try {
    const res = await fetch(`${connUrl(conn)}/send/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token: connToken(conn) },
      body: JSON.stringify({ number: num, text }),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Envia mídia por URL para número OU JID de grupo. */
export async function sendWhatsappMediaTo(
  target: string,
  type: WaMediaType,
  fileUrl: string,
  opts?: { caption?: string; filename?: string },
  conn?: WaConn,
): Promise<boolean> {
  if (!connReady(conn)) return false;
  const isJid = target.includes("@");
  const num = isJid ? target : normalizeNumber(target);
  if (!num || (!isJid && num.length < 10) || !fileUrl) return false;

  try {
    const res = await fetch(`${connUrl(conn)}/send/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token: connToken(conn) },
      body: JSON.stringify({
        number: num,
        type,
        file: fileUrl,
        ...(opts?.caption ? { text: opts.caption } : {}),
        ...(opts?.filename ? { docName: opts.filename } : {}),
      }),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Envia mídia (imagem/áudio/vídeo/documento) por URL pública.
 * POST {UAZAPI_URL}/send/media  body { number, type, file, text? }
 */
export async function sendWhatsappMedia(
  number: string,
  type: WaMediaType,
  fileUrl: string,
  opts?: { caption?: string; filename?: string },
): Promise<boolean> {
  if (!isWhatsappConfigured()) return false;
  const num = normalizeNumber(number);
  if (num.length < 10 || !fileUrl) return false;

  try {
    const res = await fetch(`${UAZAPI_URL}/send/media`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token: UAZAPI_TOKEN,
      },
      body: JSON.stringify({
        number: num,
        type,
        file: fileUrl,
        ...(opts?.caption ? { text: opts.caption } : {}),
        ...(opts?.filename ? { docName: opts.filename } : {}),
      }),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}
