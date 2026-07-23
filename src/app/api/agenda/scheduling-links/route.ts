import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { action?: "create" | "update" | "delete"; id?: string; url?: string; label?: string; active?: boolean };

/** CRUD dos links de agendamento (Calendly-like) do usuário. */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  let b: Body;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });
  const supabase = await createClient();

  if (b.action === "delete") {
    if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const { error } = await supabase.from("scheduling_links").delete().eq("id", b.id).eq("owner_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (b.action === "update") {
    if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const patch: Record<string, unknown> = {};
    if (b.url != null) patch.url = b.url.trim();
    if (b.label != null) patch.label = b.label.trim();
    if (b.active != null) patch.active = b.active;
    const { error } = await supabase.from("scheduling_links").update(patch).eq("id", b.id).eq("owner_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // create
  if (!b.url?.trim()) return NextResponse.json({ error: "url ausente" }, { status: 400 });
  const { data, error } = await supabase
    .from("scheduling_links")
    .insert({ owner_id: user.id, url: b.url.trim(), label: b.label?.trim() || "Agendar comigo", active: true })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
