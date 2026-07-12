/**
 * Notificações in-app (o sininho). Escrita via service_role — no-op silencioso
 * se o Supabase/serviço não estiver configurado (modo demo).
 */
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { allowedForCategory } from "@/lib/notify-prefs";
import type { NotifCategory } from "@/lib/notify-categories";

export type NotificationInput = {
  title: string;
  body?: string;
  url?: string;
  /** Categoria p/ respeitar as preferências do usuário (silenciar). */
  category?: NotifCategory;
};

function ready(): boolean {
  return isSupabaseConfigured() && hasServiceRole();
}

/** Cria uma notificação para cada usuário informado (respeitando preferências). */
export async function createNotifications(
  userIds: string[],
  n: NotificationInput,
): Promise<void> {
  let ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length || !ready()) return;
  if (n.category) ids = await allowedForCategory(ids, n.category);
  if (!ids.length) return;
  try {
    const admin = createAdminClient();
    await admin.from("notifications").insert(
      ids.map((id) => ({
        user_id: id,
        title: n.title,
        body: n.body ?? null,
        url: n.url ?? null,
      })),
    );
  } catch {
    /* best-effort */
  }
}

/** Notifica toda a equipe gerencial (opcionalmente exceto um usuário). */
export async function notifyManagementInApp(
  n: NotificationInput,
  exceptUserId?: string,
): Promise<void> {
  if (!ready()) return;
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("profiles").select("id").eq("role", "gerencial");
    const ids = (data ?? [])
      .map((p) => String(p.id))
      .filter((id) => id !== exceptUserId);
    await createNotifications(ids, n);
  } catch {
    /* best-effort */
  }
}

/** Notifica todos os usuários vinculados a um cliente. */
export async function notifyClientInApp(
  clientId: string,
  n: NotificationInput,
): Promise<void> {
  if (!ready()) return;
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("profiles").select("id").eq("client_id", clientId);
    await createNotifications((data ?? []).map((p) => String(p.id)), n);
  } catch {
    /* best-effort */
  }
}
