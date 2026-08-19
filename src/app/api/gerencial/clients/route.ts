import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { tierHasFullAccess } from "@/lib/access";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { provisionClientDrive } from "@/lib/google/drive-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Apaga um cliente (cascata nas tabelas ligadas). Só Gestor/Admin. */
export async function DELETE(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  if (!tierHasFullAccess(user.tier)) return NextResponse.json({ error: "Apenas Gestor ou Admin podem apagar clientes." }, { status: 403 });
  let id: string | undefined;
  try {
    id = (await req.json())?.id;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });
  const supabase = await createClient();
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

const CLIENT_TYPES = new Set(["lead_gen", "ecommerce", "local_business"]);
const clean = (v: string | undefined | null) => (v && v.trim() ? v.trim() : null);
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Catálogo para o modal Novo Cliente: serviços+planos, squads e pessoas. */
export async function GET() {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ services: [], squads: [], people: [] });
  }
  const supabase = await createClient();
  const [svcRes, planRes, squadRes, peopleRes] = await Promise.all([
    supabase.from("services").select("id, label, type, area, sort").eq("active", true).order("sort"),
    supabase.from("service_plans").select("id, service_id, label, default_price, sort").order("sort"),
    supabase.from("squads").select("id, name, area").order("name"),
    supabase.from("profiles").select("id, full_name, squad_id, can_be_po").eq("role", "gerencial").order("full_name"),
  ]);

  const plansBySvc = new Map<string, { id: string; label: string; defaultPrice: number }[]>();
  for (const p of (planRes.data ?? []) as { id: string; service_id: string; label: string; default_price: number }[]) {
    if (!plansBySvc.has(p.service_id)) plansBySvc.set(p.service_id, []);
    plansBySvc.get(p.service_id)!.push({ id: p.id, label: p.label, defaultPrice: Number(p.default_price ?? 0) });
  }
  const services = ((svcRes.data ?? []) as { id: string; label: string; type: string; area: string }[]).map((s) => ({
    id: s.id, label: s.label, type: s.type, area: s.area, plans: plansBySvc.get(s.id) ?? [],
  }));
  const squads = ((squadRes.data ?? []) as { id: string; name: string; area: string | null }[]).map((s) => ({
    id: s.id, name: s.name, area: s.area ?? "—",
  }));
  const people = ((peopleRes.data ?? []) as { id: string; full_name: string | null; squad_id: string | null; can_be_po: boolean | null }[]).map((p) => ({
    id: p.id, name: p.full_name ?? "—", squadId: p.squad_id ?? null, canBePo: !!p.can_be_po,
  }));

  return NextResponse.json({ services, squads, people });
}

type ServiceLine = {
  serviceId?: string;
  planId?: string;
  serviceLabel?: string; // nome do serviço digitado na hora
  planLabel?: string;    // plano/formato digitado na hora
  baseValue?: number;
  discount?: number;
  squadId?: string;
  analystId?: string;
  executorId?: string;
  poId?: string;
};
type Contact = { name?: string; role?: string; whatsapp?: string; email?: string; isPrimary?: boolean };

type Body = {
  name?: string;
  city?: string;
  clientType?: string;
  segment?: string;
  activeNetworks?: string[];
  kickoffDate?: string;
  csMainId?: string;
  csSupportId?: string;
  recurring?: ServiceLine[];
  pontual?: ServiceLine[];
  contacts?: Contact[];
  // Equipe/operação definidas já na criação (opcional).
  responsibles?: { social?: string; performance?: string; designer?: string; copy?: string; desenvolvedor?: string };
  servicesList?: string[];
  deliverables?: Record<string, number>;
  // compat com o modal antigo
  monthlyFee?: number;
  whatsapp?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
};

