/**
 * Download de mídia recebida via Uazapi (server-only).
 * POST {UAZAPI_URL}/message/download → devolve a mídia decodificada.
 *
 * As URLs que o WhatsApp envia no webhook são criptografadas (.enc); este
 * endpoint baixa o conteúdo já utilizável (base64), opcionalmente convertendo
 * áudio para mp3 (tocável no navegador).
 */
import { UAZAPI_TOKEN, UAZAPI_URL, isWhatsappConfigured } from "./config";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null;

function pick(obj: Obj, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return undefined;
}

export type DownloadedMedia = { base64: string; mimetype?: string };

/** Baixa a mídia de uma mensagem pelo id. Retorna base64 + mimetype, ou null. */
export async function downloadUazapiMedia(
  id: string,
  opts?: { audio?: boolean },
): Promise<DownloadedMedia | null> {
  if (!isWhatsappConfigured() || !id) return null;
  try {
    const res = await fetch(`${UAZAPI_URL}/message/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token: UAZAPI_TOKEN },
      body: JSON.stringify({
        id,
        return_base64: true,
        generate_mp3: opts?.audio ?? false,
        return_link: false,
        transcribe: false,
        download_quoted: false,
      }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    if (!isObj(json)) return null;

    // O corpo pode aninhar o resultado em data/message/fileData.
    const root = isObj(json.data) ? json.data : json;
    let base64 =
      pick(root, ["base64", "fileBase64", "media", "file", "buffer", "content"]) ??
      (isObj(root.message) ? pick(root.message, ["base64", "fileBase64"]) : undefined);
    if (!base64) return null;

    // Remove prefixo data:...;base64, se vier.
    const comma = base64.indexOf("base64,");
    if (comma >= 0) base64 = base64.slice(comma + 7);

    const mimetype = pick(root, ["mimetype", "mimeType", "type", "contentType"]);
    return { base64, mimetype };
  } catch {
    return null;
  }
}
