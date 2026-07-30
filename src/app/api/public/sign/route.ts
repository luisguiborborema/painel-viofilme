import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/audit/log";
import { trigger } from "@/lib/push/triggers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  return xff.split(",")[0].trim() || req.headers.get("x-real-ip") || "";
}

/**
 * Assinatura PÚBLICA de proposta/contrato (/proposta/<token>). Sem sessão:
 * usa service-role, valida o token, registra a aceitação (nome + IP + data) e
 * move o card do negócio para a etapa "ganho". Best-effort no que não é crítico.
 */
export async function POST(req: Request) {
  let token = "";
  let name = "";
  let website = "";
  try {
    const b = (await req.json()) as { token?: string; name?: string; website?: string };
    token = String(b.token ?? "").trim();
    name = String(b.name ?? "").trim();
    website = String(b.website ?? "").trim();
  } catch {
    return NextResponse.json({ error: "corpo inválido" }, { status: 400 });
  }

  if (website) return NextResponse.json({ ok: true }); // honeypot
  if (!token || !name) return NextResponse.json({ error: "informe seu nome completo" }, { status: 400 });
  if (!isSupabaseConfigured() || !hasServiceRole()) {
    return NextResponse.json({ ok: true, persisted: false });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: doc } = await admin
    .from("crm_documents")
    .select("id, title, status, deal_id, expires_at")
    .eq("public_token", token)
    .maybeSingle();
  if (!doc) return NextResponse.json({ error: "documento não encontrado" }, { status: 404 });
  if (doc.status === "signed") return NextResponse.json({ error: "este documento já foi assinado" }, { status: 409 });
  if (doc.expires_at && new Date(String(doc.expires_at)).getTime() < Date.now()) {
    return NextResponse.json({ error: "documento expirado" }, { status: 410 });
  }

  const ip = clientIp(req);
  const { error } = await admin
    .from("crm_documents")
    .update({ status: "signed", signed_at: now, signed_by_name: name, signed_ip: ip || null })
    .eq("id", doc.id);
  if (error) return NextResponse.json({ error: "falha ao registrar assinatura" }, { status: 500 });

  // Move o card do negócio para a etapa "ganho" (won) do funil dele — best-effort.
  let dealName: string | undefined;
  if (doc.deal_id) {
    try {
      const { data: lead } = await admin
        .from("crm_leads")
        .select("id,name,pipeline_id,stage")
        .eq("id", doc.deal_id)
        .maybeSingle();
      if (lead) {
        dealName = lead.name ? String(lead.name) : undefined;
        const { data: stages } = await admin
          .from("crm_stages")
          .select("id,key,kind")
          .eq("pipeline_id", lead.pipeline_id ?? "");
        const won = (stages ?? []).find((s) => s.kind === "won") ?? (stages ?? []).find((s) => s.key === "ganho");
        if (won && lead.stage !== won.key) {
          await admin
            .from("crm_leads")
            .update({ stage: won.key, stage_id: won.id, won_at: now, stage_changed_at: now, updated_at: now })
            .eq("id", lead.id);
          await admin
            .from("crm_stage_history")
            .insert({ deal_id: lead.id, from_stage: lead.stage ?? null, to_stage: won.key, changed_by: name });
        }
        await admin.from("crm_interactions").insert({
          lead_id: lead.id,
          channel: "system",
          body: `✍️ Proposta "${doc.title}" assinada por ${name}.`,
        });
      }
    } catch {
      /* best-effort */
    }
  }

  await logEvent({
    userName: name,
    panel: "cliente",
    action: "sign",
    area: "Documentos",
    target: String(doc.id),
    detail: `Assinou "${doc.title}"`,
    meta: { ip, dealId: doc.deal_id ?? null },
  });
  await trigger.documentSigned({ title: String(doc.title), signer: name, dealName }).catch(() => {});

  return NextResponse.json({ ok: true, persisted: true });
}
