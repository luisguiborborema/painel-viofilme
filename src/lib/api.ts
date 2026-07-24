import { toast } from "@/components/ui/toast";

export type ApiResult<T = unknown> = { ok: boolean; error?: string; data?: T };

/**
 * POST JSON com tratamento de erro embutido: em falha (rede, !res.ok ou
 * { error }), dispara um toast e devolve { ok:false }. Em sucesso, { ok:true }.
 * Use nos saves onde falhar silenciosamente = perda de dados.
 */
export async function apiPost<T = unknown>(url: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
    if (!res.ok || data?.error) {
      const error = data?.error ?? `Erro ${res.status}`;
      toast(error, "error");
      return { ok: false, error, data };
    }
    return { ok: true, data };
  } catch {
    toast("Sem conexão com o servidor. Tente de novo.", "error");
    return { ok: false, error: "network" };
  }
}

/**
 * Envolve um fetch existente para tocar um toast em falha, SEM mudar o tipo de
 * retorno (continua um Response). Usa res.clone() para não consumir o corpo —
 * o chamador ainda pode ler .json(). Ideal para atualizar helpers `post(...)`
 * já existentes sem tocar nos call sites.
 */
export async function withToast(p: Promise<Response>): Promise<Response | null> {
  try {
    const res = await p;
    if (!res.ok) {
      const data = (await res.clone().json().catch(() => ({}))) as { error?: string };
      toast(data?.error ?? `Erro ${res.status} ao salvar.`, "error");
    }
    return res;
  } catch {
    toast("Sem conexão com o servidor. Tente de novo.", "error");
    return null;
  }
}
