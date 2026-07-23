import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { SALES_MATERIAL_KINDS } from "@/lib/data/crm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS = new Set(SALES_MATERIAL_KINDS.map((k) => k.key));

type Body = {
  action?: "create" | "update" | "delete" | "use";
  id?: string;
  title?: string;
  kind?: string;
  fileUrl?: string;
  link?: string;
  tags?: string[];
  isActive?: boolean;
};

/** CRUD dos materiais de venda + contador de uso ("use" = registrou envio). */
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
    const { error } = await supabase.from("crm_sales_materials").delete().eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (b.action === "use") {
    if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const { data: cur } = await supabase.from("crm_sales_materials").select("usage_count").eq("id", b.id).single();
    const next = Number(cur?.usage_count ?? 0) + 1;
    const { error } = await supabase.from("crm_sales_materials").update({ usage_count: next }).eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, usageCount: next });
  }

  if (b.action === "update") {
    if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const patch: Record<string, unknown> = {};
    if (b.title != null) patch.title = b.title.trim();
    if (b.kind != null) patch.kind = KINDS.has(b.kind) ? b.kind : "outro";
    if (b.fileUrl != null) patch.file_url = b.fileUrl || null;
    if (b.link != null) patch.link = b.link || null;
    if (Array.isArray(b.tags)) patch.tags = b.tags;
    if (b.isActive != null) patch.is_active = b.isActive;
    const { error } = await supabase.from("crm_sales_materials").update(patch).eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // create
  if (!b.title?.trim()) return NextResponse.json({ error: "título ausente" }, { status: 400 });
  const { data, error } = await supabase
    .from("crm_sales_materials")
    .insert({
      title: b.title.trim(),
      kind: b.kind && KINDS.has(b.kind) ? b.kind : "outro",
      file_url: b.fileUrl || null,
      link: b.link || null,
      tags: Array.isArray(b.tags) ? b.tags : [],
      is_active: b.isActive ?? true,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
