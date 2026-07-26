import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action?: "create" | "rename" | "delete" | "set-default";
  id?: string;
  name?: string;
};

// Estágios padrão de um pipeline novo.
const SEED_STAGES = [
  { key: "novo", label: "Novo", color: "#64748b", probability: 15, position: 1, kind: "open" },
  { key: "em_contato", label: "Em contato", color: "#0ea5e9", probability: 40, position: 2, kind: "open" },
  { key: "negociacao", label: "Em negociação", color: "#f59e0b", probability: 70, position: 3, kind: "open" },
  { key: "ganho", label: "Ganho", color: "#10b981", probability: 100, position: 4, kind: "won" },
  { key: "perdido", label: "Perdido", color: "#f43f5e", probability: 0, position: 5, kind: "lost" },
];

/** CRUD de pipelines (funis). */
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

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, persisted: false });
  }
  const supabase = await createClient();

  if (b.action === "rename") {
    if (!b.id || !b.name?.trim()) return NextResponse.json({ error: "id/nome ausente" }, { status: 400 });
    const { error } = await supabase.from("crm_pipelines").update({ name: b.name.trim() }).eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (b.action === "set-default") {
    if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    await supabase.from("crm_pipelines").update({ is_default: false }).neq("id", b.id);
    const { error } = await supabase.from("crm_pipelines").update({ is_default: true }).eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (b.action === "delete") {
    if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    const { data: pipe } = await supabase
      .from("crm_pipelines").select("is_default").eq("id", b.id).maybeSingle();
    if (pipe?.is_default) {
      return NextResponse.json({ error: "Não é possível excluir o pipeline padrão." }, { status: 400 });
    }
    // negócios do pipeline voltam ao padrão (FK set null → tratado como default no app)
    const { error } = await supabase.from("crm_pipelines").delete().eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // create
  if (!b.name?.trim()) return NextResponse.json({ error: "nome ausente" }, { status: 400 });
  const { data: existing } = await supabase.from("crm_pipelines").select("position");
  const maxPos = (existing ?? []).reduce((m, p) => Math.max(m, Number(p.position ?? 0)), 0);
  const { data: pipe, error } = await supabase
    .from("crm_pipelines")
    .insert({ name: b.name.trim(), is_default: false, position: maxPos + 1 })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase
    .from("crm_stages")
    .insert(SEED_STAGES.map((s) => ({ ...s, pipeline_id: pipe.id })));

  return NextResponse.json({ ok: true, id: pipe.id });
}
