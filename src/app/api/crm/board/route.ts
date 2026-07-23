import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { hasFullAccess } from "@/lib/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Edita o mural do time (recado). Apenas liderança (gestor / acesso total). */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const isLeader = user.commercialRole === "gestor" || hasFullAccess(user.allowedSections ?? null);
  if (!isLeader) {
    return NextResponse.json({ error: "somente a liderança edita o mural" }, { status: 403 });
  }

  let body: { message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const message = (body.message ?? "").trim().slice(0, 500);

  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });
  const supabase = await createClient();
  const { error } = await supabase
    .from("commercial_board")
    .upsert({ id: 1, message, author: user.name, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: true });
}
