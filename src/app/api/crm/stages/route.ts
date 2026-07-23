import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS = ["open", "won", "lost"];

type Requirement = {
  source: "property" | "native";
  field: string;
  label: string;
  op: "filled" | "true" | "equals" | "gt";
  value?: string;
};

type Body = {
  action?: "create" | "update" | "delete" | "reorder";
  id?: string;
  pipelineId?: string;
  label?: string;
  color?: string;
  probability?: number;
  kind?: string;
  hint?: string;
  requirements?: Requirement[];
  automations?: unknown[];
  orders?: { id: string; position: number }[];
};

function slug(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "estagio"
  );
}

/** CRUD + reordenação dos estágios do pipeline (crm_stages). */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const action = body.action ?? (body.id ? "update" : "create");

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, persisted: false });
  }
  const supabase = await createClient();

  if (action === "reorder") {
    if (!Array.isArray(body.orders)) {
      return NextResponse.json({ error: "orders ausente" }, { status: 400 });
    }
    await Promise.all(
      body.orders.map((o) =>
        supabase.from("crm_stages").update({ position: o.position }).eq("id", o.id),
      ),
    );
    return NextResponse.json({ ok: true, persisted: true });
  }

  if (action === "update") {
    if (!body.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const patch: Record<string, unknown> = {};
    if (body.label != null) patch.label = body.label;
    if (body.color != null) patch.color = body.color;
    if (body.probability != null) patch.probability = body.probability;
    if (body.kind != null && KINDS.includes(body.kind)) patch.kind = body.kind;
    if (body.hint != null) patch.hint = body.hint.trim() || null;
    if (Array.isArray(body.requirements)) patch.requirements = body.requirements;
    if (Array.isArray(body.automations)) patch.automations = body.automations;
    const { error } = await supabase.from("crm_stages").update(patch).eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  if (action === "delete") {
    if (!body.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    // Descobre o estágio a excluir + pipeline
    const { data: stage } = await supabase
      .from("crm_stages")
      .select("id,pipeline_id,key")
      .eq("id", body.id)
      .maybeSingle();
    if (!stage) return NextResponse.json({ error: "estágio não encontrado" }, { status: 404 });

    // Precisa restar ao menos 1 estágio; reatribui os negócios ao estágio destino.
    const { data: others } = await supabase
      .from("crm_stages")
      .select("id,key,position")
      .eq("pipeline_id", stage.pipeline_id)
      .neq("id", body.id)
      .order("position", { ascending: true });
    if (!others || others.length === 0) {
      return NextResponse.json(
        { error: "Não é possível excluir o último estágio do pipeline." },
        { status: 400 },
      );
    }
    const target = others[0];
    await supabase
      .from("crm_leads")
      .update({ stage: target.key, stage_id: target.id })
      .eq("stage", stage.key);
    const { error } = await supabase.from("crm_stages").delete().eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true, reassignedTo: target.key });
  }

  // create
  if (!body.label) return NextResponse.json({ error: "rótulo ausente" }, { status: 400 });
  // pipeline: usa o informado ou o default
  let pipelineId = body.pipelineId;
  if (!pipelineId) {
    const { data: p } = await supabase
      .from("crm_pipelines")
      .select("id")
      .eq("is_default", true)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();
    pipelineId = p?.id as string | undefined;
  }
  if (!pipelineId) return NextResponse.json({ error: "pipeline inexistente" }, { status: 400 });

  // key única no pipeline
  const { data: existing } = await supabase
    .from("crm_stages")
    .select("key,position")
    .eq("pipeline_id", pipelineId);
  const keys = new Set((existing ?? []).map((s) => String(s.key)));
  let key = slug(body.label);
  let i = 2;
  while (keys.has(key)) key = `${slug(body.label)}_${i++}`;
  const maxPos = (existing ?? []).reduce((m, s) => Math.max(m, Number(s.position ?? 0)), 0);

  const { data, error } = await supabase
    .from("crm_stages")
    .insert({
      pipeline_id: pipelineId,
      key,
      label: body.label,
      color: body.color ?? "#64748b",
      probability: body.probability ?? 0,
      position: maxPos + 1,
      kind: body.kind && KINDS.includes(body.kind) ? body.kind : "open",
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: true, id: data.id, key });
}
