import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { sendWhatsappText } from "@/lib/whatsapp/send";
import { WHATSAPP_NOTIFY_NUMBERS } from "@/lib/whatsapp/config";
import type { WorkflowActionType } from "@/lib/data/crm";

type Admin = ReturnType<typeof createAdminClient>;
type ActionResult = { status: "ok" | "skipped" | "error"; detail?: string; delayMs?: number; stop?: boolean };

/** Avalia uma condição do workflow contra um valor cru do negócio. */
function evalCondition(raw: unknown, op: string, target: string): boolean {
  const s = raw == null ? "" : String(raw).toLowerCase();
  const t = (target ?? "").toLowerCase();
  const n = Number(raw);
  const tn = Number(target);
  switch (op) {
    case "filled":
      return s.trim() !== "";
    case "empty":
      return s.trim() === "";
    case "neq":
      return s !== t;
    case "contains":
      return s.includes(t);
    case "gt":
      return !Number.isNaN(n) && !Number.isNaN(tn) && n > tn;
    case "lt":
      return !Number.isNaN(n) && !Number.isNaN(tn) && n < tn;
    case "eq":
    default:
      return s === t;
  }
}

/**
 * Inscreve um negócio nos workflows ATIVOS cujo gatilho casa. Best-effort e
 * tolerante: sem service-role ou sem as tabelas (pré-0104), simplesmente não faz nada.
 */
export async function enrollWorkflows(opts: {
  objectId: string;
  trigger: "stage_enter" | "created" | "property_change";
  stageKey?: string;
  propertyKey?: string;
  propertyValue?: unknown;
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
    const cfg = (w.trigger_config as { stageKey?: string; key?: string; value?: string } | null) ?? {};
    if (opts.trigger === "stage_enter") return Boolean(cfg.stageKey) && cfg.stageKey === opts.stageKey;
    // property_change: casa a chave; se o gatilho fixa um valor, casa também o valor.
    if (!cfg.key || cfg.key !== opts.propertyKey) return false;
    if (cfg.value != null && String(cfg.value) !== "") return String(cfg.value) === String(opts.propertyValue ?? "");
    return true;
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
    .select("name,primary_contact_id,contact_phone,owner,properties,stage,monthly_value,priority,probability,source")
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
      const { error } = await admin.from("crm_tasks").insert({
        lead_id: dealId,
        title: String(config.title || "Tarefa (workflow)"),
        due_date: new Date(Date.now() + dueDays * 86_400_000).toISOString(),
        status: "pending",
      });
      return error ? { status: "error", detail: error.message } : { status: "ok" };
    }
    case "whatsapp": {
      const msg = String(config.message || "");
      if (contactPhone && msg) await sendWhatsappText(contactPhone, msg);
      const { error } = await admin.from("crm_interactions").insert({ lead_id: dealId, channel: "whatsapp", direction: "out", body: msg });
      if (error) return { status: "error", detail: error.message };
      return contactPhone ? { status: "ok" } : { status: "skipped", detail: "contato sem telefone" };
    }
    case "notify": {
      const msg = String(config.message || "");
      for (const num of WHATSAPP_NOTIFY_NUMBERS) await sendWhatsappText(num, `🔔 ${deal.name}: ${msg}`);
      const { error } = await admin.from("crm_interactions").insert({ lead_id: dealId, channel: "system", body: `🔔 ${msg}` });
      return error ? { status: "error", detail: error.message } : { status: "ok" };
    }
    case "set_property": {
      const key = String(config.key || "");
      if (!key) return { status: "skipped", detail: "sem propriedade" };
      const props = (deal.properties as Record<string, unknown> | null) ?? {};
      const { error } = await admin.from("crm_leads").update({ properties: { ...props, [key]: config.value } }).eq("id", dealId);
      return error ? { status: "error", detail: error.message } : { status: "ok" };
    }
    case "set_stage": {
      const stageKey = String(config.stageKey || "");
      if (!stageKey) return { status: "skipped", detail: "sem etapa" };
      // Update cru da etapa — NÃO reengata gatilhos stage_enter (evita loop).
      const nowIso = new Date().toISOString();
      const patch: Record<string, unknown> = { stage: stageKey, stage_changed_at: nowIso };
      if (stageKey === "ganho") patch.won_at = nowIso;
      if (stageKey === "perdido") patch.lost_at = nowIso;
      const { error } = await admin.from("crm_leads").update(patch).eq("id", dealId);
      if (error) return { status: "error", detail: error.message };
      await admin.from("crm_interactions").insert({ lead_id: dealId, channel: "system", body: `↦ Movido para etapa (workflow).` });
      return { status: "ok" };
    }
    case "assign_owner": {
      const owner = String(config.owner || "").trim();
      if (!owner) return { status: "skipped", detail: "sem responsável" };
      const { error } = await admin.from("crm_leads").update({ owner, assignees: [owner] }).eq("id", dealId);
      return error ? { status: "error", detail: error.message } : { status: "ok" };
    }
    case "condition": {
      const key = String(config.key || "");
      const op = String(config.op || "eq");
      const target = String(config.value ?? "");
      if (!key) return { status: "ok" }; // sem condição definida → segue
      // Valor: propriedade customizada primeiro; senão campo nativo carregado.
      const props = (deal.properties as Record<string, unknown> | null) ?? {};
      const nativeMap: Record<string, unknown> = {
        stage: deal.stage,
        monthly_value: deal.monthly_value,
        priority: deal.priority,
        probability: deal.probability,
        source: deal.source,
        owner: deal.owner,
      };
      const raw = key in props ? props[key] : nativeMap[key];
      const met = evalCondition(raw, op, target);
      return met
        ? { status: "ok", detail: "condição atendida" }
        : { status: "skipped", detail: "condição não atendida — encerra", stop: true };
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
      let paused = false; // reagendado por um delay (persistido como ativo)

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

        // Condição não atendida → encerra (finalizado como done abaixo).
        if (result.stop) break;

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
          paused = true;
          break;
        }
      }
      // Finaliza UMA vez: fim natural, condição (stop), zero ações OU cursor >=
      // length (ação removida em voo). Evita inscrição travada reprocessando à toa.
      if (!paused) {
        await admin.from("crm_workflow_enrollments").update({ current_step: step, status: "done" }).eq("id", enr.id);
        done++;
      }
    } catch {
      // Uma inscrição com erro é cancelada pra não travar a fila.
      await admin.from("crm_workflow_enrollments").update({ status: "canceled" }).eq("id", enr.id);
    }
  }
  return { processed, done };
}
