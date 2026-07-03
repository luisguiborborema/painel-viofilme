import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  slug?: string;
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
  message?: string;
  website?: string; // honeypot — deve vir vazio
};

/**
 * Endpoint PÚBLICO de captura de leads (usado pelos formulários /captura/<slug>).
 * Sem sessão: usa service-role e valida o slug do formulário. Honeypot simples
 * contra bots. Cria empresa + contato + negócio no CRM.
 */
export async function POST(req: Request) {
  let b: Body;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // Honeypot: bots preenchem campos ocultos → finge sucesso e ignora.
  if (b.website && b.website.trim()) return NextResponse.json({ ok: true });

  if (!b.slug || !b.name?.trim()) {
    return NextResponse.json({ error: "dados obrigatórios ausentes" }, { status: 400 });
  }
  if (!isSupabaseConfigured() || !hasServiceRole()) {
    // Sem backend: aceita (demo) sem persistir.
    return NextResponse.json({ ok: true, persisted: false });
  }

  const admin = createAdminClient();

  const { data: form } = await admin
    .from("crm_capture_forms")
    .select("owner, source, active")
    .eq("slug", b.slug)
    .maybeSingle();
  if (!form || !form.active) {
    return NextResponse.json({ error: "formulário indisponível" }, { status: 404 });
  }

  const owner = (form.owner as string | null) ?? null;
  const source = (form.source as string | null) ?? "Formulário";
  const companyName = b.company?.trim() || b.name.trim();

  // Empresa (reaproveita por nome).
  let companyId: string;
  const { data: existing } = await admin
    .from("crm_companies")
    .select("id")
    .ilike("name", companyName)
    .maybeSingle();
  if (existing) {
    companyId = existing.id as string;
  } else {
    const { data: co, error } = await admin
      .from("crm_companies")
      .insert({
        name: companyName,
        phone: b.phone?.replace(/\D/g, "") || null,
        email: b.email?.trim() || null,
        owner,
      })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: "falha ao criar" }, { status: 500 });
    companyId = co.id as string;
  }

  // Contato.
  const { data: contact } = await admin
    .from("crm_contacts")
    .insert({
      company_id: companyId,
      name: b.name.trim(),
      phone: b.phone?.replace(/\D/g, "") || null,
      email: b.email?.trim() || null,
      is_primary: true,
      owner,
    })
    .select("id")
    .single();
  const contactId = contact?.id as string | undefined;

  // Estágio inicial (primeiro aberto do pipeline default).
  const { data: pipe } = await admin
    .from("crm_pipelines").select("id").eq("is_default", true).limit(1).maybeSingle();
  const { data: stages } = await admin
    .from("crm_stages")
    .select("id,key,position,kind")
    .eq("pipeline_id", pipe?.id ?? "")
    .order("position", { ascending: true });
  const firstOpen = (stages ?? []).find((s) => s.kind === "open");

  const { data: deal, error: dErr } = await admin
    .from("crm_leads")
    .insert({
      name: `${companyName} — ${source}`,
      company_id: companyId,
      primary_contact_id: contactId ?? null,
      pipeline_id: pipe?.id ?? null,
      stage_id: firstOpen?.id ?? null,
      stage: firstOpen?.key ?? "prospeccao",
      source,
      owner,
      stage_changed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (dErr) return NextResponse.json({ error: "falha ao criar" }, { status: 500 });

  if (contactId) {
    await admin
      .from("crm_deal_contacts")
      .insert({ deal_id: deal.id, contact_id: contactId, is_primary: true });
  }
  // Mensagem do formulário na timeline.
  if (b.message?.trim()) {
    await admin.from("crm_interactions").insert({
      lead_id: deal.id,
      channel: "system",
      body: `📨 Lead via formulário "${source}":\n${b.message.trim()}`,
    });
  }

  return NextResponse.json({ ok: true, persisted: true });
}
