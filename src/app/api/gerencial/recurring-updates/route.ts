import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getRecurringUpdates } from "@/lib/data/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET updates recorrentes (opcionalmente de um cliente). */
export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const clientId = req.nextUrl.searchParams.get("clientId") || undefined;
  const updates = await getRecurringUpdates(clientId);
  return NextResponse.json({ updates });
}

type Body = {
  action?: "create" | "update" | "toggle" | "delete";
  id?: string;
  clientId?: string;
  metrics?: string[];
  recurrence?: string;
  status?: "active" | "paused";
};

/** Cria / edita / pausa / remove um update recorrente. */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  let b: Body;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const action = b.action ?? (b.id ? "update" : "create");

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, persisted: false });
  }
  const supabase = await createClient();
  const now = new Date().toISOString();

  if (action === "delete") {
    if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    await supabase.from("recurring_updates").delete().eq("id", b.id);
    return NextResponse.json({ ok: true, persisted: true });
  }

  if (action === "toggle") {
    if (!b.id || !b.status) return NextResponse.json({ error: "id/status ausente" }, { status: 400 });
    const { error } = await supabase
      .from("recurring_updates")
      .update({ status: b.status, updated_at: now })
      .eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  if (!Array.isArray(b.metrics) || b.metrics.length === 0 || !b.recurrence) {
    return NextResponse.json({ error: "métricas/recorrência ausentes" }, { status: 400 });
  }

  if (action === "create") {
    if (!b.clientId) return NextResponse.json({ error: "clientId ausente" }, { status: 400 });
    const { data, error } = await supabase
      .from("recurring_updates")
      .insert({
        client_id: b.clientId,
        metrics: b.metrics,
        recurrence: b.recurrence,
        channel: "whatsapp",
        recipient: "client",
        status: "active",
        created_by: user.name,
      })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true, id: data.id });
  }

  // update
  if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
  const { error } = await supabase
    .from("recurring_updates")
    .update({ metrics: b.metrics, recurrence: b.recurrence, updated_at: now })
    .eq("id", b.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: true });
}
