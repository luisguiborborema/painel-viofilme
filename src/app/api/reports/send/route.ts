import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { sendWhatsappText, sendWhatsappMedia } from "@/lib/whatsapp/send";
import { isWhatsappConfigured } from "@/lib/whatsapp/config";
import { getReportSends } from "@/lib/data/queries";
import { UPDATE_METRICS, resolveMetricValue } from "@/lib/data/recurring";
import { buildReportPdf } from "@/lib/reports/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** REL06 — histórico de envios (relatórios manuais + updates automáticos). */
export async function GET() {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const sends = await getReportSends();
  return NextResponse.json({ sends });
}

function slug(s: string) {
  return s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "cliente";
}

/**
 * REL05 — envio MANUAL do relatório por WhatsApp (o analista decide quando).
 * Gera um PDF com as métricas do período, sobe no Storage e envia como
 * documento via Uazapi. Registra em report_sends (REL06).
 */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  let b: {
    clientId?: string;
    period?: string;
    metrics?: { label: string; value: string; variation?: string }[];
  };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!b.clientId) return NextResponse.json({ error: "clientId ausente" }, { status: 400 });

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, persisted: false });
  }

  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("name,whatsapp")
    .eq("id", b.clientId)
    .maybeSingle();
  if (!client) return NextResponse.json({ error: "cliente não encontrado" }, { status: 404 });
  const phone = String(client.whatsapp ?? "");
  if (!phone) {
    return NextResponse.json(
      { error: "cliente sem WhatsApp cadastrado (defina em Clientes → Configuração)" },
      { status: 400 },
    );
  }

  const period =
    b.period?.trim() ||
    new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
      timeZone: "America/Sao_Paulo",
    }).format(new Date());
  const clientName = String(client.name);

  // Métricas: as selecionadas no gerador; senão, o resumo padrão (4 métricas).
  const metrics =
    Array.isArray(b.metrics) && b.metrics.length > 0
      ? b.metrics.map((m) => ({ label: String(m.label), value: String(m.value), variation: m.variation }))
      : UPDATE_METRICS.map((m) => {
          const r = resolveMetricValue(b.clientId!, m.key);
          return { label: m.label, value: r.formatted, variation: r.variation };
        });

  const caption = `Olá! 📊 Segue o relatório de resultados de ${clientName} — ${period}. Qualquer dúvida, é só chamar!`;

  let sent = false;
  let mode: "pdf" | "text" = "text";
  let publicUrl: string | undefined;

  // Gera o PDF e sobe no Storage (precisa de service_role).
  if (hasServiceRole() && isWhatsappConfigured()) {
    try {
      const bytes = await buildReportPdf({ clientName, period, metrics });
      const admin = createAdminClient();
      await admin.storage
        .createBucket("wa-media", { public: true, fileSizeLimit: "16MB" })
        .catch(() => {});
      const path = `reports/${b.clientId}/${Date.now()}.pdf`;
      const { error: upErr } = await admin.storage
        .from("wa-media")
        .upload(path, Buffer.from(bytes), { contentType: "application/pdf", upsert: false });
      if (!upErr) {
        publicUrl = admin.storage.from("wa-media").getPublicUrl(path).data.publicUrl;
        sent = await sendWhatsappMedia(phone, "document", publicUrl, {
          caption,
          filename: `Relatorio-${slug(clientName)}.pdf`,
        });
        mode = "pdf";
      }
    } catch {
      /* cai no fallback de texto abaixo */
    }
  }

  // Fallback: se não deu para gerar/enviar o PDF, manda o aviso em texto.
  if (!sent && isWhatsappConfigured()) {
    sent = await sendWhatsappText(phone, caption);
    mode = "text";
  }

  await supabase.from("report_sends").insert({
    client_id: b.clientId,
    kind: "report",
    channel: "whatsapp",
    recipient: phone,
    sent_by: user.name,
    detail: `${mode === "pdf" ? "PDF" : "Aviso"} · ${period}`,
  });

  return NextResponse.json({ ok: true, persisted: true, sent, mode, url: publicUrl });
}
