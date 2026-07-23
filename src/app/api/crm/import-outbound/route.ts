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
    const tagIds = [
      ...new Set([
        ...(r.tags ?? "").split(/[,;|]/).map((t) => tagByName.get(t.trim().toLowerCase())).filter((x): x is string => Boolean(x)),
        ...(r.tagIds ?? []),
      ]),
    ];

    // Criação atômica (company + contact + deal + vínculo) via função Postgres.
    const { data: dealId, error } = await supabase.rpc("crm_create_outbound_deal", {
      p: {
        empresa: r.empresa!.trim(),
        titulo: r.titulo?.trim() || null,
        segmento: r.segmento?.trim() || null,
        site: r.site?.trim() || null,
        cidade_uf: r.cidade_uf?.trim() || null,
        cnpj: r.cnpj?.trim() || null,
        instagram: r.instagram?.trim() || null,
        owner,
        source: r.source?.trim() || null,
        anotacao: r.anotacao?.trim() || null,
        contato: r.contato?.trim() || null,
        cargo: r.cargo?.trim() || null,
        whatsapp: digits(r.whatsapp) || null,
        email: r.email?.trim() || null,
        tag_ids: tagIds,
        stage_id: stageId,
        stage_key: STAGE_RESERVOIR,
        pipeline_id: PIPELINE_PREVENDA_ID,
      },
    });
    if (error || !dealId) continue;
    if (!firstId) firstId = String(dealId);
    created += 1;
  }

  return NextResponse.json({ ok: true, persisted: true, created, id: firstId });
}
