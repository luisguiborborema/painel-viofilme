import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Sub = { endpoint: string; keys?: { p256dh?: string; auth?: string } };

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  let body: { subscription?: Sub };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const sub = body.subscription;
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json({ error: "inscrição inválida" }, { status: 400 });
  }

  // Sem Supabase (modo demo): a inscrição existe no navegador, mas não é
  // persistida — o envio real depende do banco.
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, persisted: false });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      user_agent: request.headers.get("user-agent") ?? null,
    },
    { onConflict: "endpoint" },
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, persisted: true });
}
