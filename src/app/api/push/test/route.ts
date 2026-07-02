import { NextResponse } from "next/server";
import webpush from "web-push";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { VAPID_PUBLIC_KEY } from "@/lib/push/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";

export async function POST() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  if (!VAPID_PUBLIC_KEY || !PRIVATE) {
    return NextResponse.json(
      { error: "VAPID não configurado no servidor" },
      { status: 503 },
    );
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase necessário para guardar/enviar inscrições" },
      { status: 503 },
    );
  }

  const subject = process.env.NEXT_PUBLIC_APP_URL || "mailto:contato@viofilme.com.br";
  webpush.setVapidDetails(subject, VAPID_PUBLIC_KEY, PRIVATE);

  const supabase = await createClient();
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", user.id);

  if (!subs || subs.length === 0) {
    return NextResponse.json({ error: "nenhuma inscrição ativa" }, { status: 404 });
  }

  const payload = JSON.stringify({
    title: "Viofilme",
    body: "🔔 Notificações ativadas com sucesso!",
    icon: "/icon-192x192.png",
    data: { url: "/" },
  });

  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        sent++;
      } catch (e) {
        // Inscrição inválida/expirada (410/404): remove.
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", s.endpoint);
        }
      }
    }),
  );

  return NextResponse.json({ ok: true, sent });
}
