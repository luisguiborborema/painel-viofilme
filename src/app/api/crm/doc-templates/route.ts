import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { DOC_TEMPLATE_KINDS, extractTemplateVars } from "@/lib/data/crm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS = new Set(DOC_TEMPLATE_KINDS.map((k) => k.key));

type Body = {
  action?: "create" | "update" | "delete";
  id?: string;
  name?: string;
  kind?: string;
  description?: string;
  content?: string;
  isActive?: boolean;
};

/** CRUD dos modelos de documento (biblioteca que alimenta a geração). */
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
    const { error } = await supabase.from("crm_document_templates").delete().eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (b.action === "update") {
    if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const patch: Record<string, unknown> = {};
    if (b.name != null) patch.name = b.name.trim();
    if (b.kind != null) patch.kind = KINDS.has(b.kind) ? b.kind : "outro";
    if (b.description != null) patch.description = b.description;
    if (b.content != null) {
      patch.content = b.content;
      patch.variables = extractTemplateVars(b.content);
    }
    if (b.isActive != null) patch.is_active = b.isActive;
    const { error } = await supabase.from("crm_document_templates").update(patch).eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // create
  if (!b.name?.trim()) return NextResponse.json({ error: "nome ausente" }, { status: 400 });
  const { data, error } = await supabase
    .from("crm_document_templates")
    .insert({
      name: b.name.trim(),
      kind: b.kind && KINDS.has(b.kind) ? b.kind : "outro",
      description: b.description ?? null,
      content: b.content ?? null,
      variables: extractTemplateVars(b.content),
      is_active: b.isActive ?? true,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
