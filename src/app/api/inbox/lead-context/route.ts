import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Contexto do negócio vinculado a uma conversa (painel do lead no inbox):
 * etapa, valor, responsável, origem, tags, próxima tarefa e últimas notas.
 */
export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const leadId = req.nextUrl.searchParams.get("leadId");
  if (!leadId) return NextResponse.json({ error: "leadId ausente" }, { status: 400 });
  if (!isSupabaseConfigured()) return NextResponse.json({ context: null });

  const supabase = await createClient();
  const { data: lead } = await supabase
    .from("crm_leads")
    .select("id,name,stage,pipeline_id,monthly_value,owner,source,tags")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) return NextResponse.json({ context: null });

  const [{ data: stage }, { data: tasks }, { data: notes }] = await Promise.all([
    supabase.from("crm_stages").select("label,color").eq("pipeline_id", lead.pipeline_id ?? "").eq("key", lead.stage).maybeSingle(),
    supabase.from("crm_tasks").select("id,title,due_date").eq("lead_id", leadId).eq("status", "pending").order("due_date", { ascending: true, nullsFirst: false }).limit(1),
    supabase.from("crm_interactions").select("body,author,created_at,channel").eq("lead_id", leadId).eq("channel", "note").order("created_at", { ascending: false }).limit(3),
  ]);

  const tagIds = (lead.tags as string[] | null) ?? [];
  let tags: string[] = [];
  if (tagIds.length) {
    const { data: tg } = await supabase.from("crm_tags").select("name").in("id", tagIds);
    tags = (tg ?? []).map((t) => String(t.name));
  }

  return NextResponse.json({
    context: {
      leadId: String(lead.id),
      name: String(lead.name),
      stageLabel: stage?.label ?? String(lead.stage),
      stageColor: stage?.color ?? "#64748b",
      monthlyValue: Number(lead.monthly_value ?? 0),
      owner: lead.owner ? String(lead.owner) : null,
      source: lead.source ? String(lead.source) : null,
      tags,
      nextTask: tasks?.[0] ? { id: String(tasks[0].id), title: String(tasks[0].title), dueDate: tasks[0].due_date ? String(tasks[0].due_date) : null } : null,
      notes: (notes ?? []).map((n) => ({ body: String(n.body ?? ""), author: n.author ? String(n.author) : null, createdAt: String(n.created_at) })),
    },
  });
}
