import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { trigger } from "@/lib/push/triggers";
import { registerFormProperties } from "@/lib/data/form-properties";

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
  show_if_key?: string | null;
  show_if_value?: string | null;
  options?: unknown;
};

function str(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

/** Normaliza texto livre de prioridade → enum do Painel de Entregas. */
function normalizePriority(v: string): "baixa" | "media" | "alta" | "urgente" | null {
  const s = v.toLowerCase();
  if (!s) return null;
  if (/(urgent|crít|crit|asap)/.test(s)) return "urgente";
  if (/(alta|high|prior)/.test(s)) return "alta";
  if (/(baixa|low)/.test(s)) return "baixa";
  if (/(m[eé]dia|normal|medium|padr)/.test(s)) return "media";
  return null;
}

/** Soma dias úteis a uma data ISO e devolve "AAAA-MM-DD". */
function addBusinessDays(fromIso: string, days: number): string {
  const d = new Date(fromIso);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
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
  let clientParam = "";
  let values: Record<string, unknown> = {};
  const ct = req.headers.get("content-type") ?? "";
  try {
    if (ct.includes("application/json")) {
      const b = (await req.json()) as {
        slug?: string;
        website?: string;
        client?: string;
        values?: Record<string, unknown>;
      };
      slug = str(b.slug);
      website = str(b.website);
      clientParam = str(b.client);
      values = b.values && typeof b.values === "object" ? b.values : {};
    } else {
      const form = await req.formData();
      for (const [k, v] of form.entries()) {
        if (k === "slug") slug = str(v);
        else if (k === "website") website = str(v);
        else if (k === "client") clientParam = str(v);
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
    .select("id, name, owner, source, active, destination, pipeline_id, stage_id, client_id, task_type")
    .eq("slug", slug)
    .maybeSingle();
  if (!form || !form.active) {
    return json({ error: "formulário indisponível" }, { status: 404 });
  }

  const { data: fieldsData } = await admin
    .from("crm_form_fields")
    .select("field_key,label,field_type,required,map_to,position,show_if_key,show_if_value,options")
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

  // Garante que as perguntas "custom" existam como propriedades do card
  // (negócio/tarefa) — cobre formulários criados antes desta regra.
  await registerFormProperties(
    admin,
    String(form.destination) === "entregas" ? "entregas" : "crm",
    effectiveFields,
  ).catch(() => {});

  // Mapeia valores por destino do campo + valida obrigatórios.
  const mapped: Record<string, string> = {};
  const custom: Record<string, unknown> = {};
  const briefing: string[] = [];
  for (const f of effectiveFields) {
    // Seção: divisória, não coleta valor.
    if (f.field_type === "section") continue;
    // Condicional: campo oculto (condição não satisfeita) não é obrigatório nem coletado.
    const vis = !f.show_if_key || str(values[f.show_if_key]) === str(f.show_if_value);
    if (!vis) continue;

    const raw = values[f.field_key];
    const v = str(raw);
    if (f.required && !v) {
      return json({ error: `campo obrigatório: ${f.label}` }, { status: 400 });
    }
    const isControl = f.map_to === "priority" || f.map_to === "client" || f.map_to === "due";
    if (f.map_to && f.map_to !== "custom") {
      if (v) mapped[f.map_to] = v;
    }
    // Toda resposta (menos os controles de tarefa) também vira propriedade do card.
    if (v && !isControl) custom[f.field_key] = raw;
    if (v) briefing.push(`• ${f.label}: ${v}`);
  }

  const owner = (form.owner as string | null) ?? null;
  const source = (form.source as string | null) ?? "Formulário";

  // Formulário vinculado a um cliente via URL (?client=<id>): o card criado
  // recebe o nome "<nome do form> · <cliente>" e fica preso àquele cliente.
  let linkedClientId: string | null = null;
  let linkedClientName = "";
  if (clientParam) {
    const { data: cli } = await admin
      .from("clients")
      .select("id, name")
      .eq("id", clientParam)
      .maybeSingle();
    if (cli) {
      linkedClientId = String(cli.id);
      linkedClientName = String(cli.name ?? "");
    }
  }

  const formName = String(form.name ?? source);
  const baseTitle =
    mapped.title || mapped.company || mapped.contact_name || effectiveFields.map((f) => str(values[f.field_key])).find(Boolean) || source;
  const title = linkedClientName ? `${formName} · ${linkedClientName}` : baseTitle;
  const contactName = mapped.contact_name || mapped.company || baseTitle;
  const email = mapped.contact_email || null;
  const phone = mapped.contact_phone ? mapped.contact_phone.replace(/\D/g, "") : null;
  const briefingText = briefing.length ? briefing.join("\n") : "";

  // ————————————————————————————————— destino: ENTREGAS —————————————————————————————————
  if (String(form.destination) === "entregas") {
    // Tipo personalizável: usa o que o formulário definiu (fallback "Arte").
    const type = str(form.task_type) || "Arte";

    // Padrões do tipo (responsável padrão + SLA) — herdados quando o form não define.
    const { data: typeRow } = await admin
      .from("task_types")
      .select("default_assignee, sla_days")
      .eq("name", type)
      .maybeSingle();
    const slaDays = Number((typeRow as { sla_days?: number | null } | null)?.sla_days) || 0;
    const typeAssignee = str((typeRow as { default_assignee?: string | null } | null)?.default_assignee);

    // Responsável: dono do formulário → responsável padrão do tipo.
    const assignee = owner || typeAssignee || null;

    // Prioridade: campo mapeado como "priority" → média.
    const priority = normalizePriority(mapped.priority ?? "") ?? "media";

    // Cliente: da URL (?client) → do formulário → resolvido pelo nome (campo "client").
    let clientId = linkedClientId ?? (form.client_id as string | null) ?? null;
    if (!clientId && mapped.client) {
      const { data: cli } = await admin
        .from("clients")
        .select("id")
        .ilike("name", mapped.client)
        .maybeSingle();
      if (cli) clientId = cli.id as string;
    }

    // Prazo: campo "due" (data) → SLA do tipo (dias úteis) → sem prazo.
    const dueRaw = mapped.due ?? "";
    const dueFromField = /^\d{4}-\d{2}-\d{2}/.test(dueRaw) ? dueRaw.slice(0, 10) : "";
    const dueDate = dueFromField || (slaDays > 0 ? addBusinessDays(now, slaDays) : null);

    const comments = briefingText
      ? [{ author: "Formulário", text: `📋 Briefing "${source}":\n${briefingText}`, createdAt: now }]
      : [];
    const { data: task, error } = await admin
      .from("delivery_tasks")
      .insert({
        title,
        client_id: clientId,
        type,
        origin: "Tarefa avulsa",
        assignee,
        assignees: assignee ? [assignee] : [],
        requester: contactName || null,
        priority,
        stage: "todo",
        due_date: dueDate,
        delivery_date: dueDate,
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
    await trigger
      .formSubmission({ formName: String(form.name ?? source), title, destination: "entregas" })
      .catch(() => {});
    return json({ ok: true, persisted: true });
  }

  // ————————————————————————————————— destino: COMERCIAL (crm) —————————————————————————————————
  // Vinculado a um cliente → agrupa o negócio sob a empresa daquele cliente.
  const companyName = linkedClientName || mapped.company || contactName || baseTitle;

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

  // Contato: reaproveita por e-mail/telefone (dedup) antes de criar um novo.
  let contactId: string | undefined;
  if (email) {
    const { data } = await admin.from("crm_contacts").select("id").eq("email", email).limit(1).maybeSingle();
    if (data) contactId = data.id as string;
  }
  if (!contactId && phone) {
    const { data } = await admin.from("crm_contacts").select("id").eq("phone", phone).limit(1).maybeSingle();
    if (data) contactId = data.id as string;
  }
  if (!contactId) {
    const { data: contact } = await admin
      .from("crm_contacts")
      .insert({ company_id: companyId, name: contactName, phone, email, is_primary: true, owner })
      .select("id")
      .single();
    contactId = contact?.id as string | undefined;
  }

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
  await trigger
    .formSubmission({ formName: String(form.name ?? source), title, destination: "crm" })
    .catch(() => {});
  return json({ ok: true, persisted: true });
}
