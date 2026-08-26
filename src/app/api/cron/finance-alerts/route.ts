import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { sendWhatsappText } from "@/lib/whatsapp/send";
import { isWhatsappConfigured, WHATSAPP_NOTIFY_NUMBERS } from "@/lib/whatsapp/config";
import { getDre } from "@/lib/data/dre-server";
import { withApiLog } from "@/lib/audit/api-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Alertas do Financeiro (WhatsApp interno):
 *   • margem do mês abaixo da meta
 *   • total vencido acima do limite configurado
 *
 * Roda no despachante diário. Envia no máximo uma vez por dia (alert_last_sent),
 * para não virar spam se o cron rodar mais de uma vez.
 */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  if (!isSupabaseConfigured() || !hasServiceRole()) {
    return NextResponse.json({ ok: true, motivo: "sem service role" });
  }

  const admin = createAdminClient();
  const { data: cfg, error } = await admin
    .from("finance_settings")
    .select("meta_margin, alert_margin, alert_overdue, alert_last_sent")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    if (/alert_margin|42703|finance_settings.*does not exist|42P01/i.test(error.message)) {
      return NextResponse.json({ ok: true, motivo: "migração 0134 pendente" });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const c = (cfg ?? {}) as { meta_margin?: number; alert_margin?: boolean; alert_overdue?: number; alert_last_sent?: string | null };
  const alertaMargem = Boolean(c.alert_margin);
  const limiteVencido = Number(c.alert_overdue ?? 0);
  if (!alertaMargem && limiteVencido <= 0) {
    return NextResponse.json({ ok: true, motivo: "nenhum alerta ligado" });
  }

  const hoje = new Date().toISOString().slice(0, 10);
  if (c.alert_last_sent === hoje) {
    return NextResponse.json({ ok: true, motivo: "já avisou hoje" });
  }

  const avisos: string[] = [];

  if (alertaMargem) {
    const dre = await getDre("mes");
    const meta = Number(c.meta_margin ?? 42);
    if (!dre.semDados && dre.atual.margin < meta) {
      avisos.push(
        `📉 Margem de ${dre.label}: ${dre.atual.margin}% (meta ${meta}%).\n` +
          `Receita ${brl(dre.atual.grossRevenue)} · custos ${brl(dre.atual.totalCosts)} · lucro ${brl(dre.atual.netProfit)}`,
      );
    }
  }

  if (limiteVencido > 0) {
    const PAGO = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "DUNNING_RECEIVED"];
    const { data: abertos } = await admin
      .from("payments")
      .select("value, due_date, status")
      .lt("due_date", hoje)
      .not("status", "in", `(${PAGO.map((s) => `"${s}"`).join(",")})`)
      .limit(5000);
    const total = (abertos ?? []).reduce((s, p) => s + Number((p as { value?: number }).value ?? 0), 0);
    if (total > limiteVencido) {
      avisos.push(`🔴 Inadimplência em ${brl(total)} — acima do limite de ${brl(limiteVencido)} (${(abertos ?? []).length} cobrança(s) vencida(s)).`);
    }
  }

  if (avisos.length === 0) return NextResponse.json({ ok: true, avisos: 0, motivo: "tudo dentro do esperado" });

  const msg = `*Painel Viofilme · Financeiro*\n\n${avisos.join("\n\n")}`;
  let enviados = 0;
  if (isWhatsappConfigured()) {
    for (const num of WHATSAPP_NOTIFY_NUMBERS) {
      if (await sendWhatsappText(num, msg).catch(() => false)) enviados++;
    }
  }
  if (enviados > 0) {
    await admin.from("finance_settings").update({ alert_last_sent: hoje }).eq("id", 1);
  }

  return NextResponse.json({ ok: true, avisos: avisos.length, enviados, destinatarios: WHATSAPP_NOTIFY_NUMBERS.length });
}

export const GET = withApiLog("cron:finance-alerts", handle);
export const POST = withApiLog("cron:finance-alerts", handle);
