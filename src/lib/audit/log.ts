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
