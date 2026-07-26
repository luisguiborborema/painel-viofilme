import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// CORS: por padrão aceita qualquer origem (protegido por slug + honeypot).
// Trave definindo CAPTURE_ALLOWED_ORIGIN (lista separada por vírgula) no Vercel.
const ALLOWED = (process.env.CAPTURE_ALLOWED_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function corsHeaders(req: Request): Record<string, string> {
  const base = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
  if (!ALLOWED.length) return { ...base, "Access-Control-Allow-Origin": "*" };
  const origin = req.headers.get("origin") ?? "";
  const allow = ALLOWED.includes(origin) ? origin : ALLOWED[0];
  return { ...base, "Access-Control-Allow-Origin": allow, Vary: "Origin" };
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

type FieldRow = {
  field_key: string;
  label: string;
  field_type: string;
  required: boolean;
  map_to: string;
  position: number;
};

function str(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

/**
 * Endpoint PÚBLICO de envio de formulários/briefings (/captura/<slug>).
 * Sem sessão: usa service-role, valida o slug e cria um card no destino do
 * formulário — negócio no Comercial (crm) OU tarefa no Painel de Entregas.
 */
export async function POST(req: Request) {
  const cors = corsHeaders(req);
  const json = (data: unknown, init?: { status?: number }) =>
    NextResponse.json(data, { status: init?.status ?? 200, headers: cors });

  // Corpo: JSON { slug, values:{field_key:valor}, website } ou form-urlencoded.
  let slug = "";
  let website = "";
  let values: Record<string, unknown> = {};
  const ct = req.headers.get("content-type") ?? "";
  try {
    if (ct.includes("application/json")) {
      const b = (await req.json()) as { slug?: string; website?: string; values?: Record<string, unknown> };
      slug = str(b.slug);
      website = str(b.website);
      values = b.values && typeof b.values === "object" ? b.values : {};
    } else {
      const form = await req.formData();
      for (const [k, v] of form.entries()) {
        if (k === "slug") slug = str(v);
        else if (k === "website") website = str(v);
        else values[k] = String(v);
      }
    }
  } catch {
    return json({ error: "corpo inválido" }, { status: 400 });
  }

  // Honeypot: bots preenchem o campo oculto → finge sucesso e ignora.
  if (website) return json({ ok: true });
  if (!slug) return json({ error: "formulário não informado" }, { status: 400 });

  if (!isSupabaseConfigured() || !hasServiceRole()) {
    return json({ ok: true, persisted: false });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: form } = await admin
    .from("crm_capture_forms")
    .select("id, owner, source, active, destination, pipeline_id, stage_id, client_id, task_type")
    .eq("slug", slug)
    .maybeSingle();
  if (!form || !form.active) {
    return json({ error: "formulário indisponível" }, { status: 404 });
  }

  const { data: fieldsData } = await admin
    .from("crm_form_fields")
    .select("field_key,label,field_type,required,map_to,position")
    .eq("form_id", form.id)
    .eq("active", true)
    .order("position", { ascending: true });
  const fields = (fieldsData ?? []) as FieldRow[];

  // Formulários sem campos configurados (inclui os de captação antigos): usa o
  // conjunto legado (nome/empresa/e-mail/telefone/mensagem) para não perder o envio.
  const LEGACY_FIELDS: FieldRow[] = [
    { field_key: "contact_name", label: "Nome", field_type: "text", required: true, map_to: "contact_name", position: 0 },
    { field_key: "company", label: "Empresa", field_type: "text", required: false, map_to: "company", position: 1 },
    { field_key: "contact_email", label: "E-mail", field_type: "email", required: false, map_to: "contact_email", position: 2 },
    { field_key: "contact_phone", label: "WhatsApp", field_type: "phone", required: false, map_to: "contact_phone", position: 3 },
    { field_key: "message", label: "Mensagem", field_type: "textarea", required: false, map_to: "custom", position: 4 },
  ];
  const effectiveFields = fields.length ? fields : LEGACY_FIELDS;

  // Mapeia valores por destino do campo + valida obrigatórios.
  const mapped: Record<string, string> = {};
  const custom: Record<string, unknown> = {};
  const briefing: string[] = [];
  for (const f of effectiveFields) {
    const raw = values[f.field_key];
    const v = str(raw);
    if (f.required && !v) {
      return json({ error: `campo obrigatório: ${f.label}` }, { status: 400 });
    }
    if (f.map_to && f.map_to !== "custom") {
      if (v) mapped[f.map_to] = v;
    } else if (v) {
      custom[f.field_key] = raw;
    }
    if (v) briefing.push(`• ${f.label}: ${v}`);
  }

  const owner = (form.owner as string | null) ?? null;
  const source = (form.source as string | null) ?? "Formulário";
  const title =
    mapped.title || mapped.company || mapped.contact_name || effectiveFields.map((f) => str(values[f.field_key])).find(Boolean) || source;
  const contactName = mapped.contact_name || mapped.company || title;
  const email = mapped.contact_email || null;
  const phone = mapped.contact_phone ? mapped.contact_phone.replace(/\D/g, "") : null;
  const briefingText = briefing.length ? briefing.join("\n") : "";

  // ————————————————————————————————— destino: ENTREGAS —————————————————————————————————
  if (String(form.destination) === "entregas") {
    // Tipo personalizável: usa o que o formulário definiu (fallback "Arte").
    const type = str(form.task_type) || "Arte";
    const comments = briefingText
      ? [{ author: "Formulário", text: `📋 Briefing "${source}":\n${briefingText}`, createdAt: now }]
      : [];
    const { data: task, error } = await admin
      .from("delivery_tasks")
      .insert({
        title,
        client_id: (form.client_id as string | null) || null,
        type,
        origin: "Tarefa avulsa",
        assignee: owner,
        assignees: owner ? [owner] : [],
        requester: contactName || null,
        priority: "media",
        stage: "todo",
        custom_fields: custom,
        comments,
        created_by: null,
      })
      .select("id")
      .single();
    if (error) return json({ error: "falha ao criar" }, { status: 500 });

    await admin.from("crm_form_submissions").insert({
      form_id: form.id,
      values,
      created_task_id: task.id,
    });
    return json({ ok: true, persisted: true });
  }

  // ————————————————————————————————— destino: COMERCIAL (crm) —————————————————————————————————
  const companyName = mapped.company || contactName || title;

  // Empresa (reaproveita por nome).
  let companyId: string;
  const { data: existing } = await admin
    .from("crm_companies")
    .select("id")
    .ilike("name", companyName)
    .maybeSingle();
  if (existing) {
    companyId = existing.id as string;
  } else {
    const { data: co, error } = await admin
      .from("crm_companies")
      .insert({ name: companyName, phone, email, owner })
      .select("id")
      .single();
    if (error) return json({ error: "falha ao criar" }, { status: 500 });
    companyId = co.id as string;
  }

  // Contato primário.
  const { data: contact } = await admin
    .from("crm_contacts")
    .insert({ company_id: companyId, name: contactName, phone, email, is_primary: true, owner })
    .select("id")
    .single();
  const contactId = contact?.id as string | undefined;

  // Funil/etapa de destino (do formulário; fallback: default + 1ª aberta).
  let pipelineId = (form.pipeline_id as string | null) || null;
  if (!pipelineId) {
    const { data: pipe } = await admin
      .from("crm_pipelines")
      .select("id")
      .eq("is_default", true)
      .limit(1)
      .maybeSingle();
    pipelineId = pipe?.id ?? null;
  }
  const { data: stages } = await admin
    .from("crm_stages")
    .select("id,key,position,kind")
    .eq("pipeline_id", pipelineId ?? "")
    .order("position", { ascending: true });
  const chosen =
    (form.stage_id && (stages ?? []).find((s) => s.id === form.stage_id)) ||
    (stages ?? []).find((s) => s.kind === "open") ||
    (stages ?? [])[0];

  const { data: deal, error: dErr } = await admin
    .from("crm_leads")
    .insert({
      name: title,
      company_id: companyId,
      primary_contact_id: contactId ?? null,
      pipeline_id: pipelineId,
      stage_id: chosen?.id ?? null,
      stage: chosen?.key ?? "prospeccao",
      source,
      owner,
      properties: custom,
      stage_changed_at: now,
    })
    .select("id")
    .single();
  if (dErr) return json({ error: "falha ao criar" }, { status: 500 });

  if (contactId) {
    await admin
      .from("crm_deal_contacts")
      .insert({ deal_id: deal.id, contact_id: contactId, is_primary: true });
  }
  if (briefingText) {
    await admin.from("crm_interactions").insert({
      lead_id: deal.id,
      channel: "system",
      body: `📋 Briefing via formulário "${source}":\n${briefingText}`,
    });
  }

  await admin.from("crm_form_submissions").insert({
    form_id: form.id,
    values,
    created_lead_id: deal.id,
  });
  return json({ ok: true, persisted: true });
}
