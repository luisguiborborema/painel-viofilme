import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { logFromUser } from "@/lib/audit/log";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIORITIES = new Set(["baixa", "media", "alta", "urgente"]);
const TASK_TYPES = new Set(["ligacao", "whatsapp", "email", "reuniao", "prazo", "todo"]);

/** Próximo vencimento de uma recorrência (diaria/semanal/mensal), ou null. */
function nextDue(baseIso: string, recurrence: string): string | null {
  if (!["diaria", "semanal", "mensal"].includes(recurrence)) return null;
  const d = new Date(baseIso);
  if (recurrence === "diaria") d.setDate(d.getDate() + 1);
  else if (recurrence === "semanal") d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

type Body = {
  action?: "add" | "bulk-add" | "done" | "reopen" | "set-assignees" | "set-priority" | "update" | "delete";
  leadId?: string;
  taskId?: string;
  title?: string;
  dueDate?: string;
  assignees?: string[];
  priority?: string;
  status?: "pending" | "done";
  // Criador estilo HubSpot: tipo + lembrete/recorrência (guardados na jsonb).
  type?: string;
  properties?: Record<string, unknown>;
  // Criação em massa (HubSpot): alvos por negócio, pessoa ou empresa.
  leadIds?: string[];
  contactIds?: string[];
  companyIds?: string[];
};

/** Cria uma tarefa (próxima ação) ou marca uma como concluída. */
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

  const action = b.action ?? "add";

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, persisted: false });
  }

  const supabase = await createClient();
  const now = new Date().toISOString();

  if (action === "set-assignees") {
    if (!b.taskId || !Array.isArray(b.assignees)) {
      return NextResponse.json({ error: "taskId/assignees ausente" }, { status: 400 });
    }
    const assignees = [...new Set(b.assignees.map((n) => n.trim()).filter(Boolean))];
    const { error } = await supabase
      .from("crm_tasks")
      .update({ assignees, assignee: assignees[0] ?? null })
      .eq("id", b.taskId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true, assignees });
  }

  if (action === "done" || action === "reopen") {
    if (!b.taskId) return NextResponse.json({ error: "taskId ausente" }, { status: 400 });
    const patch =
      action === "done"
        ? { status: "done", done_at: now }
        : { status: "pending", done_at: null };
    const { error } = await supabase.from("crm_tasks").update(patch).eq("id", b.taskId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Recorrência: ao concluir, materializa a próxima ocorrência (event-driven).
    if (action === "done") {
      const { data: t } = await supabase
        .from("crm_tasks")
        .select("lead_id,title,due_date,priority,assignee,assignees,properties")
        .eq("id", b.taskId)
        .maybeSingle();
      const rec = (t?.properties as Record<string, unknown> | null)?.recurrence;
      const next = nextDue(t?.due_date ? String(t.due_date) : now, String(rec ?? ""));
      if (t && next) {
        await supabase.from("crm_tasks").insert({
          lead_id: t.lead_id ?? null,
          title: t.title,
          due_date: next,
          priority: t.priority ?? "media",
          assignee: t.assignee ?? null,
          assignees: t.assignees ?? [], // coluna é NOT NULL default '{}'
          properties: t.properties ?? {},
        });
      }
    }
    await logFromUser(user, { action: action === "done" ? "done" : "update", area: "Atividades", target: b.taskId, detail: action === "done" ? "concluída" : "reaberta" });
    return NextResponse.json({ ok: true, persisted: true });
  }

  if (action === "set-priority") {
    if (!b.taskId || !b.priority || !PRIORITIES.has(b.priority)) {
      return NextResponse.json({ error: "taskId/prioridade inválida" }, { status: 400 });
    }
    const { error } = await supabase.from("crm_tasks").update({ priority: b.priority }).eq("id", b.taskId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  if (action === "delete") {
    if (!b.taskId) return NextResponse.json({ error: "taskId ausente" }, { status: 400 });
    const { error } = await supabase.from("crm_tasks").delete().eq("id", b.taskId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logFromUser(user, { action: "delete", area: "Atividades", target: b.taskId });
    return NextResponse.json({ ok: true, persisted: true });
  }

  // update — edita campos da tarefa (título, prazo, prioridade, status, tipo,
  // lembrete/recorrência/duração via properties). Merge da jsonb no servidor.
  if (action === "update") {
    if (!b.taskId) return NextResponse.json({ error: "taskId ausente" }, { status: 400 });
    const patch: Record<string, unknown> = {};
    if (b.title != null) patch.title = b.title.trim();
    if (b.dueDate !== undefined) patch.due_date = b.dueDate || null;
    if (b.priority && PRIORITIES.has(b.priority)) patch.priority = b.priority;
    if (b.status === "pending" || b.status === "done") {
      patch.status = b.status;
      patch.done_at = b.status === "done" ? now : null;
    }
    const extra: Record<string, unknown> = { ...(b.properties ?? {}) };
    if (b.type && TASK_TYPES.has(b.type)) extra.type = b.type;
    if (Object.keys(extra).length) {
      const { data: cur } = await supabase.from("crm_tasks").select("properties").eq("id", b.taskId).maybeSingle();
      const existing = (cur?.properties as Record<string, unknown> | null) ?? {};
      patch.properties = { ...existing, ...extra };
    }
    if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true, persisted: true });
    const { error } = await supabase.from("crm_tasks").update(patch).eq("id", b.taskId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  // bulk-add — cria UMA tarefa por registro selecionado (negócio, pessoa ou
  // empresa). Estilo HubSpot: mesmo título/tipo/prazo/responsável para todos.
  if (action === "bulk-add") {
    if (!b.title?.trim()) return NextResponse.json({ error: "título ausente" }, { status: 400 });
    const bulkProps: Record<string, unknown> = { ...(b.properties ?? {}) };
    if (b.type && TASK_TYPES.has(b.type)) bulkProps.type = b.type;
    const reqA = [...new Set((b.assignees ?? []).map((n) => n.trim()).filter(Boolean))];
    const prio = b.priority && PRIORITIES.has(b.priority) ? b.priority : "media";
    const propsJson = Object.keys(bulkProps).length ? bulkProps : {};

    const leadIds = [...new Set((b.leadIds ?? []).filter(Boolean))];
    const contactIds = [...new Set((b.contactIds ?? []).filter(Boolean))];
    const companyIds = [...new Set((b.companyIds ?? []).filter(Boolean))];
    const totalTargets = leadIds.length + contactIds.length + companyIds.length;
    if (totalTargets === 0) return NextResponse.json({ error: "nenhum alvo selecionado" }, { status: 400 });

    // Escolhe UM negócio por pessoa/empresa: preferir aberto, senão o mais recente.
    const isOpen = (r: { stage?: string | null; frozen_at?: string | null }) =>
      r.stage !== "ganho" && r.stage !== "perdido" && !r.frozen_at;
    function pickDeal(rows: { id: string; stage?: string | null; frozen_at?: string | null; created_at?: string | null }[]): string | null {
      if (!rows.length) return null;
      const sorted = [...rows].sort((a, z) => {
        const ao = isOpen(a) ? 0 : 1;
        const zo = isOpen(z) ? 0 : 1;
        if (ao !== zo) return ao - zo;
        return String(z.created_at ?? "").localeCompare(String(a.created_at ?? ""));
      });
      return sorted[0].id;
    }

    // Resolve os negócios de contatos e empresas em queries agrupadas.
    const resolved: { leadId: string | null }[] = leadIds.map((id) => ({ leadId: id }));
    if (contactIds.length) {
      const { data } = await supabase
        .from("crm_leads")
        .select("id, primary_contact_id, stage, frozen_at, created_at")
        .in("primary_contact_id", contactIds);
      const byContact = new Map<string, { id: string; stage?: string | null; frozen_at?: string | null; created_at?: string | null }[]>();
      for (const r of data ?? []) {
        const k = String(r.primary_contact_id);
        (byContact.get(k) ?? byContact.set(k, []).get(k)!).push(r);
      }
      for (const cid of contactIds) resolved.push({ leadId: pickDeal(byContact.get(cid) ?? []) });
    }
    if (companyIds.length) {
      const { data } = await supabase
        .from("crm_leads")
        .select("id, company_id, stage, frozen_at, created_at")
        .in("company_id", companyIds);
      const byCompany = new Map<string, { id: string; stage?: string | null; frozen_at?: string | null; created_at?: string | null }[]>();
      for (const r of data ?? []) {
        const k = String(r.company_id);
        (byCompany.get(k) ?? byCompany.set(k, []).get(k)!).push(r);
      }
      for (const cid of companyIds) resolved.push({ leadId: pickDeal(byCompany.get(cid) ?? []) });
    }

    // Monta as linhas: avulsas (lead_id null) exigem o próprio usuário no assignee.
    const rowFor = (leadId: string | null) => {
      const rowA = leadId ? reqA : reqA.length ? reqA : [user.name];
      return {
        lead_id: leadId,
        title: b.title!.trim(),
        due_date: b.dueDate ?? null,
        priority: prio,
        properties: propsJson,
        assignee: rowA[0] ?? null,
        assignees: rowA,
      };
    };
    const orphanRows = resolved.filter((r) => !r.leadId).map(() => rowFor(null));
    const linkedRows = resolved.filter((r) => r.leadId).map((r) => rowFor(r.leadId));

    let created = 0;
    // Avulsas sempre passam a RLS (usuário é o responsável).
    if (orphanRows.length) {
      const { data } = await supabase.from("crm_tasks").insert(orphanRows).select("id");
      created += data?.length ?? 0;
    }
    // Linkadas: tenta em lote; se a RLS recusar (negócio de outro dono), refaz
    // linha a linha para não perder o lote todo e contar as ignoradas.
    if (linkedRows.length) {
      const { data, error } = await supabase.from("crm_tasks").insert(linkedRows).select("id");
      if (!error) {
        created += data?.length ?? 0;
      } else {
        for (const row of linkedRows) {
          const { data: one } = await supabase.from("crm_tasks").insert(row).select("id");
          if (one?.length) created += 1;
        }
      }
      // Fixa "próxima ação" nos negócios que receberam tarefa.
      const linkedIds = [...new Set(resolved.map((r) => r.leadId).filter(Boolean) as string[])];
      if (linkedIds.length) {
        await supabase
          .from("crm_leads")
          .update({ next_task_title: b.title!.trim(), next_task_due: b.dueDate ?? null, updated_at: now })
          .in("id", linkedIds);
      }
    }

    return NextResponse.json({ ok: true, persisted: true, created, skipped: totalTargets - created });
  }

  // add — tarefa vinculada a um negócio OU avulsa (sem leadId).
  if (!b.title?.trim()) {
    return NextResponse.json({ error: "título ausente" }, { status: 400 });
  }
  // Tipo + lembrete/recorrência ficam na jsonb `properties` (sem coluna dedicada).
  const props: Record<string, unknown> = { ...(b.properties ?? {}) };
  if (b.type && TASK_TYPES.has(b.type)) props.type = b.type;
  // Responsáveis: os informados ou, p/ avulsa, o próprio criador (exigido pelo RLS).
  const reqAssignees = [...new Set((b.assignees ?? []).map((n) => n.trim()).filter(Boolean))];
  const assignees = reqAssignees.length ? reqAssignees : b.leadId ? [] : [user.name];
  const { data, error } = await supabase
    .from("crm_tasks")
    .insert({
      lead_id: b.leadId ?? null,
      title: b.title.trim(),
      due_date: b.dueDate ?? null,
      priority: b.priority && PRIORITIES.has(b.priority) ? b.priority : "media",
      properties: Object.keys(props).length ? props : {},
      assignee: assignees[0] ?? null,
      assignees, // NUNCA null: coluna é NOT NULL default '{}' (array vazio é ok)
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fixa como "próxima ação" do lead (só quando vinculada).
  if (b.leadId) {
    await supabase
      .from("crm_leads")
      .update({ next_task_title: b.title.trim(), next_task_due: b.dueDate ?? null, updated_at: now })
      .eq("id", b.leadId);
  }

  await logFromUser(user, { action: "create", area: "Atividades", target: b.title?.trim() ?? null });
  return NextResponse.json({ ok: true, persisted: true, id: data.id });
}
