import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { PIPELINE_PREVENDA_ID, STAGE_RESERVOIR } from "@/lib/data/crm";
import { resolveAssignee } from "@/lib/crm/assign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Prospecção outbound do SDR (tela "Novo negócio"): cria negócios crus no
 * RESERVATÓRIO da Pré-venda ("Contactar Urgente"), com empresa + (opcional)
 * contato. Serve tanto o cadastro individual (rows de 1) quanto a importação
 * em massa (planilha modelo / colar texto). Cada linha vira um card.
 */

type Row = {
  empresa?: string;
  titulo?: string;
  cnpj?: string;
  segmento?: string;
  source?: string;
  contato?: string;
  cargo?: string;
  whatsapp?: string;
  email?: string;
  site?: string;
  instagram?: string;
  cidade_uf?: string;
  tags?: string; // nomes (CSV) — casados com crm_tags
  tagIds?: string[]; // ids (cadastro manual)
  anotacao?: string;
};

const MAX_ROWS = 500;

export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  let body: { rows?: Row[]; owner?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const rows = (body.rows ?? []).filter((r) => r?.empresa?.trim()).slice(0, MAX_ROWS);
  if (rows.length === 0) {
    return NextResponse.json({ error: "Nenhuma empresa válida para importar." }, { status: 400 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, persisted: false, created: rows.length });
  }

  const supabase = await createClient();
  // Atribuição automática (config) quando o SDR não escolhe explicitamente.
  const owner = await resolveAssignee(supabase, {
    requested: body.owner,
    fallback: user.name,
    originKind: "outbound",
  });

  // Estágio-reservatório da Pré-venda.
  const { data: stage } = await supabase
    .from("crm_stages")
    .select("id")
    .eq("pipeline_id", PIPELINE_PREVENDA_ID)
    .eq("key", STAGE_RESERVOIR)
    .maybeSingle();
  const stageId = stage?.id ?? null;

  // Mapa de tags por nome (para casar a coluna "tags" do CSV).
  const { data: tagRows } = await supabase.from("crm_tags").select("id,name");
  const tagByName = new Map<string, string>(
    (tagRows ?? []).map((t) => [String(t.name).trim().toLowerCase(), String(t.id)]),
  );

  const digits = (s?: string) => (s ? s.replace(/\D/g, "") : "");
  let created = 0;
  let firstId: string | null = null;

  for (const r of rows) {
    const empresa = r.empresa!.trim();
    const props: Record<string, unknown> = {};
    if (r.cnpj?.trim()) props.cnpj = r.cnpj.trim();
    if (r.instagram?.trim()) props.instagram = r.instagram.trim();

    // 1) Empresa
    const { data: co, error: coErr } = await supabase
      .from("crm_companies")
      .insert({
        name: empresa,
        segment: r.segmento?.trim() || null,
        website: r.site?.trim() || null,
        city: r.cidade_uf?.trim() || null,
        owner,
        properties: Object.keys(props).length ? props : {},
      })
      .select("id")
      .single();
    if (coErr || !co) continue;
    const companyId = co.id as string;

    // 2) Contato (opcional)
    let contactId: string | null = null;
    if (r.contato?.trim()) {
      const { data: ct } = await supabase
        .from("crm_contacts")
        .insert({
          company_id: companyId,
          name: r.contato.trim(),
          title: r.cargo?.trim() || null,
          phone: digits(r.whatsapp) || null,
          email: r.email?.trim() || null,
          is_primary: true,
          owner,
        })
        .select("id")
        .single();
      contactId = (ct?.id as string) ?? null;
    }

    // 3) Negócio cru no reservatório
    const tagIds = [
      ...new Set([
        ...(r.tags ?? "").split(/[,;|]/).map((t) => tagByName.get(t.trim().toLowerCase())).filter((x): x is string => Boolean(x)),
        ...(r.tagIds ?? []),
      ]),
    ];

    const { data: deal, error: dealErr } = await supabase
      .from("crm_leads")
      .insert({
        name: r.titulo?.trim() || empresa,
        stage: STAGE_RESERVOIR,
        stage_id: stageId,
        pipeline_id: PIPELINE_PREVENDA_ID,
        origin_kind: "outbound",
        source: r.source?.trim() || "Outbound (prospecção)",
        prospecting_notes: r.anotacao?.trim() || null,
        segment: r.segmento?.trim() || null,
        owner,
        assignees: [owner],
        company_id: companyId,
        primary_contact_id: contactId,
        contact_name: r.contato?.trim() || null,
        contact_phone: digits(r.whatsapp) || null,
        contact_email: r.email?.trim() || null,
        probability: 10,
        monthly_value: 0,
        media_budget: 0,
        bant: {},
        tags: tagIds,
        stage_changed_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (dealErr || !deal) continue;
    if (!firstId) firstId = deal.id as string;
    if (contactId) {
      await supabase
        .from("crm_deal_contacts")
        .insert({ deal_id: deal.id, contact_id: contactId, is_primary: true });
    }
    created += 1;
  }

  return NextResponse.json({ ok: true, persisted: true, created, id: firstId });
}
