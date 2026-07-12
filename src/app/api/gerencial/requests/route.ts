import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { REQUEST_STATUS, type RequestStatus } from "@/lib/data/requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = new Set(REQUEST_STATUS.map((s) => s.key));

/** Atualiza o status de uma solicitação do portal (reunião/conteúdo). Gerencial. */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  let b: { kind?: "meeting" | "content"; id?: string; status?: RequestStatus };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if ((b.kind !== "meeting" && b.kind !== "content") || !b.id || !b.status || !STATUSES.has(b.status)) {
    return NextResponse.json({ error: "parâmetros inválidos" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });

  const table = b.kind === "meeting" ? "meeting_requests" : "content_requests";
  const supabase = await createClient();
  const { error } = await supabase.from(table).update({ status: b.status }).eq("id", b.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: true });
}
