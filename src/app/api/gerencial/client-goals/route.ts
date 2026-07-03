import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getClientGoals } from "@/lib/data/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET metas de um cliente numa competência. */
export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const clientId = req.nextUrl.searchParams.get("clientId");
  const period = req.nextUrl.searchParams.get("period");
  if (!clientId || !period) {
    return NextResponse.json({ error: "clientId/period ausente" }, { status: 400 });
  }
  const goals = await getClientGoals(clientId, period);
  return NextResponse.json({ goals });
}

/** POST upsert de metas (uma competência de um cliente). */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  let b: {
    clientId?: string;
    period?: string;
    goals?: { metric: string; targetValue: number }[];
  };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!b.clientId || !b.period || !Array.isArray(b.goals)) {
    return NextResponse.json({ error: "payload inválido" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, persisted: false });
  }

  const supabase = await createClient();
  const now = new Date().toISOString();

  // Metas com valor > 0 são gravadas; valor 0/vazio remove a meta.
  const toUpsert = b.goals
    .filter((g) => Number(g.targetValue) > 0)
    .map((g) => ({
      client_id: b.clientId,
      metric: g.metric,
      target_value: Number(g.targetValue),
      period: b.period,
      updated_at: now,
    }));
  const toDelete = b.goals
    .filter((g) => !(Number(g.targetValue) > 0))
    .map((g) => g.metric);

  if (toUpsert.length) {
    const { error } = await supabase
      .from("client_goals")
      .upsert(toUpsert, { onConflict: "client_id,metric,period" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (toDelete.length) {
    await supabase
      .from("client_goals")
      .delete()
      .eq("client_id", b.clientId)
      .eq("period", b.period)
      .in("metric", toDelete);
  }

  return NextResponse.json({ ok: true, persisted: true });
}
