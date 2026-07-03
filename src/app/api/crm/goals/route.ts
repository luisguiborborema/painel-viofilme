import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { hasFullAccess } from "@/lib/access";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { owner?: string; month?: string; target?: number };

/** Define (upsert) a meta de um vendedor num mês. Só Gestor (acesso total). */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial" || !hasFullAccess(user.allowedSections)) {
    return NextResponse.json({ error: "não autorizado" }, { status: 403 });
  }

  let b: Body;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!b.owner || !b.month) {
    return NextResponse.json({ error: "owner/month ausente" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, persisted: false });
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_goals")
    .upsert(
      { owner: b.owner, month: b.month, target: b.target ?? 0, updated_at: new Date().toISOString() },
      { onConflict: "owner,month" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: true });
}
