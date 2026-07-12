import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { sanitizeMuted } from "@/lib/notify-categories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Minhas preferências de notificação (categorias silenciadas). */
export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!isSupabaseConfigured()) return NextResponse.json({ muted: [] });

  const supabase = await createClient();
  const { data } = await supabase
    .from("notification_preferences")
    .select("muted")
    .eq("user_id", user.id)
    .maybeSingle();
  return NextResponse.json({ muted: sanitizeMuted(data?.muted) });
}

/** Salva as categorias silenciadas do usuário. */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  let b: { muted?: unknown };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const muted = sanitizeMuted(b.muted);
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false, muted });

  const supabase = await createClient();
  const { error } = await supabase
    .from("notification_preferences")
    .upsert(
      { user_id: user.id, muted, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: true, muted });
}
