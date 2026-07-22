import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Fila do "próximo lead com tarefa aberta" (fluxo HubSpot da Ficha do Lead):
 * ao concluir uma tarefa, o SDR pode pular direto para o próximo negócio SEU
 * que ainda tem tarefa pendente — operando em massa sem abrir card por card.
 *
 * GET ?exclude=<dealId> → { count, nextId } (negócios distintos, ordenados por
 * vencimento; congelados e fechados ficam de fora).
 */
export async function GET(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ count: 0, nextId: null });
  }

  const exclude = new URL(req.url).searchParams.get("exclude") ?? "";
  const supabase = await createClient();

  // RLS já restringe às tarefas visíveis ao usuário; refinamos para as SUAS.
  const { data: tasks } = await supabase
    .from("crm_tasks")
    .select("lead_id, due_date, crm_leads!inner(owner, assignees, stage, frozen_at)")
    .eq("status", "pending")
    .order("due_date", { ascending: true, nullsFirst: false });

  const seen = new Set<string>();
  const queue: string[] = [];
  for (const t of tasks ?? []) {
    const leadId = String(t.lead_id);
    if (leadId === exclude || seen.has(leadId)) continue;
    const lead = (Array.isArray(t.crm_leads) ? t.crm_leads[0] : t.crm_leads) as
      | { owner?: string; assignees?: string[]; stage?: string; frozen_at?: string | null }
      | undefined;
    if (!lead) continue;
    if (lead.frozen_at) continue;
    if (lead.stage === "ganho" || lead.stage === "perdido") continue;
    const mine = lead.owner === user.name || (lead.assignees ?? []).includes(user.name);
    if (!mine) continue;
    seen.add(leadId);
    queue.push(leadId);
  }

  return NextResponse.json({ count: queue.length, nextId: queue[0] ?? null });
}
