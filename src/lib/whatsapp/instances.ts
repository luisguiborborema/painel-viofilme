/**
 * Instâncias/atendentes de WhatsApp (Uazapi). Server-only.
 *
 * Fonte: env UAZAPI_INSTANCES (JSON: [{ "name","token","url"? }, …]) para
 * múltiplos números. Se ausente, cai na instância única do env (UAZAPI_URL/
 * UAZAPI_TOKEN). O token NUNCA vai ao cliente — a API expõe só um id opaco.
 */
import { UAZAPI_TOKEN, UAZAPI_URL, isWhatsappConfigured } from "./config";

export type WaInstance = { id: string; name: string; url: string; token: string; connected?: boolean };
/** Versão sem segredo, segura para o cliente. */
export type WaInstancePublic = { id: string; name: string; connected: boolean };

function short(token: string): string {
  return token.slice(0, 8);
}

/** Todas as instâncias configuradas (com token — só use no servidor). */
export function getWhatsappInstances(): WaInstance[] {
  const raw = process.env.UAZAPI_INSTANCES;
  if (raw) {
    try {
      const arr = JSON.parse(raw) as { name?: string; token?: string; url?: string }[];
      const list = (Array.isArray(arr) ? arr : [])
        .filter((x) => x && typeof x.token === "string" && x.token.length > 0)
        .map((x) => ({
          id: short(String(x.token)),
          name: String(x.name ?? "Instância").trim() || "Instância",
          url: (x.url ?? UAZAPI_URL).replace(/\/+$/, ""),
          token: String(x.token),
        }));
      if (list.length > 0) return list;
    } catch {
      /* JSON inválido → usa fallback */
    }
  }
  if (isWhatsappConfigured()) {
    return [{ id: short(UAZAPI_TOKEN), name: "Instância principal", url: UAZAPI_URL, token: UAZAPI_TOKEN }];
  }
  return [];
}

/** Resolve a conexão (url/token) a partir do id opaco; null se não achar. */
export function resolveInstance(id?: string | null): WaInstance | null {
  const list = getWhatsappInstances();
  if (!list.length) return null;
  if (!id) return list[0];
  return list.find((i) => i.id === id) ?? list[0];
}

/** Consulta o status/nome de conexão de uma instância (best-effort). */
async function probe(inst: WaInstance): Promise<boolean> {
  try {
    const res = await fetch(`${inst.url}/instance/status`, { headers: { token: inst.token }, cache: "no-store" });
    if (!res.ok) return false;
    const j: unknown = await res.json().catch(() => null);
    if (j && typeof j === "object") {
      const o = j as Record<string, unknown>;
      const s = String(o.status ?? o.state ?? (o.instance as Record<string, unknown> | undefined)?.status ?? "").toLowerCase();
      if (s) return /connected|open|online|conectado/.test(s);
    }
    return true; // respondeu 200 mas sem campo reconhecível → assume ok
  } catch {
    return false;
  }
}

/** Lista pública (sem token) com estado de conexão. */
export async function listWhatsappInstancesPublic(): Promise<WaInstancePublic[]> {
  const list = getWhatsappInstances();
  const states = await Promise.all(list.map((i) => probe(i)));
  return list.map((i, idx) => ({ id: i.id, name: i.name, connected: states[idx] }));
}
