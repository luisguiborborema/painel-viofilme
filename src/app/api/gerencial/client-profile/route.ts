import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  clientId?: string;
  name?: string;
  segment?: string;
  squadId?: string;
  city?: string;
  csResponsavel?: string;
  contactName?: string;
  contactRole?: string;
  contactPhone?: string;
  contactEmail?: string;
  briefObjetivo?: string;
  briefTom?: string;
  briefPublico?: string;
  briefConcorrentes?: string;
  briefRestricoes?: string;
  contractModel?: string;
  driveFolderUrl?: string;
};

const clean = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

/**
 * Contatos, dados e briefing do cliente (gerencial). Persiste em colunas de
 * `clients`. Update PARCIAL: só grava as chaves presentes no corpo (assim um
 * editor que manda só alguns campos não zera os demais).
 */
export async function POST(req: Request) {
  const user = await getSession();
  if (user?.readOnly) return NextResponse.json({ error: "acesso somente leitura" }, { status: 403 });
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  let b: Body;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!b.clientId) {
    return NextResponse.json({ error: "clientId ausente" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });
  const supabase = await createClient();

  const patch: Record<string, unknown> = {};
  // Nome nunca vira nulo (só grava se veio preenchido).
  if (b.name && b.name.trim()) patch.name = b.name.trim();
  if ("segment" in b) patch.segment = clean(b.segment);
  if ("squadId" in b) patch.squad_id = clean(b.squadId);
  if ("city" in b) patch.city = clean(b.city);
  if ("csResponsavel" in b) patch.cs_responsavel = clean(b.csResponsavel);
  if ("contactName" in b) patch.contact_name = clean(b.contactName);
  if ("contactRole" in b) patch.contact_role = clean(b.contactRole);
  if ("contactPhone" in b) patch.contact_phone = clean(b.contactPhone);
  if ("contactEmail" in b) patch.contact_email = clean(b.contactEmail);
  if ("briefObjetivo" in b) patch.brief_objetivo = clean(b.briefObjetivo);
  if ("briefTom" in b) patch.brief_tom = clean(b.briefTom);
  if ("briefPublico" in b) patch.brief_publico = clean(b.briefPublico);
  if ("briefConcorrentes" in b) patch.brief_concorrentes = clean(b.briefConcorrentes);
  if ("briefRestricoes" in b) patch.brief_restricoes = clean(b.briefRestricoes);
  if ("contractModel" in b) patch.contract_model = b.contractModel === "pontual" ? "pontual" : "recorrente";
  if ("driveFolderUrl" in b) patch.drive_folder_url = clean(b.driveFolderUrl);

  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true, persisted: false });

  const { error } = await supabase.from("clients").update(patch).eq("id", b.clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: true });
}
