import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { sendWhatsappText } from "@/lib/whatsapp/send";
import { WHATSAPP_NOTIFY_NUMBERS } from "@/lib/whatsapp/config";
import type { WorkflowActionType } from "@/lib/data/crm";

type Admin = ReturnType<typeof createAdminClient>;
type ActionResult = { status: "ok" | "skipped" | "error"; detail?: string; delayMs?: number };

/**
 * Inscreve um negócio nos workflows ATIVOS cujo gatilho casa. Best-effort e
 * tolerante: sem service-role ou sem as tabelas (pré-0104), simplesmente não faz nada.
 */
export async function enrollWorkflows(opts: {
  objectId: string;
  trigger: "stage_enter" | "created";
  stageKey?: string;
}) {
  if (!hasServiceRole()) return;
  const admin = createAdminClient();
  const { data: wfs, error } = await admin
    .from("crm_workflows")
    .select("id,trigger_config")
    .eq("is_active", true)
    .eq("trigger_type", opts.trigger);
  if (error || !wfs?.length) return;
  const matched = wfs.filter((w) => {
    if (opts.trigger === "created") return true;
    const cfg = (w.trigger_config as { stageKey?: string } | null) ?? {};
    return Boolean(cfg.stageKey) && cfg.stageKey === opts.stageKey;
  });
  if (!matched.length) return;

  // Anti-duplicação: não reinscreve num workflow que já tem inscrição ATIVA
  // para este negócio (evita filas duplicadas ao re-entrar na etapa).
  const { data: existing } = await admin
    .from("crm_workflow_enrollments")
    .select("workflow_id")
    .eq("object_id", opts.objectId)
    .eq("status", "active")
    .in("workflow_id", matched.map((w) => w.id));
  const activeSet = new Set((existing ?? []).map((e) => String(e.workflow_id)));
  const toEnroll = matched.filter((w) => !activeSet.has(String(w.id)));
  if (!toEnroll.length) return;

  const nowIso = new Date().toISOString();
  await admin.from("crm_workflow_enrollments").insert(
    toEnroll.map((w) => ({
      workflow_id: w.id,
      object_id: opts.objectId,
      status: "active",
      current_step: 0,
      next_run_at: nowIso,
    })),
  );
}

/** Executa UMA ação do workflow sobre um negócio. */
async function runWorkflowAction(
  admin: Admin,
  dealId: string,
  type: WorkflowActionType,
  config: Record<string, unknown>,
): Promise<ActionResult> {
  const { data: deal } = await admin
    .from("crm_leads")
    .select("name,primary_contact_id,contact_phone,owner,properties")
    .eq("id", dealId)
    .maybeSingle();
  if (!deal) return { status: "skipped", detail: "negócio não encontrado" };

  let contactPhone: string | null = (deal.contact_phone as string | null) ?? null;
  if (deal.primary_contact_id) {
    const { data: ct } = await admin.from("crm_contacts").select("phone").eq("id", deal.primary_contact_id).maybeSingle();
    if (ct?.phone) contactPhone = String(ct.phone);
  }

  switch (type) {
    case "delay": {
      const days = Number(config.days ?? 0);
      const hours = Number(config.hours ?? 0);
      return { status: "ok", detail: `espera ${days}d ${hours}h`, delayMs: days * 86_400_000 + hours * 3_600_000 };
    }
    case "task": {
      const dueDays = Number(config.dueDays ?? 0);
      await admin.from("crm_tasks").insert({
        lead_id: dealId,
        title: String(config.title || "Tarefa (workflow)"),
        due_date: new Date(Date.now() + dueDays * 86_400_000).toISOString(),
        status: "pending",
      });
      return { status: "ok" };
    }
    case "whatsapp": {
      const msg = String(config.message || "");
      if (contactPhone && msg) await sendWhatsappText(contactPhone, msg);
      await admin.from("crm_interactions").insert({ lead_id: dealId, channel: "whatsapp", direction: "out", body: msg });
      return contactPhone ? { status: "ok" } : { status: "skipped", detail: "contato sem telefone" };
    }
    case "notify": {
      const msg = String(config.message || "");
      for (const num of WHATSAPP_NOTIFY_NUMBERS) await sendWhatsappText(num, `🔔 ${deal.name}: ${msg}`);
      await admin.from("crm_interactions").insert({ lead_id: dealId, channel: "system", body: `🔔 ${msg}` });
      return { status: "ok" };
    }
    case "set_property": {
      const key = String(config.key || "");
      if (!key) return { status: "skipped", detail: "sem propriedade" };
      const props = (deal.properties as Record<string, unknown> | null) ?? {};
      await admin.from("crm_leads").update({ properties: { ...props, [key]: config.value } }).eq("id", dealId);
      return { status: "ok" };
    }
    case "set_stage": {
      const stageKey = String(config.stageKey || "");
      if (!stageKey) return { status: "skipped", detail: "sem etapa" };
      // Update cru da etapa — NÃO reengata gatilhos stage_enter (evita loop).
      await admin
        .from("crm_leads")
        .update({ stage: stageKey, stage_changed_at: new Date().toISOString() })
        .eq("id", dealId);
      await admin.from("crm_interactions").insert({ lead_id: dealId, channel: "system", body: `↦ Movido para etapa (workflow).` });
      return { status: "ok" };
    }
    case "assign_owner": {
      const owner = String(config.owner || "").trim();
      if (!owner) return { status: "skipped", detail: "sem responsável" };
      await admin.from("crm_leads").update({ owner, assignees: [owner] }).eq("id", dealId);
      return { status: "ok" };
    }
    default:
      return { status: "skipped" };
  }
}

