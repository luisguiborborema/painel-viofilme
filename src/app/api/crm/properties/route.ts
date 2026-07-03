import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OBJECT_TYPES = ["company", "contact", "deal"];
const FIELD_TYPES = [
  "text", "number", "currency", "select", "multiselect",
  "date", "checkbox", "phone", "email", "url",
];

type Option = { value: string; label: string; color?: string };

type Body = {
  action?: "create" | "update" | "delete";
  id?: string;
  objectType?: string;
  key?: string;
  label?: string;
  fieldType?: string;
  options?: Option[];
  position?: number;
};

/** Gera uma key estável a partir do rótulo (slug). */
function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "campo";
}

/** CRUD das DEFINIÇÕES de propriedades customizadas (crm_properties). */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const action = body.action ?? (body.id ? "update" : "create");

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, persisted: false });
  }
  const supabase = await createClient();

  if (action === "delete") {
    if (!body.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const { error } = await supabase.from("crm_properties").delete().eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  const fieldType = body.fieldType ?? "text";
  if (!FIELD_TYPES.includes(fieldType)) {
    return NextResponse.json({ error: "tipo de campo inválido" }, { status: 400 });
  }

  if (action === "update") {
    if (!body.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const patch: Record<string, unknown> = {};
    if (body.label != null) patch.label = body.label;
    if (body.fieldType != null) patch.field_type = fieldType;
    if (body.options != null) patch.options = body.options;
    if (body.position != null) patch.position = body.position;
    const { error } = await supabase.from("crm_properties").update(patch).eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  // create
  if (!body.objectType || !OBJECT_TYPES.includes(body.objectType)) {
    return NextResponse.json({ error: "objectType inválido" }, { status: 400 });
  }
  if (!body.label) {
    return NextResponse.json({ error: "rótulo ausente" }, { status: 400 });
  }
  const key = body.key ? slug(body.key) : slug(body.label);
  const { data, error } = await supabase
    .from("crm_properties")
    .insert({
      object_type: body.objectType,
      key,
      label: body.label,
      field_type: fieldType,
      options: body.options ?? [],
      position: body.position ?? 99,
      is_default: false,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: true, id: data.id, key });
}
