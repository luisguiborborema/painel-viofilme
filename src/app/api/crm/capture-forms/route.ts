import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action?: "create" | "update" | "delete";
  id?: string;
  name?: string;
  slug?: string;
  owner?: string;
  source?: string;
  active?: boolean;
};

function slugify(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "form"
  );
}

/** CRUD dos formulários de captura (gerencial). */
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

  const action = b.action ?? (b.id ? "update" : "create");

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, persisted: false });
  }
  const supabase = await createClient();

  if (action === "delete") {
    if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const { error } = await supabase.from("crm_capture_forms").delete().eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "update") {
    if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const patch: Record<string, unknown> = {};
    if (b.name != null) patch.name = b.name;
    if (b.owner !== undefined) patch.owner = b.owner || null;
    if (b.source != null) patch.source = b.source;
    if (b.active != null) patch.active = b.active;
    const { error } = await supabase.from("crm_capture_forms").update(patch).eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // create
  if (!b.name?.trim()) return NextResponse.json({ error: "nome ausente" }, { status: 400 });
  let slug = slugify(b.slug || b.name);
  const { data: existing } = await supabase.from("crm_capture_forms").select("slug");
  const taken = new Set((existing ?? []).map((r) => String(r.slug)));
  let i = 2;
  const base = slug;
  while (taken.has(slug)) slug = `${base}-${i++}`;

  const { data, error } = await supabase
    .from("crm_capture_forms")
    .insert({
      name: b.name.trim(),
      slug,
      owner: b.owner || null,
      source: b.source?.trim() || "Formulário",
      active: true,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id, slug });
}
