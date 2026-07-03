import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action?:
    | "create-flow" | "rename-flow" | "delete-flow"
    | "add-step" | "update-step" | "delete-step"
    | "apply";
  id?: string;
  flowId?: string;
  stepId?: string;
  dealId?: string;
  name?: string;
  title?: string;
  dueDays?: number;
  position?: number;
};

/** Gerencia fluxos de tarefas (playbooks) e os aplica a um negócio. */
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

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, persisted: false });
  }
  const supabase = await createClient();

  switch (b.action) {
    case "create-flow": {
      if (!b.name?.trim()) return NextResponse.json({ error: "nome ausente" }, { status: 400 });
      const { data, error } = await supabase
        .from("crm_task_flows")
        .insert({ name: b.name.trim() })
        .select("id")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, id: data.id });
    }
    case "rename-flow": {
      if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
      const { error } = await supabase.from("crm_task_flows").update({ name: b.name }).eq("id", b.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    case "delete-flow": {
      if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
      const { error } = await supabase.from("crm_task_flows").delete().eq("id", b.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    case "add-step": {
      if (!b.flowId || !b.title?.trim()) {
        return NextResponse.json({ error: "flowId/título ausente" }, { status: 400 });
      }
      const { data: steps } = await supabase
        .from("crm_task_flow_steps").select("position").eq("flow_id", b.flowId);
      const maxPos = (steps ?? []).reduce((m, s) => Math.max(m, Number(s.position ?? 0)), 0);
      const { error } = await supabase.from("crm_task_flow_steps").insert({
        flow_id: b.flowId, title: b.title.trim(), due_days: b.dueDays ?? 1, position: maxPos + 1,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    case "update-step": {
      if (!b.stepId) return NextResponse.json({ error: "stepId ausente" }, { status: 400 });
      const patch: Record<string, unknown> = {};
      if (b.title != null) patch.title = b.title;
      if (b.dueDays != null) patch.due_days = b.dueDays;
      if (b.position != null) patch.position = b.position;
      const { error } = await supabase.from("crm_task_flow_steps").update(patch).eq("id", b.stepId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    case "delete-step": {
      if (!b.stepId) return NextResponse.json({ error: "stepId ausente" }, { status: 400 });
      const { error } = await supabase.from("crm_task_flow_steps").delete().eq("id", b.stepId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    case "apply": {
      if (!b.dealId || !b.flowId) {
        return NextResponse.json({ error: "dealId/flowId ausente" }, { status: 400 });
      }
      const { data: steps } = await supabase
        .from("crm_task_flow_steps")
        .select("title,due_days")
        .eq("flow_id", b.flowId)
        .order("position", { ascending: true });
      if (!steps?.length) return NextResponse.json({ error: "fluxo sem passos" }, { status: 400 });
      const now = Date.now();
      const rows = steps.map((s) => ({
        lead_id: b.dealId,
        title: String(s.title),
        due_date: new Date(now + Number(s.due_days ?? 1) * 86_400_000).toISOString(),
        status: "pending",
      }));
      const { error } = await supabase.from("crm_tasks").insert(rows);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, created: rows.length });
    }
    default:
      return NextResponse.json({ error: "ação inválida" }, { status: 400 });
  }
}
