import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import {
  requirementMet,
  type StageAutomation,
  type StageRequirement,
} from "@/lib/data/crm";
import { sendWhatsappText } from "@/lib/whatsapp/send";
import { WHATSAPP_NOTIFY_NUMBERS } from "@/lib/whatsapp/config";

type SB = Awaited<ReturnType<typeof createClient>>;

/**
 * Resolve o dono do negócio. Se `requested` vier vazio ou "__auto__", faz
 * rodízio (round-robin): escolhe o membro gerencial com menos negócios abertos.
 */
async function resolveOwner(
  supabase: SB,
  requested: string | undefined,
  fallback: string,
): Promise<string> {
  if (requested && requested !== "__auto__") return requested;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("role", "gerencial");
  const names = (profiles ?? [])
    .map((p) => (p.full_name ? String(p.full_name) : ""))
    .filter(Boolean);
  if (!names.length) return fallback;

  const { data: openDeals } = await supabase
    .from("crm_leads")
    .select("owner")
    .not("stage", "in", '("ganho","perdido")');
  const count = new Map<string, number>(names.map((n) => [n, 0]));
  for (const d of openDeals ?? []) {
    const o = d.owner ? String(d.owner) : "";
    if (count.has(o)) count.set(o, (count.get(o) ?? 0) + 1);
  }
  // menor carga primeiro (ordem estável pela lista de nomes)
  return names.reduce((best, n) => ((count.get(n) ?? 0) < (count.get(best) ?? 0) ? n : best), names[0]);
}

/** Executa as automações do estágio destino após a mudança (best-effort). */
async function runStageAutomations(
  supabase: SB,
  dealId: string,
  automations: StageAutomation[],
  authorName: string,
) {
  if (!automations?.length) return;
  const now = new Date();

  // Dados do negócio para preencher as ações (contato/nome).
  const { data: deal } = await supabase
    .from("crm_leads")
    .select("name, primary_contact_id, contact_phone, owner")
    .eq("id", dealId)
    .maybeSingle();
  let contactPhone: string | null = (deal?.contact_phone as string | null) ?? null;
  if (deal?.primary_contact_id) {
    const { data: ct } = await supabase
      .from("crm_contacts")
      .select("phone")
      .eq("id", deal.primary_contact_id)
      .maybeSingle();
    if (ct?.phone) contactPhone = String(ct.phone);
  }

  for (const a of automations) {
    try {
      if (a.type === "task") {
        const due = new Date(now.getTime() + (a.dueDays ?? 1) * 86_400_000);
        await supabase.from("crm_tasks").insert({
          lead_id: dealId,
          title: a.title || "Follow-up",
          due_date: due.toISOString(),
          status: "pending",
        });
      } else if (a.type === "whatsapp") {
        if (contactPhone) await sendWhatsappText(contactPhone, a.message);
        await supabase.from("crm_interactions").insert({
          lead_id: dealId,
          channel: "whatsapp",
          direction: "out",
          author: authorName,
          body: a.message,
        });
      } else if (a.type === "notify") {
        for (const num of WHATSAPP_NOTIFY_NUMBERS) {
          await sendWhatsappText(num, `🔔 ${deal?.name ?? "Negócio"}: ${a.message}`);
        }
        await supabase.from("crm_interactions").insert({
          lead_id: dealId,
          channel: "system",
          body: `🔔 ${a.message}`,
        });
      }
    } catch {
      /* best-effort: uma automação que falha não bloqueia as demais */
    }
  }
}

/** Valor de um campo/propriedade a partir da linha crua de crm_leads. */
function rowValue(row: Record<string, unknown>, req: StageRequirement): unknown {
  if (req.source === "property") {
    const props = (row.properties as Record<string, unknown> | null) ?? {};
    return props[req.field];
  }
  return row[req.field];
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action?: "create" | "update" | "move";
  id?: string;
  stage?: string;
  stageId?: string;
  kind?: "open" | "won" | "lost";
  reason?: string;
  name?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  segment?: string;
  monthlyValue?: number;
  mediaBudget?: number;
  plan?: string;
  probability?: number;
  source?: string;
  owner?: string;
  bant?: Record<string, string>;
  // CRM v2 — vínculo de empresa/contato ao criar o negócio
  companyId?: string;
  newCompany?: { name: string; segment?: string; phone?: string; email?: string };
  contactId?: string;
  newContact?: { name: string; phone?: string; email?: string; title?: string };
  pipelineId?: string;
};

