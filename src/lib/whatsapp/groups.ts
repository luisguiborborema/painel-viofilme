/**
 * Lista os grupos de WhatsApp do número conectado (Uazapi). Server-only.
 * Uazapi: GET /group/list. A forma da resposta varia entre versões, então
 * parseamos defensivamente. Retorna [] se não configurado ou em erro.
 */
import { UAZAPI_TOKEN, UAZAPI_URL } from "./config";

export type WaGroup = { jid: string; name: string; participants: number };
export type WaConn = { url?: string; token?: string };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null;

function pick(obj: Obj, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return "";
}

function pickNum(obj: Obj, keys: string[]): number {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number") return v;
    if (Array.isArray(v)) return v.length;
    if (typeof v === "string" && /^\d+$/.test(v)) return Number(v);
  }
  return 0;
}

export async function listWhatsappGroups(force = false, conn?: WaConn): Promise<WaGroup[]> {
  const url = (conn?.url && conn.url.startsWith("http") ? conn.url.replace(/\/+$/, "") : UAZAPI_URL);
  const token = conn?.token && conn.token.length > 0 ? conn.token : UAZAPI_TOKEN;
  if (!url.startsWith("http") || !token) return [];
  try {
    const res = await fetch(`${url}/group/list?force=${force ? "true" : "false"}`, {
      headers: { token },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data: unknown = await res.json().catch(() => null);
    const arr: unknown[] = Array.isArray(data)
      ? data
      : isObj(data)
        ? ((data.groups ?? data.chats ?? data.data ?? []) as unknown[])
        : [];

    const out: WaGroup[] = [];
    const seen = new Set<string>();
    for (const raw of arr) {
      if (!isObj(raw)) continue;
      let jid = pick(raw, ["JID", "jid", "id", "chatid", "gid", "groupJid"]);
      if (!jid) continue;
      if (!jid.includes("@")) jid = `${jid}@g.us`;
      if (!jid.includes("g.us") || seen.has(jid)) continue;
      seen.add(jid);
      out.push({
        jid,
        name: pick(raw, ["name", "subject", "Name", "Subject", "title"]) || jid.split("@")[0],
        participants: pickNum(raw, ["size", "participants", "Participants", "numParticipants", "membersCount"]),
      });
    }
    out.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return out;
  } catch {
    return [];
  }
}
