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
  cycle?: string;
  selfScore?: number;
  leaderScore?: number;
  note?: string;
  status?: string;
};

const STATUS = new Set(["pending", "self_done", "done"]);
const clean = (v?: string) => (v && v.trim() ? v.trim() : null);
const score = (v: unknown) => Math.max(0, Math.min(5, Number(v) || 0));

function toFields(b: Body): Record<string, unknown> {
  const f: Record<string, unknown> = {};
  if (b.collaboratorId !== undefined) f.collaborator_id = clean(b.collaboratorId);
  if (b.collaboratorName !== undefined && b.collaboratorName.trim()) f.collaborator_name = b.collaboratorName.trim();
  if ("role" in b) f.role = clean(b.role);
  if ("cycle" in b) f.cycle = clean(b.cycle);
  if ("selfScore" in b) f.self_score = score(b.selfScore);
  if ("leaderScore" in b) f.leader_score = score(b.leaderScore);
  if ("note" in b) f.note = clean(b.note);
  if ("status" in b) f.status = STATUS.has(String(b.status)) ? b.status : "pending";
  return f;
}

/** RH — Avaliações. Só gerencial. */
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
      const { error } = await supabase.from("rh_reviews").delete().eq("id", b.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (b.action === "update") {
      if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
      const patch = toFields(b);
      patch.updated_at = new Date().toISOString();
      const { error } = await supabase.from("rh_reviews").update(patch).eq("id", b.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (!b.collaboratorName?.trim()) {
      return NextResponse.json({ error: "colaborador é obrigatório" }, { status: 400 });
    }
    const { data, error } = await supabase.from("rh_reviews").insert(toFields(b)).select("id").single();
    if (error) throw error;
    return NextResponse.json({ ok: true, id: data?.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    if (/rh_reviews.* does not exist|42P01/i.test(msg)) {
      return NextResponse.json(
        { error: "Tabela de avaliações ainda não existe. Rode a migração 0113_rh_pdi_reviews.sql." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
