import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { normalizarCadencia } from "@/lib/data/catalogo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const clean = (v?: string) => (v && v.trim() ? v.trim() : null);
const TYPES = new Set(["recorrente", "pontual"]);
const COBRANCAS = new Set(["fixo", "midia_a_parte"]);

/** Colunas da migração 0144. Antes dela, escrever aqui derruba a operação inteira. */
const RICOS_SERVICO = ["summary", "description", "properties"] as const;
const RICOS_PLANO = ["cadence", "cost", "billing_type", "deliverables", "notes", "active"] as const;

/**
 * O PostgREST reclama de coluna nova de duas formas: `42703` vem do Postgres
 * quando a consulta chega ao banco, e `PGRST204` vem antes disso, do cache de
 * schema do próprio PostgREST. Tratar só a primeira deixava a escrita falhar
 * com 500 cru — foi o que aconteceu no teste ao vivo.
 */
const semMigracao = (e: unknown) => {
  const c = (e as { code?: string })?.code;
  const m = mensagem(e);
  return c === "42703" || c === "PGRST204" || /does not exist|schema cache|could not find/i.test(m);
};

/** Erro do Supabase não é `Error`; sem isto a mensagem vira um "erro" inútil. */
const mensagem = (e: unknown) =>
  e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e ?? "");

/**
 * Grava tolerando a 0144 ainda não ter rodado: se o banco recusa as colunas
 * novas, repete só com as antigas. O cadastro continua funcionando; o que se
 * perde é a ficha rica, não a operação.
 */
async function gravarTolerante<T>(
  tentar: (linha: Record<string, unknown>) => Promise<T>,
  linha: Record<string, unknown>,
  novas: readonly string[],
): Promise<T> {
  try {
    return await tentar(linha);
  } catch (e) {
    if (!semMigracao(e) || !novas.some((k) => k in linha)) throw e;
    const enxuta = { ...linha };
    for (const k of novas) delete enxuta[k];
    return await tentar(enxuta);
  }
}

/** Entregáveis: [{label, qty}]. Lista livre vinda do cliente precisa de limite. */
function entregaveis(v: unknown): { label: string; qty: number }[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => {
      const o = (x ?? {}) as Record<string, unknown>;
      const label = String(o.label ?? "").trim().slice(0, 120);
      const qty = Math.max(1, Math.min(999, Math.round(Number(o.qty) || 1)));
      return { label, qty };
    })
    .filter((x) => x.label)
    .slice(0, 40);
}

