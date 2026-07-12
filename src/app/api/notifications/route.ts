import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Minhas notificações (últimas 30) + contagem de não-lidas. */
export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ notifications: [], unread: 0 });
  }
  const supabase = await createClient();
  const [{ data }, { count }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id,title,body,url,read,created_at")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("read", false),
  ]);
  return NextResponse.json({ notifications: data ?? [], unread: count ?? 0 });
}

/** Marca uma (id) ou todas as notificações como lidas. */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  let b: { action?: "read"; id?: string };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });

  const supabase = await createClient();
  let q = supabase.from("notifications").update({ read: true }).eq("user_id", user.id);
  if (b.id) q = q.eq("id", b.id);
  else q = q.eq("read", false);
  const { error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: true });
}