/** Cadastro de novo cliente (gerencial) — cadeia de alocação por serviço. */
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

  const name = (b.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "nome é obrigatório" }, { status: 400 });
  const clientType = b.clientType && CLIENT_TYPES.has(b.clientType) ? b.clientType : "local_business";

  const hasLine = (l: ServiceLine) => Boolean(l.serviceId || (l.serviceLabel ?? "").trim());
  const recurring = (b.recurring ?? []).filter(hasLine);
  const pontual = (b.pontual ?? []).filter(hasLine);

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, persisted: false, id: "demo" });
  }
  const supabase = await createClient();

  // Áreas dos serviços (para derivar has_paid_traffic) — por id e por nome.
  const areaBySvc = new Map<string, string>();
  const areaByName = new Map<string, string>();
  {
    const { data: svcs } = await supabase.from("services").select("id, label, area");
    for (const s of (svcs ?? []) as { id: string; label: string; area: string }[]) {
      areaBySvc.set(s.id, s.area);
      if (s.label) areaByName.set(s.label.toLowerCase(), s.area);
    }
  }
  const areaOf = (l: ServiceLine) =>
    (l.serviceId && areaBySvc.get(l.serviceId)) || areaByName.get((l.serviceLabel ?? "").trim().toLowerCase()) || "";

  const lineFinal = (l: ServiceLine) => Math.max(0, num(l.baseValue) - num(l.discount));
  const feeMensal = recurring.reduce((a, l) => a + lineFinal(l), 0);
  const hasPaidTraffic = recurring.some((l) => areaOf(l) === "Performance");
  const firstSquad = recurring.find((l) => l.squadId)?.squadId ?? null;

  // slug único.
  const base = slugify(name) || "cliente";
  let slug = base;
  const { data: existing } = await supabase.from("clients").select("slug").like("slug", `${base}%`);
  const taken = new Set((existing ?? []).map((r) => (r as { slug: string | null }).slug));
  if (taken.has(slug)) { let i = 2; while (taken.has(`${base}-${i}`)) i += 1; slug = `${base}-${i}`; }

  const networks = Array.isArray(b.activeNetworks) && b.activeNetworks.length ? b.activeNetworks : ["instagram", "facebook"];
  const primaryContact = (b.contacts ?? []).find((c) => c.isPrimary && c.name?.trim()) ?? (b.contacts ?? []).find((c) => c.name?.trim());

  // Equipe responsável por função (nomes) e serviços (tags) definidos na criação.
  const rIn = b.responsibles ?? {};
  const responsibles = {
    social: clean(rIn.social) ?? "",
    performance: clean(rIn.performance) ?? "",
    designer: clean(rIn.designer) ?? "",
    copy: clean(rIn.copy) ?? "",
    desenvolvedor: clean(rIn.desenvolvedor) ?? "",
  };
  const hasResp = Object.values(responsibles).some((v) => v);
  const servicesList = Array.isArray(b.servicesList)
    ? [...new Set(b.servicesList.map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean))].slice(0, 12)
    : [];

  const { data: client, error } = await supabase
    .from("clients")
    .insert({
      name,
      slug,
      segment: clean(b.segment),
      status: "onboarding",
      monthly_fee: feeMensal > 0 ? feeMensal : null,
      client_type: clientType,
      contract_model: recurring.length ? "recorrente" : "pontual",
      has_paid_traffic: hasPaidTraffic,
      whatsapp: (primaryContact?.whatsapp ?? b.whatsapp)?.replace(/\D/g, "") || null,
      city: clean(b.city),
      squad_id: firstSquad,
      active_networks: networks,
      kickoff_date: clean(b.kickoffDate),
      cs_main_id: clean(b.csMainId),
      cs_support_id: clean(b.csSupportId),
      contact_name: clean(primaryContact?.name ?? b.contactName),
      contact_phone: clean(primaryContact?.whatsapp ?? b.contactPhone),
      contact_email: clean(primaryContact?.email ?? b.contactEmail),
      responsibles: hasResp ? responsibles : null,
      services_list: servicesList.length ? servicesList : null,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const clientId = client.id as string;

  // Entregáveis do mês por formato (opcional).
  const DEL_FORMATS = ["Reels", "Feed", "Stories", "Carrossel"];
  const delRows = DEL_FORMATS
    .map((f) => ({ format: f, qty: Math.max(0, Math.round(Number((b.deliverables ?? {})[f] ?? 0))) }))
    .filter((x) => x.qty > 0)
    .map((x) => ({ client_id: clientId, format: x.format, monthly_qty: x.qty }));
  if (delRows.length) await supabase.from("client_deliverables").insert(delRows);

  // Linhas de serviço.
  const serviceRows = [
    ...recurring.map((l) => ({
      client_id: clientId, service_id: clean(l.serviceId), plan_id: clean(l.planId),
      service_label: clean(l.serviceLabel), plan_label: clean(l.planLabel), type: "recorrente",
      base_value: num(l.baseValue), discount: num(l.discount), final_value: lineFinal(l),
      squad_id: clean(l.squadId), analyst_id: clean(l.analystId), executor_id: null, po_id: null,
    })),
    ...pontual.map((l) => ({
      client_id: clientId, service_id: clean(l.serviceId), plan_id: clean(l.planId),
      service_label: clean(l.serviceLabel), plan_label: clean(l.planLabel), type: "pontual",
      base_value: num(l.baseValue), discount: num(l.discount), final_value: lineFinal(l),
      squad_id: null, analyst_id: null, executor_id: clean(l.executorId), po_id: clean(l.poId),
    })),
  ];
  if (serviceRows.length) {
    const { error: svcErr } = await supabase.from("client_services").insert(serviceRows);
    if (svcErr) return NextResponse.json({ error: svcErr.message, id: clientId }, { status: 500 });
  }

  // Contatos.
  const contactRows = (b.contacts ?? [])
    .filter((c) => c.name?.trim())
    .map((c, i) => ({
      client_id: clientId, name: c.name!.trim(), role: clean(c.role),
      whatsapp: clean(c.whatsapp), email: clean(c.email), is_primary: !!c.isPrimary, sort: i,
    }));
  if (contactRows.length && !contactRows.some((c) => c.is_primary)) contactRows[0].is_primary = true;
  if (contactRows.length) await supabase.from("client_contacts").insert(contactRows);

  // Cria a pasta do cliente no Google Drive (raiz + subpastas 00–04) e grava o
  // link em drive_folder_url. Best-effort: não bloqueia a criação do cliente.
  const driveUrl = await provisionClientDrive(clientId);

  return NextResponse.json({ ok: true, persisted: true, id: clientId, driveUrl });
}
