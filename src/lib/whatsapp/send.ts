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

/** Resultado detalhado de um envio — carrega o motivo do erro (para o log). */
export type WaSendResult = { ok: boolean; error?: string };
const TIMEOUT_MS = 20_000;

/** Extrai um motivo curto e legível da resposta da Uazapi. */
async function readError(res: Response): Promise<string> {
  let body = "";
  try {
    body = (await res.text()).slice(0, 300);
  } catch {
    /* ignore */
  }
  return `uazapi_${res.status}${body ? ` ${body}` : ""}`.trim();
}

async function post(url: string, token: string, payload: unknown): Promise<WaSendResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", token },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (res.ok) return { ok: true };
    return { ok: false, error: await readError(res) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    return { ok: false, error: /abort/i.test(msg) ? "timeout" : msg };
  } finally {
    clearTimeout(timer);
  }
}

/** Texto para número OU JID de grupo, com motivo do erro. */
export async function sendWhatsappToDetailed(target: string, text: string, conn?: WaConn): Promise<WaSendResult> {
  if (!connReady(conn)) return { ok: false, error: "whatsapp não configurado" };
  const isJid = target.includes("@");
  const num = isJid ? target : normalizeNumber(target);
  if (!num || (!isJid && num.length < 10)) return { ok: false, error: "número inválido" };
  return post(`${connUrl(conn)}/send/text`, connToken(conn), { number: num, text });
}

/** Mídia por URL para número OU JID de grupo, com motivo do erro. */
export async function sendWhatsappMediaToDetailed(
  target: string,
  type: WaMediaType,
  fileUrl: string,
  opts?: { caption?: string; filename?: string },
  conn?: WaConn,
): Promise<WaSendResult> {
  if (!connReady(conn)) return { ok: false, error: "whatsapp não configurado" };
  const isJid = target.includes("@");
  const num = isJid ? target : normalizeNumber(target);
  if (!num || (!isJid && num.length < 10)) return { ok: false, error: "número inválido" };
  if (!fileUrl) return { ok: false, error: "mídia ausente" };
  return post(`${connUrl(conn)}/send/media`, connToken(conn), {
    number: num,
    type,
    file: fileUrl,
    ...(opts?.caption ? { text: opts.caption } : {}),
    ...(opts?.filename ? { docName: opts.filename } : {}),
  });
}

/** Versões boolean (compat). */
export async function sendWhatsappTo(target: string, text: string, conn?: WaConn): Promise<boolean> {
  return (await sendWhatsappToDetailed(target, text, conn)).ok;
}
export async function sendWhatsappMediaTo(
  target: string,
  type: WaMediaType,
  fileUrl: string,
  opts?: { caption?: string; filename?: string },
  conn?: WaConn,
): Promise<boolean> {
  return (await sendWhatsappMediaToDetailed(target, type, fileUrl, opts, conn)).ok;
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
