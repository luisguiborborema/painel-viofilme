import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { logFromUser } from "@/lib/audit/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FieldInput = {
  fieldKey?: string;
  label?: string;
  fieldType?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
  mapTo?: string;
  position?: number;
  active?: boolean;
};

type Body = {
  action?: "create" | "update" | "delete" | "save-fields";
  id?: string;
  name?: string;
  slug?: string;
  owner?: string;
  source?: string;
  active?: boolean;
  destination?: "crm" | "entregas";
  pipelineId?: string | null;
  stageId?: string | null;
  clientId?: string | null;
  taskType?: string | null;
  description?: string | null;
  fields?: FieldInput[];
};

const FIELD_TYPES = new Set([
  "text",
  "textarea",
  "number",
  "select",
  "date",
  "checkbox",
  "url",
  "email",
  "phone",
]);
const FIELD_MAPS = new Set([
  "title",
  "contact_name",
  "contact_email",
  "contact_phone",
  "company",
  "custom",
]);

function slugifyKey(s: string, fallback: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || fallback
  );
}

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

/** Respostas (envios) de um formulário — leitura (gerencial). */
export async function GET(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const formId = new URL(req.url).searchParams.get("formId");
  if (!formId || !isSupabaseConfigured()) {
    return NextResponse.json({ submissions: [] });
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("crm_form_submissions")
    .select("id, values, created_lead_id, created_task_id, created_at")
    .eq("form_id", formId)
    .order("created_at", { ascending: false })
    .limit(100);
  const submissions = (data ?? []).map((r) => ({
    id: String(r.id),
    values: (r.values && typeof r.values === "object" ? r.values : {}) as Record<string, unknown>,
    leadId: r.created_lead_id == null ? null : String(r.created_lead_id),
    taskId: r.created_task_id == null ? null : String(r.created_task_id),
    createdAt: String(r.created_at),
  }));
  return NextResponse.json({ submissions });
}

/** CRUD dos formulários de captura (gerencial). */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  if (user.readOnly) {
    return NextResponse.json({ error: "acesso somente leitura" }, { status: 403 });
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
  await logFromUser(user, { action, area: "Formulários", target: b.name ?? b.id ?? null });
  const supabase = await createClient();

  if (action === "delete") {
    if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const { error } = await supabase.from("crm_capture_forms").delete().eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "save-fields") {
    if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const rows = (b.fields ?? [])
      .map((f, i) => {
        const label = (f.label ?? "").trim();
        if (!label) return null;
        const fieldType = FIELD_TYPES.has(String(f.fieldType)) ? String(f.fieldType) : "text";
        const mapTo = FIELD_MAPS.has(String(f.mapTo)) ? String(f.mapTo) : "custom";
        return {
          form_id: b.id,
          field_key: slugifyKey(f.fieldKey || label, `campo_${i + 1}`),
          label,
          field_type: fieldType,
          options: Array.isArray(f.options) ? f.options : [],
          required: Boolean(f.required),
          map_to: mapTo,
          position: typeof f.position === "number" ? f.position : i,
          active: f.active !== false,
        };
      })
      .filter(Boolean) as Record<string, unknown>[];
    // Dedup de field_key (rótulos iguais gerariam a mesma chave → colisão de valor).
    const seenKeys = new Set<string>();
    for (const r of rows) {
      const base = String(r.field_key);
      let key = base;
      let n = 2;
      while (seenKeys.has(key)) key = `${base}_${n++}`;
      seenKeys.add(key);
      r.field_key = key;
    }
    // Substitui todos os campos do formulário (replace-all).
    const { error: delErr } = await supabase.from("crm_form_fields").delete().eq("form_id", b.id);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
    if (rows.length) {
      const { error: insErr } = await supabase.from("crm_form_fields").insert(rows);
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, count: rows.length });
  }

  if (action === "update") {
    if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const patch: Record<string, unknown> = {};
    if (b.name != null) patch.name = b.name;
    if (b.owner !== undefined) patch.owner = b.owner || null;
    if (b.source != null) patch.source = b.source;
    if (b.active != null) patch.active = b.active;
    if (b.destination != null) patch.destination = b.destination === "entregas" ? "entregas" : "crm";
    if (b.pipelineId !== undefined) patch.pipeline_id = b.pipelineId || null;
    if (b.stageId !== undefined) patch.stage_id = b.stageId || null;
    if (b.clientId !== undefined) patch.client_id = b.clientId || null;
    if (b.taskType !== undefined) patch.task_type = b.taskType || null;
    if (b.description !== undefined) patch.description = b.description || null;
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
      destination: b.destination === "entregas" ? "entregas" : "crm",
      pipeline_id: b.pipelineId || null,
      stage_id: b.stageId || null,
      client_id: b.clientId || null,
      task_type: b.taskType || null,
      description: b.description || null,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id, slug });
}
