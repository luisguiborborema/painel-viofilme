import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { tierHasFullAccess } from "@/lib/access";
import { logEvent, logFromUser } from "@/lib/audit/log";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import {
  requirementMet,
  PIPELINE_VENDAS_ID,
  STAGE_CADENCE_ON,
  STAGE_CADENCE_OFF,
  type StageAutomation,
  type StageRequirement,
} from "@/lib/data/crm";
import { sendWhatsappText } from "@/lib/whatsapp/send";
import { WHATSAPP_NOTIFY_NUMBERS } from "@/lib/whatsapp/config";
import { resolveAssignee } from "@/lib/crm/assign";
import { enrollWorkflows } from "@/lib/crm/workflow-engine";

type SB = Awaited<ReturnType<typeof createClient>>;

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
      } else if (a.type === "flow") {
        const { data: steps } = await supabase
          .from("crm_task_flow_steps")
          .select("title,due_days")
          .eq("flow_id", a.flowId)
          .order("position", { ascending: true });
        if (steps?.length) {
          const base = now.getTime();
          await supabase.from("crm_tasks").insert(
            steps.map((s) => ({
              lead_id: dealId,
              title: String(s.title),
              due_date: new Date(base + Number(s.due_days ?? 1) * 86_400_000).toISOString(),
              status: "pending",
            })),
          );
        }
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
  action?:
    | "create"
    | "update"
    | "move"
    | "delete"
    | "change-pipeline"
    | "set-assignees"
    | "set-priority"
    | "no-show"
    | "freeze"
    | "unfreeze"
    | "handoff";
  id?: string;
  assignees?: string[];
  stage?: string;
  stageId?: string;
  kind?: "open" | "won" | "lost";
  reason?: string;
  // Passagem de bastão (Reunião Realizada → Vendas)
  result?: "aceito" | "recusado";
  parecer?: string;
  // Adição rápida (Kommo) no reservatório: permite card cru sem contato
  allowNoContact?: boolean;
  originKind?: "inbound" | "outbound";
  name?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  segment?: string;
  monthlyValue?: number;
  mediaBudget?: number;
  plan?: string;
  probability?: number;
  priority?: string;
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
  if (user.readOnly) {
    return NextResponse.json({ error: "acesso somente leitura" }, { status: 403 });
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

  if (action === "delete") {
    if (!tierHasFullAccess(user.tier)) return NextResponse.json({ error: "Apenas Gestor ou Admin podem apagar negócios." }, { status: 403 });
    if (!body.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    // Cascata (interações, tarefas, deal_contacts, histórico) já cai por FK.
    const { error } = await supabase.from("crm_leads").delete().eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logFromUser(user, { action: "delete", area: "Comercial", target: body.id });
    return NextResponse.json({ ok: true, persisted: true });
  }

  if (action === "set-assignees") {
    if (!body.id || !Array.isArray(body.assignees)) {
      return NextResponse.json({ error: "id/assignees ausente" }, { status: 400 });
    }
    // Nomes únicos e não-vazios; owner = primeiro (RLS/rodízio).
    const assignees = [...new Set(body.assignees.map((n) => n.trim()).filter(Boolean))];
    const { error } = await supabase
      .from("crm_leads")
      .update({ assignees, owner: assignees[0] ?? null, updated_at: now })
      .eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true, assignees, owner: assignees[0] ?? null });
  }

  if (action === "set-priority") {
    if (!body.id || !["baixa", "media", "alta", "urgente"].includes(String(body.priority ?? ""))) {
      return NextResponse.json({ error: "id/prioridade inválida" }, { status: 400 });
    }
    const { error } = await supabase
      .from("crm_leads")
      .update({ priority: body.priority, updated_at: now })
      .eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  // No-show é ESTADO, não etapa: incrementa o contador do card (persiste ao
  // voltar de estágio). Sem coluna de reagendamento.
  if (action === "no-show") {
    if (!body.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const { data: d } = await supabase
      .from("crm_leads")
      .select("no_show_count")
      .eq("id", body.id)
      .maybeSingle();
    const next = Number(d?.no_show_count ?? 0) + 1;
    const { error } = await supabase
      .from("crm_leads")
      .update({ no_show_count: next, updated_at: now })
      .eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supabase.from("crm_interactions").insert({
      lead_id: body.id, channel: "system", body: `🚫 No-show registrado (#${next})`, author: user.name,
    });
    return NextResponse.json({ ok: true, persisted: true, noShowCount: next });
  }

  // Congelar = saída à parte de Perdido: reengajar em trimestres futuros, não some.
  if (action === "freeze") {
    if (!body.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const { error } = await supabase
      .from("crm_leads")
      .update({ frozen_at: now, frozen_reason: body.reason ?? null, cadence_active: false, updated_at: now })
      .eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supabase.from("crm_interactions").insert({
      lead_id: body.id, channel: "system", author: user.name,
      body: `❄️ Negócio congelado${body.reason ? ` — ${body.reason}` : ""}`,
    });
    await logFromUser(user, { action: "freeze", area: "Comercial", target: body.id, detail: body.reason ?? null });
    return NextResponse.json({ ok: true, persisted: true });
  }

  if (action === "unfreeze") {
    if (!body.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const { error } = await supabase
      .from("crm_leads")
      .update({ frozen_at: null, frozen_reason: null, updated_at: now })
      .eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supabase.from("crm_interactions").insert({
      lead_id: body.id, channel: "system", body: "♻️ Negócio reativado", author: user.name,
    });
    await logFromUser(user, { action: "unfreeze", area: "Comercial", target: body.id });
    return NextResponse.json({ ok: true, persisted: true });
  }

  // Passagem de bastão com parecer (aceite híbrido). Ao dar Ganho na "Reunião
  // Realizada" (Pré-venda), registra o parecer:
  //   • Aceito  → move o MESMO negócio p/ a 1ª etapa do Vendas (preserva timeline).
  //   • Recusado → vira Perdido com o feedback anexado (insumo de qualificação do SDR).
  if (action === "handoff") {
    if (!body.id || (body.result !== "aceito" && body.result !== "recusado")) {
      return NextResponse.json({ error: "id/result inválido" }, { status: 400 });
    }
    const parecer = (body.parecer ?? "").trim();
    const { data: deal } = await supabase
      .from("crm_leads")
      .select("stage, pipeline_id")
      .eq("id", body.id)
      .maybeSingle();

    if (body.result === "aceito") {
      const { data: stages } = await supabase
        .from("crm_stages")
        .select("id,key,position,kind")
        .eq("pipeline_id", PIPELINE_VENDAS_ID)
        .order("position", { ascending: true });
      const first = (stages ?? []).find((s) => s.kind === "open") ?? (stages ?? [])[0];
      const { error } = await supabase
        .from("crm_leads")
        .update({
          pipeline_id: PIPELINE_VENDAS_ID,
          stage_id: first?.id ?? null,
          stage: first?.key ?? "vnd_analise",
          stage_changed_at: now,
          cadence_active: false,
          handoff_at: now,
          handoff_result: "aceito",
          handoff_parecer: parecer || null,
          updated_at: now,
        })
        .eq("id", body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await supabase.from("crm_stage_history").insert({
        deal_id: body.id, from_stage: deal?.stage ?? null, to_stage: first?.key ?? "vnd_analise", changed_by: user.name,
      });
      await supabase.from("crm_interactions").insert({
        lead_id: body.id, channel: "system", author: user.name,
        body: `🤝 Bastão passado — aceito na qualificação${parecer ? `: ${parecer}` : ""}`,
      });
      await logFromUser(user, { action: "handoff", area: "Comercial", target: body.id, detail: "aceito" });
      return NextResponse.json({ ok: true, persisted: true, pipelineId: PIPELINE_VENDAS_ID, stage: first?.key ?? "vnd_analise" });
    }

    // recusado → Perdido no funil atual, com feedback do closer anexado.
    const { data: lostStage } = await supabase
      .from("crm_stages")
      .select("id")
      .eq("pipeline_id", deal?.pipeline_id ?? "")
      .eq("key", "perdido")
      .maybeSingle();
    const { error } = await supabase
      .from("crm_leads")
      .update({
        stage: "perdido",
        stage_id: lostStage?.id ?? null,
        stage_changed_at: now,
        lost_at: now,
        lost_reason: parecer || "Recusado na passagem de bastão",
        cadence_active: false,
        handoff_at: now,
        handoff_result: "recusado",
        handoff_parecer: parecer || null,
        updated_at: now,
      })
      .eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supabase.from("crm_stage_history").insert({
      deal_id: body.id, from_stage: deal?.stage ?? null, to_stage: "perdido", changed_by: user.name,
    });
    await supabase.from("crm_interactions").insert({
      lead_id: body.id, channel: "system", author: user.name,
      body: `🚫 Bastão recusado — feedback: ${parecer || "—"}`,
    });
    await logFromUser(user, { action: "handoff", area: "Comercial", target: body.id, detail: "recusado" });
    return NextResponse.json({ ok: true, persisted: true, stage: "perdido" });
  }

  if (action === "change-pipeline") {
    if (!body.id || !body.pipelineId) {
      return NextResponse.json({ error: "id/pipelineId ausente" }, { status: 400 });
    }
    // Move para o 1º estágio ABERTO do pipeline destino.
    const { data: stages } = await supabase
      .from("crm_stages")
      .select("id,key,position,kind")
      .eq("pipeline_id", body.pipelineId)
      .order("position", { ascending: true });
    const firstOpen = (stages ?? []).find((s) => s.kind === "open") ?? (stages ?? [])[0];
    const { error } = await supabase
      .from("crm_leads")
      .update({
        pipeline_id: body.pipelineId,
        stage_id: firstOpen?.id ?? null,
        stage: firstOpen?.key ?? "prospeccao",
        stage_changed_at: now,
        updated_at: now,
      })
      .eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (firstOpen) {
      await supabase.from("crm_stage_history").insert({
        deal_id: body.id, from_stage: null, to_stage: firstOpen.key, changed_by: user.name,
      });
    }
    return NextResponse.json({ ok: true, persisted: true });
  }

  if (action === "move") {
    if (!body.id || !body.stage) {
      return NextResponse.json({ error: "id/stage ausente" }, { status: 400 });
    }

    // Estágio atual (para o histórico do funil).
    const { data: curDeal } = await supabase
      .from("crm_leads")
      .select("stage")
      .eq("id", body.id)
      .maybeSingle();
    const fromStage = curDeal?.stage ? String(curDeal.stage) : null;

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
    // Cadência amarrada à etapa: liga em "Tentativa de Contato" (passo 1),
    // desliga em "Contactado" (passa a follow-up manual).
    if (body.stage === STAGE_CADENCE_ON) {
      patch.cadence_active = true;
      patch.cadence_step = 1;
    } else if (body.stage === STAGE_CADENCE_OFF) {
      patch.cadence_active = false;
    }
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

    // Histórico do funil (best-effort) — só quando o estágio realmente mudou.
    if (fromStage !== body.stage) {
      await supabase.from("crm_stage_history").insert({
        deal_id: body.id,
        from_stage: fromStage,
        to_stage: body.stage,
        changed_by: user.name,
      });
    }

    // Automações do estágio (best-effort, não bloqueiam a resposta em caso de erro).
    await runStageAutomations(supabase, body.id, stageAutomations, user.name);
    // Workflows: inscreve o negócio nos fluxos que disparam ao entrar nesta etapa.
    await enrollWorkflows({ objectId: body.id, trigger: "stage_enter", stageKey: body.stage }).catch(() => {});

    await logEvent({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      panel: "gerencial",
      action: "move",
      area: "Comercial",
      target: body.id,
      detail: `${fromStage ?? "?"} → ${body.stage}`,
    });
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
    priority: ["baixa", "media", "alta", "urgente"].includes(String(body.priority ?? "")) ? body.priority : "media",
    source: body.source ?? null,
    owner: body.owner ?? user.name,
    bant: body.bant ?? {},
    updated_at: now,
  };

  if (action === "create") {
    if (!body.name) {
      return NextResponse.json({ error: "nome ausente" }, { status: 400 });
    }
    // Todo negócio precisa de um contato (existente ou novo) — EXCETO os cards
    // crus do reservatório outbound (adição rápida Kommo / importação em massa),
    // que nascem sem contato e são enriquecidos depois.
    const willHaveContact =
      Boolean(body.contactId) ||
      Boolean(body.newContact?.name?.trim()) ||
      Boolean(body.contactName?.trim());
    if (!willHaveContact && !body.allowNoContact) {
      return NextResponse.json(
        { error: "Selecione ou crie um contato para o negócio." },
        { status: 400 },
      );
    }
    payload.stage = body.stage ?? "prospeccao";
    payload.stage_changed_at = now;
    // Origem define a cadência mais à frente; outbound é o padrão do SDR.
    payload.origin_kind = body.originKind === "inbound" ? "inbound" : "outbound";
    payload.owner = await resolveAssignee(supabase, {
      requested: body.owner,
      fallback: user.name,
      originKind: payload.origin_kind as string,
    });
    payload.assignees = payload.owner ? [payload.owner] : [];

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

    // Workflows: inscreve o novo negócio nos fluxos com gatilho "negócio criado".
    await enrollWorkflows({ objectId: data.id, trigger: "created" }).catch(() => {});

    await logEvent({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      panel: "gerencial",
      action: "create",
      area: "Comercial",
      target: body.name,
    });
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