/** Catálogo funcional (services + service_plans) — dropdowns de criação de cliente. */
export async function GET() {
  const user = await getSession();
  if (!user || user.role !== "gerencial") return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  if (!isSupabaseConfigured()) return NextResponse.json({ services: [] });
  const supabase = await createClient();
  // Tenta com a ficha rica; sem a 0144, cai no conjunto básico.
  async function ler(tabela: string, base: string, ricas: string): Promise<Record<string, unknown>[]> {
    const q = () => supabase.from(tabela).select(ricas ? `${base}, ${ricas}` : base).order("sort").order("label");
    const comRicas = await q();
    if (!comRicas.error) return (comRicas.data ?? []) as unknown as Record<string, unknown>[];
    const basico = await supabase.from(tabela).select(base).order("sort").order("label");
    return (basico.data ?? []) as unknown as Record<string, unknown>[];
  }
  const [linhasSvc, linhasPlano] = await Promise.all([
    ler("services", "id, label, type, area, sort, active", "summary, description"),
    ler("service_plans", "id, service_id, label, default_price, sort", "cadence, cost, billing_type, deliverables, notes, active"),
  ]);
  type LinhaPlano = Record<string, unknown> & { id: string; service_id: string; label: string };
  const plansBySvc = new Map<string, Record<string, unknown>[]>();
  for (const p of linhasPlano as LinhaPlano[]) {
    if (!plansBySvc.has(p.service_id)) plansBySvc.set(p.service_id, []);
    plansBySvc.get(p.service_id)!.push({
      id: p.id,
      label: p.label,
      defaultPrice: Number(p.default_price ?? 0),
      cost: Number(p.cost ?? 0),
      cadence: normalizarCadencia(p.cadence),
      billingType: String(p.billing_type ?? "fixo"),
      deliverables: entregaveis(p.deliverables),
      notes: p.notes ? String(p.notes) : null,
      active: p.active === undefined ? true : Boolean(p.active),
    });
  }
  type LinhaSvc = Record<string, unknown> & { id: string; label: string; type: string; area: string; active: boolean };
  const services = (linhasSvc as LinhaSvc[]).map((s) => ({
    id: s.id,
    label: s.label,
    type: s.type,
    area: s.area,
    active: s.active,
    summary: s.summary ? String(s.summary) : null,
    description: s.description ? String(s.description) : null,
    plans: plansBySvc.get(s.id) ?? [],
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
  summary?: string;
  description?: string;
  cost?: number;
  cadence?: string;
  billingType?: string;
  deliverables?: unknown;
  notes?: string;
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
        const linha: Record<string, unknown> = {
          label: clean(b.label),
          type: TYPES.has(String(b.type)) ? b.type : "recorrente",
          area: clean(b.area) ?? "Social",
          active: true,
        };
        if (b.summary !== undefined) linha.summary = clean(b.summary);
        if (b.description !== undefined) linha.description = clean(b.description);
        const id = await gravarTolerante(
          async (l) => {
            const { data, error } = await supabase.from("services").insert(l).select("id").single();
            if (error) throw error;
            return data.id as string;
          },
          linha,
          RICOS_SERVICO,
        );
        return NextResponse.json({ ok: true, id });
      }
      case "update-service": {
        if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
        const patch: Record<string, unknown> = {};
        if (b.label !== undefined) patch.label = clean(b.label);
        if (b.type !== undefined && TYPES.has(String(b.type))) patch.type = b.type;
        if (b.area !== undefined) patch.area = clean(b.area);
        if (b.active !== undefined) patch.active = Boolean(b.active);
        if (b.summary !== undefined) patch.summary = clean(b.summary);
        if (b.description !== undefined) patch.description = clean(b.description);
        await gravarTolerante(
          async (l) => {
            const { error } = await supabase.from("services").update(l).eq("id", b.id!);
            if (error) throw error;
          },
          patch,
          RICOS_SERVICO,
        );
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
        const linha: Record<string, unknown> = {
          service_id: b.serviceId,
          label: clean(b.label),
          default_price: num(b.defaultPrice),
        };
        if (b.cost !== undefined) linha.cost = num(b.cost);
        if (b.cadence !== undefined) linha.cadence = normalizarCadencia(b.cadence);
        if (b.billingType !== undefined) linha.billing_type = COBRANCAS.has(String(b.billingType)) ? b.billingType : "fixo";
        if (b.deliverables !== undefined) linha.deliverables = entregaveis(b.deliverables);
        if (b.notes !== undefined) linha.notes = clean(b.notes);
        const id = await gravarTolerante(
          async (l) => {
            const { data, error } = await supabase.from("service_plans").insert(l).select("id").single();
            if (error) throw error;
            return data.id as string;
          },
          linha,
          RICOS_PLANO,
        );
        return NextResponse.json({ ok: true, id });
      }
      case "update-plan": {
        if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
        const patch: Record<string, unknown> = {};
        if (b.label !== undefined) patch.label = clean(b.label);
        if (b.defaultPrice !== undefined) patch.default_price = num(b.defaultPrice);
        if (b.cost !== undefined) patch.cost = num(b.cost);
        if (b.cadence !== undefined) patch.cadence = normalizarCadencia(b.cadence);
        if (b.billingType !== undefined) patch.billing_type = COBRANCAS.has(String(b.billingType)) ? b.billingType : "fixo";
        if (b.deliverables !== undefined) patch.deliverables = entregaveis(b.deliverables);
        if (b.notes !== undefined) patch.notes = clean(b.notes);
        if (b.active !== undefined) patch.active = Boolean(b.active);
        await gravarTolerante(
          async (l) => {
            const { error } = await supabase.from("service_plans").update(l).eq("id", b.id!);
            if (error) throw error;
          },
          patch,
          RICOS_PLANO,
        );
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
    const msg = mensagem(e) || "erro";
    if (/duplicate key|unique/i.test(msg)) return NextResponse.json({ error: "Já existe um item com esse nome." }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
