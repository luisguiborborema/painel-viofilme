import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getAssignmentConfig } from "@/lib/data/queries";
import { toAssignmentConfig } from "@/lib/data/crm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lê a config de atribuição automática. */
export async function GET() {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  return NextResponse.json({ config: await getAssignmentConfig() });
}

/** Salva a config de atribuição automática (upsert crm_settings). */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const config = toAssignmentConfig((body as { config?: unknown })?.config ?? body);

  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false, config });
  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_settings")
    .upsert({ key: "assignment", value: config, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: true, config });
}
