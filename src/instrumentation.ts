import type { Instrumentation } from "next";

/**
 * Erros de servidor não tratados vão para os Logs de API (Admin → Logs de API).
 *
 * Cobre QUALQUER rota — inclusive as internas, que não passam pelo withApiLog.
 * Best-effort: o import é dinâmico para não carregar o Supabase no boot, e uma
 * falha aqui nunca afeta a resposta ao usuário.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  try {
    const { logApiCall } = await import("@/lib/audit/api-log");
    await logApiCall({
      method: request.method ?? "GET",
      path: request.path ?? "",
      source: "erro",
      status: 500,
      durationMs: 0,
      error: err instanceof Error ? err.message : String(err),
      meta: { routerKind: context.routerKind, routePath: context.routePath, routeType: context.routeType },
    });
  } catch {
    /* best-effort */
  }
};
