import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const clean = (v?: string) => (v && v.trim() ? v.trim() : null);
const TYPES = new Set(["recorrente", "pontual"]);

/** Catálogo funcional (services + service_plans) — dropdowns de criação de cliente. */
export async function GET() {
  const user = await getSession();
  if (!user || user.role !== "gerencial") return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  if (!isSupabaseConfigured()) return NextResponse.json({ services: [] });
  const supabase = await createClient();
  const [svcRes, planRes] = await Promise.all([
    supabase.from("services").select("id, label, type, area, sort, active").order("sort").order("label"),
    supabase.from("service_plans").select("id, service_id, label, default_price, sort").order("sort").order("label"),
  ]);
  const plansBySvc = new Map<string, { id: string; label: string; defaultPrice: number }[]>();
  for (const p of (planRes.data ?? []) as { id: string; service_id: string; label: string; default_price: number }[]) {
    if (!plansBySvc.has(p.service_id)) plansBySvc.set(p.service_id, []);
    plansBySvc.get(p.service_id)!.push({ id: p.id, label: p.label, defaultPrice: Number(p.default_price ?? 0) });
  }
  const services = ((svcRes.data ?? []) as { id: string; label: string; type: string; area: string; active: boolean }[]).map((s) => ({
    id: s.id, label: s.label, type: s.type, area: s.area, active: s.active, plans: plansBySvc.get(s.id) ?? [],
  }));
  return NextResponse.json({ services });
}

type Body = {
  action?: "add-service" | "update-service" | "delete-service" | "add-plan" | "update-plan" | "delete-plan";
  id?: string;
  serviceId?: string;
  label?: string;
  type?: string;
  area?: string;
  active?: boolean;
  defaultPrice?: number;
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
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });
  const supabase = await createClient();

  try {
    switch (b.action) {
      case "add-service": {
        if (!clean(b.label)) return NextResponse.json({ error: "Informe o nome do serviço." }, { status: 400 });
        const { data, error } = await supabase
          .from("services")
          .insert({ label: clean(b.label), type: TYPES.has(String(b.type)) ? b.type : "recorrente", area: clean(b.area) ?? "Social", active: true })
          .select("id")
          .single();
        if (error) throw error;
        return NextResponse.json({ ok: true, id: data.id });
      }
      case "update-service": {
        if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
        const patch: Record<string, unknown> = {};
        if (b.label !== undefined) patch.label = clean(b.label);
        if (b.type !== undefined && TYPES.has(String(b.type))) patch.type = b.type;
        if (b.area !== undefined) patch.area = clean(b.area);
        if (b.active !== undefined) patch.active = Boolean(b.active);
        const { error } = await supabase.from("services").update(patch).eq("id", b.id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }
      case "delete-service": {
        if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
        const { error } = await supabase.from("services").delete().eq("id", b.id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }
      case "add-plan": {
        if (!b.serviceId || !clean(b.label)) return NextResponse.json({ error: "Informe serviço e nome do plano." }, { status: 400 });
        const { data, error } = await supabase
          .from("service_plans")
          .insert({ service_id: b.serviceId, label: clean(b.label), default_price: num(b.defaultPrice) })
          .select("id")
          .single();
        if (error) throw error;
        return NextResponse.json({ ok: true, id: data.id });
      }
      case "update-plan": {
        if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
        const patch: Record<string, unknown> = {};
        if (b.label !== undefined) patch.label = clean(b.label);
        if (b.defaultPrice !== undefined) patch.default_price = num(b.defaultPrice);
        const { error } = await supabase.from("service_plans").update(patch).eq("id", b.id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }
      case "delete-plan": {
        if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
        const { error } = await supabase.from("service_plans").delete().eq("id", b.id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: "ação inválida" }, { status: 400 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    if (/duplicate key|unique/i.test(msg)) return NextResponse.json({ error: "Já existe um item com esse nome." }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
