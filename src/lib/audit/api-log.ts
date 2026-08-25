import "server-only";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Log das chamadas à API (Admin → Logs de API).
 *
 * Best-effort: nunca lança nem atrasa a resposta — se o log falhar, a chamada
 * segue normalmente. Não grava corpo da requisição (evita reter dado pessoal).
 */
export type ApiLogInput = {
  method: string;
  path: string;
  source: string;
  status: number;
  durationMs: number;
  ip?: string | null;
  userAgent?: string | null;
  actor?: string | null;
  error?: string | null;
  meta?: Record<string, unknown>;
};

export async function logApiCall(e: ApiLogInput): Promise<void> {
  if (!isSupabaseConfigured() || !hasServiceRole()) return;
  try {
    const admin = createAdminClient();
    await admin.from("api_logs").insert({
      method: e.method,
      path: e.path.slice(0, 300),
      source: e.source,
      status: e.status,
      ok: e.status > 0 && e.status < 400,
      duration_ms: Math.max(0, Math.round(e.durationMs)),
      ip: e.ip ?? null,
      user_agent: (e.userAgent ?? "").slice(0, 300) || null,
      actor: e.actor ?? null,
      error: e.error ? String(e.error).slice(0, 500) : null,
      meta: e.meta ?? {},
    });
  } catch {
    /* best-effort: o log nunca derruba a chamada */
  }
}

/** IP de origem, considerando o proxy da Vercel. */
function clientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip");
}

// Genérico no tipo da requisição: as rotas usam Request ou NextRequest.
type Handler<Req extends Request, C> = (req: Req, ctx: C) => Promise<Response> | Response;

/**
 * Envolve um route handler para registrar método, status, duração e erro.
 *
 * Uso:
 *   export const POST = withApiLog("webhook:asaas", async (req) => { … });
 *
 * Aplicado nos endpoints que sistemas externos chamam. As rotas internas do
 * painel já são cobertas por Monitoramento (audit_events).
 */
export function withApiLog<Req extends Request, C>(source: string, handler: Handler<Req, C>): Handler<Req, C> {
  return async (req: Req, ctx: C) => {
    const started = Date.now();
    const path = (() => {
      try {
        return new URL(req.url).pathname;
      } catch {
        return req.url;
      }
    })();

    try {
      const res = await handler(req, ctx);
      void logApiCall({
        method: req.method,
        path,
        source,
        status: res.status,
        durationMs: Date.now() - started,
        ip: clientIp(req),
        userAgent: req.headers.get("user-agent"),
      });
      return res;
    } catch (err) {
      void logApiCall({
        method: req.method,
        path,
        source,
        status: 500,
        durationMs: Date.now() - started,
        ip: clientIp(req),
        userAgent: req.headers.get("user-agent"),
        error: err instanceof Error ? err.message : "erro desconhecido",
      });
      throw err;
    }
  };
}
