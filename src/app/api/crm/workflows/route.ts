import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTION_TYPES = ["delay", "task", "whatsapp", "notify", "set_property", "set_stage", "assign_owner"];

type Body = {
  action?:
    | "create"
    | "update"
    | "delete"
    | "add-action"
    | "update-action"
    | "delete-action"
    | "reorder-action";
  id?: string;
  workflowId?: string;
  name?: string;
  triggerType?: string;
  triggerConfig?: Record<string, unknown>;
  isActive?: boolean;
  actionType?: string;
  config?: Record<string, unknown>;
  position?: number;
  dir?: -1 | 1;
};

function missing(err: { code?: string } | null): boolean {
  return err?.code === "42P01"; // tabela não existe (pré-migração 0104)
}

/** CRUD dos Workflows (fluxos de automação). Só gestão. */
export async function POST(req: Request) {
  const user = await getSession();
  if (user?.readOnly) return NextResponse.json({ error: "acesso somente leitura" }, { status: 403 });
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  let b: Body;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });
  const supabase = await createClient();
  const notReady = () =>
    NextResponse.json({ error: "Rode a migração 0104 para usar Workflows." }, { status: 400 });

  switch (b.action) {
    case "create": {
      if (!b.name?.trim()) return NextResponse.json({ error: "nome ausente" }, { status: 400 });
      const res = await supabase
        .from("crm_workflows")
        .insert({
          name: b.name.trim(),
          object_type: "deal",
          trigger_type: b.triggerType ?? "stage_enter",
          trigger_config: b.triggerConfig ?? {},
          is_active: false,
        })
        .select("id")
        .single();
      if (missing(res.error)) return notReady();
      if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });
      return NextResponse.json({ ok: true, id: res.data.id });
    }
    case "update": {
      if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
      const patch: Record<string, unknown> = {};
      if (b.name != null) patch.name = b.name.trim();
      if (b.triggerType != null) patch.trigger_type = b.triggerType;
      if (b.triggerConfig != null) patch.trigger_config = b.triggerConfig;
      if (b.isActive != null) patch.is_active = b.isActive;
      const { error } = await supabase.from("crm_workflows").update(patch).eq("id", b.id);
      if (missing(error)) return notReady();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    case "delete": {
      if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
      const { error } = await supabase.from("crm_workflows").delete().eq("id", b.id);
      if (missing(error)) return notReady();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    case "add-action": {
      if (!b.workflowId) return NextResponse.json({ error: "workflowId ausente" }, { status: 400 });
      const actionType = b.actionType ?? "task";
      if (!ACTION_TYPES.includes(actionType)) {
        return NextResponse.json({ error: "tipo de ação inválido" }, { status: 400 });
      }
      const res = await supabase
        .from("crm_workflow_actions")
        .insert({
          workflow_id: b.workflowId,
          position: b.position ?? 99,
          action_type: actionType,
          config: b.config ?? {},
        })
        .select("id")
        .single();
      if (missing(res.error)) return notReady();
      if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });
      return NextResponse.json({ ok: true, id: res.data.id });
    }
    case "update-action": {
      if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
      const patch: Record<string, unknown> = {};
      if (b.actionType != null) patch.action_type = b.actionType;
      if (b.config != null) patch.config = b.config;
      if (b.position != null) patch.position = b.position;
      const { error } = await supabase.from("crm_workflow_actions").update(patch).eq("id", b.id);
      if (missing(error)) return notReady();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    case "delete-action": {
      if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
      const { error } = await supabase.from("crm_workflow_actions").delete().eq("id", b.id);
      if (missing(error)) return notReady();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: "ação desconhecida" }, { status: 400 });
  }
}
