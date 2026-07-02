/**
 * Envio de Web Push (servidor).
 *
 * Resolve o público-alvo (um usuário, os usuários de um cliente, ou a equipe
 * gerencial) a partir do Supabase e envia a notificação via web-push.
 * No-op silencioso se VAPID/Supabase não estiverem configurados.
 */
import webpush from "web-push";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { VAPID_PUBLIC_KEY } from "./config";

const PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";

export type PushPayload = {
  title: string;
  body: string;
  url?: string; // rota a abrir no clique
  icon?: string;
};

type SubRow = { endpoint: string; p256dh: string; auth: string };

function ready(): boolean {
  return Boolean(
    VAPID_PUBLIC_KEY && PRIVATE && isSupabaseConfigured() && hasServiceRole(),
  );
}

async function sendToSubs(subs: SubRow[], payload: PushPayload): Promise<number> {
  if (!subs.length) return 0;
  const subject =
    process.env.NEXT_PUBLIC_APP_URL || "mailto:contato@viofilme.com.br";
  webpush.setVapidDetails(subject, VAPID_PUBLIC_KEY, PRIVATE);
  const admin = createAdminClient();

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || "/icon-192x192.png",
    data: { url: payload.url || "/" },
  });

  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        );
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await admin
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", s.endpoint);
        }
      }
    }),
  );
  return sent;
}

async function subsForUserIds(userIds: string[]): Promise<SubRow[]> {
  if (!userIds.length) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", userIds);
  return (data ?? []) as SubRow[];
}

/** Notifica um usuário específico. */
export async function notifyUser(
  userId: string,
  payload: PushPayload,
): Promise<number> {
  if (!ready()) return 0;
  return sendToSubs(await subsForUserIds([userId]), payload);
}

/** Notifica todos os usuários vinculados a um cliente. */
export async function notifyClient(
  clientId: string,
  payload: PushPayload,
): Promise<number> {
  if (!ready()) return 0;
  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("profiles")
    .select("id")
    .eq("client_id", clientId);
  const ids = (profiles ?? []).map((p) => p.id as string);
  return sendToSubs(await subsForUserIds(ids), payload);
}

/** Notifica toda a equipe gerencial. */
export async function notifyManagement(payload: PushPayload): Promise<number> {
  if (!ready()) return 0;
  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "gerencial");
  const ids = (profiles ?? []).map((p) => p.id as string);
  return sendToSubs(await subsForUserIds(ids), payload);
}
