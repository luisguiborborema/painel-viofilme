import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { DIAGNOSTIC_DEFAULTS, parseDiagnosticQuestions, toDiagnosticConfig } from "@/lib/data/diagnostic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSession();
  if (!user || user.role !== "gerencial") return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  if (!isSupabaseConfigured()) return NextResponse.json({ config: { questions: DIAGNOSTIC_DEFAULTS } });
  const supabase = await createClient();
  const { data } = await supabase.from("diagnostic_config").select("questions").eq("id", 1).maybeSingle();
  return NextResponse.json({ config: toDiagnosticConfig(data) });
}

export async function POST(req: Request) {
  const user = await getSession();
  if (user?.readOnly) return NextResponse.json({ error: "acesso somente leitura" }, { status: 403 });
  if (!user || user.role !== "gerencial") return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  let b: { questions?: unknown };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });
  const supabase = await createClient();
  const { error } = await supabase.from("diagnostic_config").upsert({
    id: 1,
    questions: parseDiagnosticQuestions(b.questions),
    updated_at: new Date().toISOString(),
  });
  if (error) {
    if (/diagnostic_config.* does not exist|42P01/i.test(error.message)) {
      return NextResponse.json({ error: "Tabela ainda não existe. Rode a migração 0122_diagnostics.sql." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
