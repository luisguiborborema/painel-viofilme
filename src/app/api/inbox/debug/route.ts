import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Diagnóstico do webhook do WhatsApp: mostra as últimas chamadas recebidas
 * (payload cru + nota). Abra em /api/inbox/debug logado como gerencial.
 */
export async function GET() {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "supabase não configurado" }, { status: 503 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wa_webhook_log")
    .select("raw,note,received_at")
    .order("received_at", { ascending: false })
    .limit(20);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(
    { count: data?.length ?? 0, events: data ?? [] },
    { headers: { "Content-Type": "application/json; charset=utf-8" } },
  );
}
