import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Rule = { id?: string; label?: string; field?: string; op?: string; value?: string; points?: number };

/** Salva as regras de lead scoring (upsert em crm_settings, key = lead_score). */
export async function POST(req: Request) {
  const user = await getSession();
  if (user?.readOnly) return NextResponse.json({ error: "acesso somente leitura" }, { status: 403 });
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  let body: { rules?: Rule[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });

  const rules = (body.rules ?? [])
    .filter((r) => r && r.field)
    .map((r) => ({
      id: String(r.id ?? Math.random().toString(36).slice(2)),
      label: String(r.label ?? ""),
      field: String(r.field),
      op: String(r.op ?? "eq"),
      value: String(r.value ?? ""),
      points: Number(r.points ?? 0),
    }));

  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_settings")
    .upsert({ key: "lead_score", value: { rules }, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: true });
}
