import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type R = { id?: string; name?: string; groupBy?: string; metric?: string; status?: string; chart?: string; dashboardId?: string | null };
type D = { id?: string; name?: string };

/** Salva os relatórios + dashboards customizados (upsert crm_settings, key = reports). */
export async function POST(req: Request) {
  const user = await getSession();
  if (user?.readOnly) return NextResponse.json({ error: "acesso somente leitura" }, { status: 403 });
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  let body: { reports?: R[]; dashboards?: D[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });

  const reports = (body.reports ?? [])
    .filter((r) => r && r.name)
    .map((r) => ({
      id: String(r.id ?? Math.random().toString(36).slice(2)),
      name: String(r.name),
      groupBy: String(r.groupBy ?? "owner"),
      metric: String(r.metric ?? "count"),
      status: String(r.status ?? "abertos"),
      chart: String(r.chart ?? "bar"),
      dashboardId: r.dashboardId ?? null,
    }));
  const dashboards = (body.dashboards ?? [])
    .filter((d) => d && d.name)
    .map((d) => ({ id: String(d.id ?? Math.random().toString(36).slice(2)), name: String(d.name) }));

  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_settings")
    .upsert({ key: "reports", value: { reports, dashboards }, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: true });
}
