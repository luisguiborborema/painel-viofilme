import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action?: "create" | "update" | "delete";
  id?: string;
  collaboratorId?: string;
  collaboratorName?: string;
  role?: string;
  title?: string;
  indicator?: string;
  progress?: string;
  status?: string;
  deadline?: string;
};

const STATUS = new Set(["not_started", "in_progress", "done", "missed"]);
const clean = (v?: string) => (v && v.trim() ? v.trim() : null);

function toFields(b: Body): Record<string, unknown> {
  const f: Record<string, unknown> = {};
  if (b.collaboratorId !== undefined) f.collaborator_id = clean(b.collaboratorId);
  if (b.collaboratorName !== undefined && b.collaboratorName.trim()) f.collaborator_name = b.collaboratorName.trim();
  if ("role" in b) f.role = clean(b.role);
  if (b.title !== undefined && b.title.trim()) f.title = b.title.trim();
  if ("indicator" in b) f.indicator = clean(b.indicator);
  if ("progress" in b) f.progress = clean(b.progress);
  if ("status" in b) f.status = STATUS.has(String(b.status)) ? b.status : "in_progress";
  if ("deadline" in b) f.deadline = clean(b.deadline);
  return f;
}

/** RH — PDIs (objetivos de desenvolvimento). Só gerencial. */
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

  try {
    if (b.action === "delete") {
      if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
      const { error } = await supabase.from("rh_pdis").delete().eq("id", b.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (b.action === "update") {
      if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
      const patch = toFields(b);
      patch.updated_at = new Date().toISOString();
      const { error } = await supabase.from("rh_pdis").update(patch).eq("id", b.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (!b.collaboratorName?.trim() || !b.title?.trim()) {
      return NextResponse.json({ error: "colaborador e objetivo são obrigatórios" }, { status: 400 });
    }
    const { data, error } = await supabase.from("rh_pdis").insert(toFields(b)).select("id").single();
    if (error) throw error;
    return NextResponse.json({ ok: true, id: data?.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    if (/rh_pdis.* does not exist|42P01/i.test(msg)) {
      return NextResponse.json(
        { error: "Tabela de PDIs ainda não existe. Rode a migração 0113_rh_pdi_reviews.sql." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