/**
 * Processa as inscrições vencidas: para cada uma, executa as ações consecutivas
 * até esbarrar num delay (que reagenda) ou no fim (marca concluída). Best-effort.
 */
export async function processDueWorkflows(admin: Admin): Promise<{ processed: number; done: number }> {
  const nowIso = new Date().toISOString();
  const { data: due, error } = await admin
    .from("crm_workflow_enrollments")
    .select("id,workflow_id,object_id,current_step")
    .eq("status", "active")
    .lte("next_run_at", nowIso)
    .limit(200);
  if (error || !due?.length) return { processed: 0, done: 0 };

  let processed = 0;
  let done = 0;
  for (const enr of due) {
    try {
      const { data: actions } = await admin
        .from("crm_workflow_actions")
        .select("id,position,action_type,config")
        .eq("workflow_id", enr.workflow_id)
        .order("position", { ascending: true });
      const list = actions ?? [];
      let step = Number(enr.current_step ?? 0);

      // Executa ações consecutivas nesta rodada; pausa ao atingir um delay.
      while (step < list.length) {
        const action = list[step];
        const result = await runWorkflowAction(
          admin,
          String(enr.object_id),
          action.action_type as WorkflowActionType,
          (action.config as Record<string, unknown>) ?? {},
        );
        await admin.from("crm_workflow_action_logs").insert({
          enrollment_id: enr.id,
          action_id: action.id,
          status: result.status,
          detail: result.detail ?? null,
        });
        processed++;
        step++;

        if (result.delayMs && result.delayMs > 0) {
          const finished = step >= list.length;
          await admin
            .from("crm_workflow_enrollments")
            .update({
              current_step: step,
              next_run_at: new Date(Date.now() + result.delayMs).toISOString(),
              status: finished ? "done" : "active",
            })
            .eq("id", enr.id);
          if (finished) done++;
          break;
        }
        if (step >= list.length) {
          await admin.from("crm_workflow_enrollments").update({ current_step: step, status: "done" }).eq("id", enr.id);
          done++;
          break;
        }
      }
      // Workflow sem ações → conclui direto.
      if (list.length === 0) {
        await admin.from("crm_workflow_enrollments").update({ status: "done" }).eq("id", enr.id);
        done++;
      }
    } catch {
      // Uma inscrição com erro é cancelada pra não travar a fila.
      await admin.from("crm_workflow_enrollments").update({ status: "canceled" }).eq("id", enr.id);
    }
  }
  return { processed, done };
}
