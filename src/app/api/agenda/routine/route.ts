import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action?: "add-block" | "update-block" | "delete-block" | "apply-template" | "save-template";
  id?: string;
  templateId?: string;
  name?: string;
  title?: string;
  weekday?: number;
  startTime?: string;
  endTime?: string;
  color?: string;
  activityType?: string;
};

/** CRUD da rotina pessoal (routine_blocks) + aplicar/salvar modelo. */
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
  const owner = user.id;

  if (b.action === "delete-block") {
    if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const { error } = await supabase.from("routine_blocks").delete().eq("id", b.id).eq("owner_id", owner);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (b.action === "update-block") {
    if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const patch: Record<string, unknown> = {};
    if (b.title != null) patch.title = b.title;
    if (b.weekday != null) patch.weekday = b.weekday;
    if (b.startTime != null) patch.start_time = b.startTime;
    if (b.endTime != null) patch.end_time = b.endTime;
    if (b.color != null) patch.color = b.color;
    if (b.activityType != null) patch.activity_type = b.activityType;
    const { error } = await supabase.from("routine_blocks").update(patch).eq("id", b.id).eq("owner_id", owner);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (b.action === "apply-template") {
    if (!b.templateId) return NextResponse.json({ error: "templateId ausente" }, { status: 400 });
    // Substitui a rotina pessoal pelos blocos do modelo escolhido.
    await supabase.from("routine_blocks").delete().eq("owner_id", owner);
    const { data: tb } = await supabase
      .from("routine_blocks")
      .select("title,weekday,start_time,end_time,color,activity_type")
      .eq("template_id", b.templateId);
    if (tb?.length) {
      await supabase.from("routine_blocks").insert(tb.map((x) => ({ ...x, owner_id: owner, template_id: null })));
    }
    return NextResponse.json({ ok: true });
  }

  if (b.action === "save-template") {
    if (!b.name?.trim()) return NextResponse.json({ error: "nome ausente" }, { status: 400 });
    const { data: tpl, error } = await supabase
      .from("routine_templates")
      .insert({ name: b.name.trim(), owner_id: owner, is_base: false })
      .select("id")
      .single();
    if (error || !tpl) return NextResponse.json({ error: error?.message ?? "falha" }, { status: 500 });
    const { data: mine } = await supabase
      .from("routine_blocks")
      .select("title,weekday,start_time,end_time,color,activity_type")
      .eq("owner_id", owner);
    if (mine?.length) {
      await supabase.from("routine_blocks").insert(mine.map((x) => ({ ...x, owner_id: null, template_id: tpl.id })));
    }
    return NextResponse.json({ ok: true, id: tpl.id });
  }

  // add-block (padrão)
  if (!b.title?.trim() || b.weekday == null || !b.startTime || !b.endTime) {
    return NextResponse.json({ error: "título/dia/horários ausentes" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("routine_blocks")
    .insert({
      owner_id: owner,
      title: b.title.trim(),
      weekday: b.weekday,
      start_time: b.startTime,
      end_time: b.endTime,
      color: b.color ?? "#2a63c9",
      activity_type: b.activityType ?? null,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
