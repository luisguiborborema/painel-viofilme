import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OBJECT_TYPES = ["company", "contact", "deal", "task"];
const FIELD_TYPES = [
  "text", "textarea", "number", "currency", "select", "multiselect",
  "date", "datetime", "checkbox", "phone", "email", "url",
];

type Option = { value: string; label: string; color?: string };

type Body = {
  action?: "create" | "update" | "delete" | "archive" | "unarchive" | "create-group" | "delete-group";
  id?: string;
  objectType?: string;
  key?: string;
  label?: string;
  fieldType?: string;
  options?: Option[];
  position?: number;
  description?: string;
  required?: boolean;
  groupId?: string | null;
  name?: string; // nome do grupo (create-group)
};

/** Chaves que só existem após a migração 0103 (grupos/description/required/archived). */
const NEW_KEYS = ["group_id", "description", "required", "is_archived"];
function stripNew(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(patch)) if (!NEW_KEYS.includes(k)) out[k] = patch[k];
  return out;
}

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
  if (user?.readOnly) return NextResponse.json({ error: "acesso somente leitura" }, { status: 403 });
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

  // Arquivar (soft) — tolerante: se a coluna is_archived não existir (pré-0103),
  // faz o hard delete como fallback pra propriedade sair da lista mesmo assim.
  if (action === "archive" || action === "unarchive") {
    if (!body.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const res = await supabase.from("crm_properties").update({ is_archived: action === "archive" }).eq("id", body.id);
    if (res.error?.code === "42703") {
      if (action === "archive") await supabase.from("crm_properties").delete().eq("id", body.id);
      return NextResponse.json({ ok: true, persisted: true, fallback: "no-archive-column" });
    }
    if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  // Grupos de propriedades (crm_property_groups) — tolerante se a tabela não existir.
  if (action === "create-group") {
    if (!body.objectType || !OBJECT_TYPES.includes(body.objectType)) {
      return NextResponse.json({ error: "objectType inválido" }, { status: 400 });
    }
    if (!body.name?.trim()) return NextResponse.json({ error: "nome ausente" }, { status: 400 });
    const res = await supabase
      .from("crm_property_groups")
      .insert({ object_type: body.objectType, name: body.name.trim(), position: body.position ?? 99 })
      .select("id")
      .single();
    if (res.error) {
      const missing = res.error.code === "42P01";
      return NextResponse.json(
        { error: missing ? "Rode a migração 0103 para usar grupos." : res.error.message },
        { status: missing ? 400 : 500 },
      );
    }
    return NextResponse.json({ ok: true, persisted: true, id: res.data.id });
  }
  if (action === "delete-group") {
    if (!body.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const { error } = await supabase.from("crm_property_groups").delete().eq("id", body.id);
    if (error && error.code !== "42P01") return NextResponse.json({ error: error.message }, { status: 500 });
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
    if (body.groupId !== undefined) patch.group_id = body.groupId;
    if (body.description !== undefined) patch.description = body.description;
    if (body.required !== undefined) patch.required = body.required;
    let res = await supabase.from("crm_properties").update(patch).eq("id", body.id);
    if (res.error?.code === "42703") res = await supabase.from("crm_properties").update(stripNew(patch)).eq("id", body.id);
    if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });
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
  const row: Record<string, unknown> = {
    object_type: body.objectType,
    key,
    label: body.label,
    field_type: fieldType,
    options: body.options ?? [],
    position: body.position ?? 99,
    is_default: false,
    group_id: body.groupId ?? null,
    description: body.description ?? null,
    required: body.required ?? false,
  };
  let res = await supabase.from("crm_properties").insert(row).select("id").single();
  if (res.error?.code === "42703") res = await supabase.from("crm_properties").insert(stripNew(row)).select("id").single();
  if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: true, id: res.data.id, key });
}
