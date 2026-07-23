import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIORITIES = new Set(["baixa", "media", "alta", "urgente"]);
const TASK_TYPES = new Set(["ligacao", "whatsapp", "email", "reuniao", "todo"]);

type Body = {
  action?: "add" | "done" | "reopen" | "set-assignees" | "set-priority" | "update" | "delete";
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
};

/** Cria uma tarefa (próxima ação) ou marca uma como concluída. */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
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

  // add
  if (!b.leadId || !b.title?.trim()) {
    return NextResponse.json({ error: "leadId/title ausente" }, { status: 400 });
  }
  // Tipo + lembrete/recorrência ficam na jsonb `properties` (sem coluna dedicada).
  const props: Record<string, unknown> = { ...(b.properties ?? {}) };
  if (b.type && TASK_TYPES.has(b.type)) props.type = b.type;
  const { data, error } = await supabase
    .from("crm_tasks")
    .insert({
      lead_id: b.leadId,
      title: b.title.trim(),
      due_date: b.dueDate ?? null,
      priority: b.priority && PRIORITIES.has(b.priority) ? b.priority : "media",
      properties: Object.keys(props).length ? props : {},
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fixa como "próxima ação" do lead.
  await supabase
    .from("crm_leads")
    .update({ next_task_title: b.title.trim(), next_task_due: b.dueDate ?? null, updated_at: now })
    .eq("id", b.leadId);

  return NextResponse.json({ ok: true, persisted: true, id: data.id });
}
