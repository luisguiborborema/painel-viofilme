import "server-only";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { SessionUser } from "@/lib/auth/types";

export type AuditInput = {
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  panel?: "gerencial" | "cliente";
  /** login|logout|pageview|status_change|edit|create|move|delete|update|... */
  action: string;
  area: string;
  target?: string | null;
  detail?: string | null;
  meta?: Record<string, unknown>;
};

/**
 * Registra um evento de auditoria/monitoramento. Best-effort: nunca lança nem
 * bloqueia o fluxo principal. Sem Supabase/service-role, é no-op (modo demo).
 */
export async function logEvent(e: AuditInput): Promise<void> {
  if (!isSupabaseConfigured() || !hasServiceRole()) return;
  try {
    const admin = createAdminClient();
    await admin.from("audit_events").insert({
      user_id: e.userId ?? null,
      user_name: e.userName ?? null,
      user_email: e.userEmail ?? null,
      panel: e.panel ?? "gerencial",
      action: e.action,
      area: e.area,
      target: e.target ?? null,
      detail: e.detail ?? null,
      meta: e.meta ?? {},
    });
  } catch {
    /* best-effort: monitoramento nunca derruba a ação principal */
  }
}

/**
 * Retenção: apaga navegação (pageview) com +90 dias e qualquer evento com
 * +365 dias. Best-effort; chamado pelo cron diário. Retorna quantos removeu.
 */
export async function purgeOldAuditEvents(): Promise<{ pageviews: number; events: number }> {
  if (!isSupabaseConfigured() || !hasServiceRole()) return { pageviews: 0, events: 0 };
  const admin = createAdminClient();
  const pv90 = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const all365 = new Date(Date.now() - 365 * 86_400_000).toISOString();
  let pageviews = 0;
  let events = 0;
  try {
    const { count } = await admin
      .from("audit_events")
      .delete({ count: "exact" })
      .eq("action", "pageview")
      .lt("created_at", pv90);
    pageviews = count ?? 0;
  } catch {
    /* ignore */
  }
  try {
    const { count } = await admin
      .from("audit_events")
      .delete({ count: "exact" })
      .lt("created_at", all365);
    events = count ?? 0;
  } catch {
    /* ignore */
  }
  return { pageviews, events };
}

/** Atalho: registra um evento já preenchendo quem/painel a partir da sessão. */
export async function logFromUser(
  user: Pick<SessionUser, "id" | "name" | "email" | "role"> | null | undefined,
  e: { action: string; area: string; target?: string | null; detail?: string | null; meta?: Record<string, unknown> },
): Promise<void> {
  if (!user) return;
  await logEvent({
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    panel: user.role === "cliente" ? "cliente" : "gerencial",
    ...e,
  });
}
