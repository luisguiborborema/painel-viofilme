import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { buildProposalPdf } from "@/lib/crm/proposal-pdf";
import { sendWhatsappMedia } from "@/lib/whatsapp/send";
import { isWhatsappConfigured } from "@/lib/whatsapp/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action?: "download" | "send";
  dealId?: string;
  scope?: string;
  validityDays?: number;
};

function slug(n: string) {
  return n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "proposta";
}

/** Gera a proposta em PDF do negócio (baixar) ou envia ao contato via WhatsApp. */
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
  if (!b.dealId) return NextResponse.json({ error: "dealId ausente" }, { status: 400 });

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "backend indisponível" }, { status: 503 });
  }
  const supabase = await createClient();

  const { data: deal } = await supabase
    .from("crm_leads")
    .select("name, monthly_value, plan, owner, company_id, primary_contact_id, contact_phone")
    .eq("id", b.dealId)
    .maybeSingle();
  if (!deal) return NextResponse.json({ error: "negócio não encontrado" }, { status: 404 });

  let companyName = String(deal.name ?? "Empresa");
  if (deal.company_id) {
    const { data: co } = await supabase
      .from("crm_companies").select("name").eq("id", deal.company_id).maybeSingle();
    if (co?.name) companyName = String(co.name);
  }
  let contactName: string | undefined;
  let contactPhone: string | null = (deal.contact_phone as string | null) ?? null;
  if (deal.primary_contact_id) {
    const { data: ct } = await supabase
      .from("crm_contacts").select("name, phone").eq("id", deal.primary_contact_id).maybeSingle();
    if (ct?.name) contactName = String(ct.name);
    if (ct?.phone) contactPhone = String(ct.phone);
  }

  const dateLabel = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const bytes = await buildProposalPdf({
    companyName,
    contactName,
    dealTitle: String(deal.name ?? "Proposta"),
    monthlyValue: Number(deal.monthly_value ?? 0),
    plan: deal.plan ? String(deal.plan) : undefined,
    owner: deal.owner ? String(deal.owner) : undefined,
    scopeLines: (b.scope ?? "").split("\n"),
    validityDays: b.validityDays ?? 15,
    dateLabel,
  });

  // Enviar por WhatsApp ao contato.
  if (b.action === "send") {
    if (!hasServiceRole() || !isWhatsappConfigured()) {
      return NextResponse.json({ error: "WhatsApp/serviço indisponível" }, { status: 503 });
    }
    if (!contactPhone) {
      return NextResponse.json({ error: "contato sem WhatsApp" }, { status: 400 });
    }
    const admin = createAdminClient();
    await admin.storage.createBucket("wa-media", { public: true, fileSizeLimit: "16MB" }).catch(() => {});
    const path = `proposals/${b.dealId}/${Date.now()}.pdf`;
    const { error: upErr } = await admin.storage
      .from("wa-media")
      .upload(path, Buffer.from(bytes), { contentType: "application/pdf", upsert: false });
    if (upErr) return NextResponse.json({ error: "falha ao subir PDF" }, { status: 500 });
    const url = admin.storage.from("wa-media").getPublicUrl(path).data.publicUrl;
    const sent = await sendWhatsappMedia(contactPhone, "document", url, {
      caption: `Olá! Segue a proposta comercial da ${companyName}. Qualquer dúvida, é só chamar!`,
      filename: `Proposta-${slug(companyName)}.pdf`,
    });
    // Registra na timeline do negócio.
    await admin.from("crm_interactions").insert({
      lead_id: b.dealId,
      channel: "whatsapp",
      direction: "out",
      author: user.name,
      body: sent ? "📄 Proposta enviada por WhatsApp." : "Tentativa de envio da proposta (falhou).",
    });
    return NextResponse.json({ ok: true, sent });
  }

  // Baixar.
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Proposta-${slug(companyName)}.pdf"`,
    },
  });
}
