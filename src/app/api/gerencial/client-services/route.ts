import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LINE_COLS = "id, service_id, plan_id, type, base_value, discount, final_value, squad_id, analyst_id, executor_id, po_id";
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const clean = (v?: string | null) => (v && String(v).trim() ? String(v).trim() : null);

/** Recalcula mensalidade/contrato/tráfego a partir das linhas de serviço. */
async function recompute(supabase: Awaited<ReturnType<typeof createClient>>, clientId: string) {
  const { data: lines } = await supabase.from("client_services").select("service_id, type, final_value").eq("client_id", clientId);
  const rows = (lines ?? []) as { service_id: string; type: string; final_value: number }[];
  const recorrentes = rows.filter((l) => l.type === "recorrente");
  const monthly = recorrentes.reduce((a, l) => a + num(l.final_value), 0);

  let hasTraffic = false;
  const svcIds = [...new Set(recorrentes.map((l) => l.service_id).filter(Boolean))];
  if (svcIds.length) {
    const { data: svcs } = await supabase.from("services").select("id, area").in("id", svcIds);
    hasTraffic = (svcs ?? []).some((s) => (s as { area?: string }).area === "Performance");
  }
  await supabase
    .from("clients")
    .update({
      monthly_fee: monthly > 0 ? monthly : null,
      contract_model: recorrentes.length ? "recorrente" : rows.length ? "pontual" : "recorrente",
      has_paid_traffic: hasTraffic,
    })
    .eq("id", clientId);
}

export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  const clientId = request.nextUrl.searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "clientId ausente" }, { status: 400 });
  if (!isSupabaseConfigured()) return NextResponse.json({ lines: [] });
  const supabase = await createClient();
  const { data } = await supabase.from("client_services").select(LINE_COLS).eq("client_id", clientId).order("type").order("created_at");
  return NextResponse.json({ lines: data ?? [] });
}

type Body = {
  action?: "add" | "delete";
  id?: string;
  clientId?: string;
  type?: "recorrente" | "pontual";
  serviceId?: string;
  planId?: string;
  baseValue?: number;
  discount?: number;
  squadId?: string;
  analystId?: string;
  executorId?: string;
  poId?: string;
};

export async function POST(req: Request) {
  const user = await getSession();
  if (user?.readOnly) return NextResponse.json({ error: "acesso somente leitura" }, { status: 403 });
  if (!user || user.role !== "gerencial") return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  let b: Body;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!b.clientId) return NextResponse.json({ error: "clientId ausente" }, { status: 400 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });
  const supabase = await createClient();

  try {
    if (b.action === "delete") {
      if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
      const { error } = await supabase.from("client_services").delete().eq("id", b.id).eq("client_id", b.clientId);
      if (error) throw error;
      await recompute(supabase, b.clientId);
      return NextResponse.json({ ok: true });
    }

    // add
    if (!b.serviceId) return NextResponse.json({ error: "Selecione o serviço." }, { status: 400 });
    const type = b.type === "pontual" ? "pontual" : "recorrente";
    if (type === "recorrente" && !b.squadId) return NextResponse.json({ error: "Selecione o squad do serviço recorrente." }, { status: 400 });
    const finalValue = Math.max(0, num(b.baseValue) - num(b.discount));
    const row = {
      client_id: b.clientId,
      service_id: b.serviceId,
      plan_id: clean(b.planId),
      type,
      base_value: num(b.baseValue),
      discount: num(b.discount),
      final_value: finalValue,
      squad_id: type === "recorrente" ? clean(b.squadId) : null,
      analyst_id: type === "recorrente" ? clean(b.analystId) : null,
      executor_id: type === "pontual" ? clean(b.executorId) : null,
      po_id: type === "pontual" ? clean(b.poId) : null,
    };
    const { data, error } = await supabase.from("client_services").insert(row).select(LINE_COLS).single();
    if (error) throw error;
    await recompute(supabase, b.clientId);
    return NextResponse.json({ ok: true, line: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    if (/client_services.* does not exist|42P01/i.test(msg)) {
      return NextResponse.json({ error: "Tabela client_services não existe." }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
