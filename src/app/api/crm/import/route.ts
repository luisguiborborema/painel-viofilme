import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = {
  empresa?: string;
  contato?: string;
  telefone?: string;
  email?: string;
  titulo?: string;
  valor_mensal?: string;
  plano?: string;
  origem?: string;
  responsavel?: string;
  estagio?: string;
};

/**
 * Importa negócios em lote a partir de linhas já parseadas (CSV no cliente).
 * Cada linha: find-or-create Empresa (por nome) + Contato + cria o Deal vinculado.
 */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  let body: { rows?: Row[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const rows = (body.rows ?? []).filter((r) => (r.empresa ?? "").trim() || (r.titulo ?? "").trim());
  if (!rows.length) return NextResponse.json({ error: "nenhuma linha válida" }, { status: 400 });

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, persisted: false, created: rows.length, errors: [] });
  }
  const supabase = await createClient();

  // Pipeline default + estágios abertos (mapeia rótulo → key).
  const { data: pipe } = await supabase
    .from("crm_pipelines")
    .select("id")
    .eq("is_default", true)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();
  const pipelineId = pipe?.id as string | undefined;
  const { data: stageRows } = await supabase
    .from("crm_stages")
    .select("id,key,label,position,kind")
    .eq("pipeline_id", pipelineId ?? "")
    .order("position", { ascending: true });
  const openStages = (stageRows ?? []).filter((s) => s.kind === "open");
  const firstStage = openStages[0];
  function resolveStage(label?: string) {
    if (!label) return firstStage;
    const t = label.trim().toLowerCase();
    return (
      openStages.find((s) => String(s.label).toLowerCase() === t || String(s.key).toLowerCase() === t) ??
      firstStage
    );
  }

  // Cache de empresas por nome (evita duplicar dentro do mesmo import).
  const { data: existingCos } = await supabase.from("crm_companies").select("id,name");
  const coByName = new Map<string, string>(
    (existingCos ?? []).map((c) => [String(c.name).toLowerCase(), String(c.id)]),
  );

  const now = new Date().toISOString();
  const errors: string[] = [];
  let created = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    try {
      const coName = (r.empresa ?? "").trim() || (r.titulo ?? "Empresa").trim();
      let companyId = coByName.get(coName.toLowerCase());
      if (!companyId) {
        const { data: co, error } = await supabase
          .from("crm_companies")
          .insert({
            name: coName,
            phone: (r.telefone ?? "").replace(/\D/g, "") || null,
            email: r.email?.trim() || null,
            owner: r.responsavel?.trim() || user.name,
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        companyId = co.id as string;
        coByName.set(coName.toLowerCase(), companyId);
      }

      let contactId: string | null = null;
      const ctName = (r.contato ?? "").trim();
      if (ctName) {
        const { data: ct, error } = await supabase
          .from("crm_contacts")
          .insert({
            company_id: companyId,
            name: ctName,
            phone: (r.telefone ?? "").replace(/\D/g, "") || null,
            email: r.email?.trim() || null,
            is_primary: true,
            owner: r.responsavel?.trim() || user.name,
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        contactId = ct.id as string;
      }

      const stage = resolveStage(r.estagio);
      const { data: deal, error: dErr } = await supabase
        .from("crm_leads")
        .insert({
          name: (r.titulo ?? "").trim() || `${coName} — negócio`,
          company_id: companyId,
          primary_contact_id: contactId,
          pipeline_id: pipelineId ?? null,
          stage_id: stage?.id ?? null,
          stage: stage?.key ?? "prospeccao",
          monthly_value: Number((r.valor_mensal ?? "").replace(/[^\d.]/g, "")) || 0,
          plan: r.plano?.trim() || null,
          source: r.origem?.trim() || "Importação CSV",
          owner: r.responsavel?.trim() || user.name,
          stage_changed_at: now,
        })
        .select("id")
        .single();
      if (dErr) throw new Error(dErr.message);

      if (contactId) {
        await supabase
          .from("crm_deal_contacts")
          .insert({ deal_id: deal.id, contact_id: contactId, is_primary: true });
      }
      created++;
    } catch (e) {
      errors.push(`Linha ${i + 2}: ${e instanceof Error ? e.message : "erro"}`);
    }
  }

  return NextResponse.json({ ok: true, persisted: true, created, errors });
}
