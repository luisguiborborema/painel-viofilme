import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STEP_STATUS = new Set(["concluido", "andamento", "proximo", "bloqueado"]);
const GATE_STATUS = new Set(["liberado", "validando", "bloqueado"]);

type Body = {
  action?: "set-step-status" | "toggle-action" | "set-gate-status" | "toggle-gate-item" | "set-block-progress" | "set-block-content" | "set-scope";
  clientId?: string;
  stepNumber?: number;
  actionIndex?: number;
  done?: boolean;
  gateNumber?: number;
  itemIndex?: number;
  status?: string;
  blockCode?: string;
  progress?: number;
  content?: string;
  scope?: string;
};

async function projectId(supabase: Awaited<ReturnType<typeof createClient>>, clientId: string) {
  const { data } = await supabase.from("violaunch_projects").select("id").eq("client_id", clientId).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/** Persiste o estado do VioLaunch (status de passos/gates, checklists, blocos). */
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
  if (!b.clientId) return NextResponse.json({ error: "clientId ausente" }, { status: 400 });

  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });
  const supabase = await createClient();
  const pid = await projectId(supabase, b.clientId);
  if (!pid) return NextResponse.json({ error: "projeto não encontrado" }, { status: 404 });
  const now = new Date().toISOString();

  if (b.action === "set-step-status") {
    if (b.stepNumber == null || !b.status || !STEP_STATUS.has(b.status)) {
      return NextResponse.json({ error: "passo/status inválido" }, { status: 400 });
    }
    const { error } = await supabase
      .from("violaunch_steps")
      .update({ status: b.status })
      .eq("project_id", pid)
      .eq("step_number", b.stepNumber);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (b.status === "andamento" || b.status === "concluido") {
      await supabase.from("violaunch_projects").update({ current_step: b.stepNumber, updated_at: now }).eq("id", pid);
    }
    return NextResponse.json({ ok: true, persisted: true });
  }

  if (b.action === "toggle-action") {
    if (b.stepNumber == null || b.actionIndex == null) {
      return NextResponse.json({ error: "passo/índice ausente" }, { status: 400 });
    }
    const { data: step } = await supabase
      .from("violaunch_steps").select("id").eq("project_id", pid).eq("step_number", b.stepNumber).maybeSingle();
    const stepId = (step as { id: string } | null)?.id;
    if (!stepId) return NextResponse.json({ error: "passo não encontrado" }, { status: 404 });
    const { data: subs } = await supabase
      .from("violaunch_substeps").select("id, sort").eq("step_id", stepId).eq("kind", "action").order("sort");
    const target = (subs ?? [])[b.actionIndex] as { id: string } | undefined;
    if (!target) return NextResponse.json({ error: "ação não encontrada" }, { status: 404 });
    const { error } = await supabase.from("violaunch_substeps").update({ done: !!b.done }).eq("id", target.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  if (b.action === "set-gate-status") {
    if (b.gateNumber == null || !b.status || !GATE_STATUS.has(b.status)) {
      return NextResponse.json({ error: "gate/status inválido" }, { status: 400 });
    }
    const { error } = await supabase
      .from("violaunch_gates").update({ status: b.status }).eq("project_id", pid).eq("gate_number", b.gateNumber);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  if (b.action === "toggle-gate-item") {
    if (b.gateNumber == null || b.itemIndex == null) {
      return NextResponse.json({ error: "gate/índice ausente" }, { status: 400 });
    }
    const { data: gate } = await supabase
      .from("violaunch_gates").select("items").eq("project_id", pid).eq("gate_number", b.gateNumber).maybeSingle();
    const items = Array.isArray((gate as { items: unknown } | null)?.items) ? [...(gate as { items: { label: string; done: boolean }[] }).items] : [];
    if (!items[b.itemIndex]) return NextResponse.json({ error: "item não encontrado" }, { status: 404 });
    items[b.itemIndex] = { ...items[b.itemIndex], done: !!b.done };
    const { error } = await supabase.from("violaunch_gates").update({ items }).eq("project_id", pid).eq("gate_number", b.gateNumber);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  if (b.action === "set-block-progress") {
    if (!b.blockCode || b.progress == null) {
      return NextResponse.json({ error: "bloco/progresso ausente" }, { status: 400 });
    }
    const pct = Math.max(0, Math.min(100, Math.round(Number(b.progress) || 0)));
    const { error } = await supabase
      .from("roadmap_blocks").update({ progress: pct }).eq("project_id", pid).eq("block_code", b.blockCode);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  if (b.action === "set-block-content") {
    if (!b.blockCode) return NextResponse.json({ error: "bloco ausente" }, { status: 400 });
    const { error } = await supabase
      .from("roadmap_blocks")
      .update({ content: { text: b.content ?? "" } })
      .eq("project_id", pid)
      .eq("block_code", b.blockCode);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  if (b.action === "set-scope") {
    const scope = b.scope === "reduzido" ? "reduzido" : "completo";
    const { error } = await supabase.from("violaunch_projects").update({ scope, updated_at: now }).eq("id", pid);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  return NextResponse.json({ error: "ação desconhecida" }, { status: 400 });
}
