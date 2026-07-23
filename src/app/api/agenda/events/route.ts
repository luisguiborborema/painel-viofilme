import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES = new Set(["meeting", "call", "other"]);

type Body = {
  action?: "create" | "delete";
  id?: string;
  title?: string;
  type?: string;
  startAt?: string;
  endAt?: string;
  dealId?: string;
};

/** CRUD dos eventos próprios (fallback/complemento ao Google Calendar). */
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
    const { error } = await supabase.from("calendar_events").delete().eq("id", b.id).eq("owner_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // create
  if (!b.title?.trim() || !b.startAt) {
    return NextResponse.json({ error: "título/início ausentes" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("calendar_events")
    .insert({
      owner_id: user.id,
      title: b.title.trim(),
      type: b.type && TYPES.has(b.type) ? b.type : "meeting",
      start_at: b.startAt,
      end_at: b.endAt ?? null,
      deal_id: b.dealId ?? null,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
