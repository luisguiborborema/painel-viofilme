/**
 * Filtro de destinatários por preferência (servidor, service_role).
 * Decide quem, dentre uma lista de user_ids, aceita receber determinada
 * categoria. Fail-open: sem linha de preferência ou sem serviço → recebe.
 */
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import type { NotifCategory } from "@/lib/notify-categories";

/** Retorna os user_ids que NÃO silenciaram a categoria informada. */
export async function allowedForCategory(
  userIds: string[],
  category: NotifCategory,
): Promise<string[]> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return ids;
  if (!isSupabaseConfigured() || !hasServiceRole()) return ids;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("notification_preferences")
      .select("user_id, muted")
      .in("user_id", ids);
    const mutedBy = new Map(
      (data ?? []).map((r) => [String(r.user_id), (r.muted as string[]) ?? []]),
    );
    return ids.filter((id) => !(mutedBy.get(id) ?? []).includes(category));
  } catch {
    return ids; // fail-open
  }
}
