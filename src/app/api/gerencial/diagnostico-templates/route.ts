import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { parseComputed, parseDiagnosticQuestions, toTemplate } from "@/lib/data/diagnostic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AREAS = new Set(["comercial", "entregas", "outro"]);
const TPL_COLS = "id, name, area, questions, computed, position";

export async function GET() {
  const user = await getSession();
  if (!user || user.role !== "gerencial") return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  if (!isSupabaseConfigured()) return NextResponse.json({ templates: [] });
  const supabase = await createClient();
  const { data } = await supabase.from("diagnostic_templates").select(TPL_COLS).order("position").order("created_at");
  return NextResponse.json({ templates: (data ?? []).map((r) => toTemplate(r as Record<string, unknown>)).filter(Boolean) });
}

type Body = {
  action?: "create" | "update" | "delete";
  id?: string;
  name?: string;
  area?: string;
  questions?: unknown;
  computed?: unknown;
  position?: number;
};

export async function POST(req: Request) {
  const user = await getSession();
  if (user?.readOnly) return NextResponse.json({ error: "acesso somente leitura" }, { status: 403 });
  if (!user || user.role !== "gerencial") return NextResponse.json({ error: "não autorizado" }, { status: 401 });
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
      const { error } = await supabase.from("diagnostic_templates").delete().eq("id", b.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    const fields = {
      name: b.name?.trim() || "Diagnóstico",
      area: AREAS.has(String(b.area)) ? b.area : "comercial",
      questions: parseDiagnosticQuestions(b.questions),
      computed: parseComputed(b.computed),
      position: Number.isFinite(Number(b.position)) ? Math.round(Number(b.position)) : 0,
      updated_at: new Date().toISOString(),
    };
    if (b.action === "update") {
      if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
      const { error } = await supabase.from("diagnostic_templates").update(fields).eq("id", b.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    const { data, error } = await supabase.from("diagnostic_templates").insert(fields).select("id").single();
    if (error) throw error;
    return NextResponse.json({ ok: true, id: data.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    if (/diagnostic_templates.* does not exist|42P01/i.test(msg)) {
      return NextResponse.json({ error: "Tabela ainda não existe. Rode a migração 0123_diagnostic_templates.sql." }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
