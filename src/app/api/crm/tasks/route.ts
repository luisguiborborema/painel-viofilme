import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action?: "add" | "done" | "reopen" | "set-assignees";
  leadId?: string;
  taskId?: string;
  title?: string;
  dueDate?: string;
  assignees?: string[];
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

  // add
  if (!b.leadId || !b.title?.trim()) {
    return NextResponse.json({ error: "leadId/title ausente" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("crm_tasks")
    .insert({ lead_id: b.leadId, title: b.title.trim(), due_date: b.dueDate ?? null })
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