/** Cria, atualiza ou move (troca de estágio) um lead do CRM. */
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
  const now = new Date().toISOString();

  if (action === "move") {
    if (!body.id || !body.stage) {
      return NextResponse.json({ error: "id/stage ausente" }, { status: 400 });
    }

    // Regras + automações do estágio destino.
    let stageAutomations: StageAutomation[] = [];
    if (body.stageId) {
      const { data: stage } = await supabase
        .from("crm_stages")
        .select("requirements, automations")
        .eq("id", body.stageId)
        .maybeSingle();
      stageAutomations = (stage?.automations as StageAutomation[] | null) ?? [];
      const reqs = (stage?.requirements as StageRequirement[] | null) ?? [];
      if (reqs.length) {
        const { data: dealRow } = await supabase
          .from("crm_leads")
          .select("properties,monthly_value,plan,source,probability")
          .eq("id", body.id)
          .maybeSingle();
        const row = (dealRow as Record<string, unknown>) ?? {};
        const missing = reqs.filter((r) => !requirementMet(r.op, rowValue(row, r), r.value));
        if (missing.length) {
          return NextResponse.json(
            { error: "requisitos não cumpridos", missing: missing.map((m) => m.label) },
            { status: 422 },
          );
        }
      }
    }

    const patch: Record<string, unknown> = {
      stage: body.stage,
      stage_changed_at: now,
      updated_at: now,
    };
    if (body.stageId) patch.stage_id = body.stageId;
    // won/lost pelo TIPO do estágio (kind), com fallback às keys padrão.
    const kind = body.kind ?? (body.stage === "ganho" ? "won" : body.stage === "perdido" ? "lost" : "open");
    if (kind === "lost") {
      patch.lost_at = now;
      patch.lost_reason = body.reason ?? null;
    } else if (kind === "won") {
      patch.won_at = now;
    }
    const { error } = await supabase.from("crm_leads").update(patch).eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Automações do estágio (best-effort, não bloqueiam a resposta em caso de erro).
    await runStageAutomations(supabase, body.id, stageAutomations, user.name);

    return NextResponse.json({ ok: true, persisted: true });
  }

  const payload: Record<string, unknown> = {
    name: body.name,
    contact_name: body.contactName ?? null,
    contact_phone: body.contactPhone?.replace(/\D/g, "") || null,
    contact_email: body.contactEmail ?? null,
    segment: body.segment ?? null,
    monthly_value: body.monthlyValue ?? 0,
    media_budget: body.mediaBudget ?? 0,
    plan: body.plan ?? null,
    probability: body.probability ?? 0,
    source: body.source ?? null,
    owner: body.owner ?? user.name,
    bant: body.bant ?? {},
    updated_at: now,
  };

  if (action === "create") {
    if (!body.name) {
      return NextResponse.json({ error: "nome ausente" }, { status: 400 });
    }
    // Todo negócio precisa de um contato (existente ou novo).
    const willHaveContact =
      Boolean(body.contactId) ||
      Boolean(body.newContact?.name?.trim()) ||
      Boolean(body.contactName?.trim());
    if (!willHaveContact) {
      return NextResponse.json(
        { error: "Selecione ou crie um contato para o negócio." },
        { status: 400 },
      );
    }
    payload.stage = body.stage ?? "prospeccao";
    payload.stage_changed_at = now;
    payload.owner = await resolveOwner(supabase, body.owner, user.name);

    // 1) Empresa: usa a existente, cria a nova, ou deriva do nome do negócio.
    let companyId = body.companyId ?? null;
    if (!companyId) {
      const nc = body.newCompany;
      const { data: co, error: coErr } = await supabase
        .from("crm_companies")
        .insert({
          name: nc?.name?.trim() || body.name,
          segment: nc?.segment ?? body.segment ?? null,
          phone: (nc?.phone ?? body.contactPhone)?.replace(/\D/g, "") || null,
          email: nc?.email ?? body.contactEmail ?? null,
          owner: body.owner ?? user.name,
        })
        .select("id")
        .single();
      if (coErr) return NextResponse.json({ error: coErr.message }, { status: 500 });
      companyId = co.id as string;
    }

    // 2) Contato: usa o existente ou cria um novo (contato primário da empresa).
    let contactId = body.contactId ?? null;
    if (!contactId) {
      const nctName = body.newContact?.name?.trim() || body.contactName?.trim();
      if (nctName) {
        const { data: ct, error: ctErr } = await supabase
          .from("crm_contacts")
          .insert({
            company_id: companyId,
            name: nctName,
            title: body.newContact?.title ?? null,
            phone: (body.newContact?.phone ?? body.contactPhone)?.replace(/\D/g, "") || null,
            email: body.newContact?.email ?? body.contactEmail ?? null,
            is_primary: true,
            owner: body.owner ?? user.name,
          })
          .select("id")
          .single();
        if (ctErr) return NextResponse.json({ error: ctErr.message }, { status: 500 });
        contactId = ct.id as string;
      }
    }

    payload.company_id = companyId;
    payload.primary_contact_id = contactId;
    if (body.pipelineId) payload.pipeline_id = body.pipelineId;
    if (body.stageId) payload.stage_id = body.stageId;

    const { data, error } = await supabase
      .from("crm_leads")
      .insert(payload)
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // 3) Associação deal ↔ contato primário.
    if (contactId) {
      await supabase
        .from("crm_deal_contacts")
        .insert({ deal_id: data.id, contact_id: contactId, is_primary: true });
    }

    return NextResponse.json({
      ok: true,
      persisted: true,
      id: data.id,
      companyId,
      contactId,
    });
  }

  // update
  if (!body.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
  const { error } = await supabase.from("crm_leads").update(payload).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: true });
}
