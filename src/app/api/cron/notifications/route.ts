import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { trigger } from "@/lib/push/triggers";
import { getCSPortfolio } from "@/lib/data/cs";
import { getHourBank } from "@/lib/data/rh";
import { getDeliveryTasks } from "@/lib/data/operacao";
import { sendWhatsappText } from "@/lib/whatsapp/send";
import { isWhatsappConfigured, WHATSAPP_NOTIFY_NUMBERS } from "@/lib/whatsapp/config";
import {
  buildUpdateMessage,
  isDue,
  type UpdateMetric,
} from "@/lib/data/recurring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron de notificações agendadas (Vercel Cron → CRON_SECRET).
 *
 * - Lembrete de reunião: real (tabela `meetings`, próximas 24h).
 * - Churn / banco de horas / tarefas: prontos, porém protegidos por
 *   NOTIFY_MOCK_ALERTS enquanto lêem dados de demonstração (evita alerta falso).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const result: Record<string, number> = {
    meetingReminders: 0,
    churn: 0,
    hourBank: 0,
    tasks: 0,
    crmOverdue: 0,
    updatesSent: 0,
    updatesFailed: 0,
  };

  // 1) Lembretes de reunião (dados reais) --------------------------------
  if (isSupabaseConfigured() && hasServiceRole()) {
    const admin = createAdminClient();
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 3600 * 1000);
    const { data: meetings } = await admin
      .from("meetings")
      .select("client_id, title, starts_at")
      .gte("starts_at", now.toISOString())
      .lte("starts_at", in24h.toISOString());

    for (const m of meetings ?? []) {
      const when = new Date(m.starts_at as string).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
      await trigger.meetingReminder(
        m.client_id as string,
        (m.title as string) ?? "Reunião",
        when,
      );
      result.meetingReminders++;
    }
  }

  // 1b) Updates recorrentes (REL04) — dispara os que "caem" hoje ----------
  if (isSupabaseConfigured() && hasServiceRole()) {
    const admin = createAdminClient();
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    const { data: updates } = await admin
      .from("recurring_updates")
      .select("id,client_id,metrics,recurrence,last_sent_at,clients(name,whatsapp)")
      .eq("status", "active");

    for (const u of updates ?? []) {
      const rec = String(u.recurrence);
      if (!isDue(rec, now)) continue;
      // Anti-repetição: já enviado hoje?
      if (u.last_sent_at && String(u.last_sent_at).slice(0, 10) === today) continue;

      const client = u.clients as { name?: string; whatsapp?: string } | null;
      const clientName = client?.name ?? "Cliente";
      const phone = String(client?.whatsapp ?? "");
      const metrics = ((u.metrics as UpdateMetric[]) ?? []).filter(Boolean);

      // Falha: sem WhatsApp ou sem métrica → pula, loga e avisa a equipe.
      if (!phone || metrics.length === 0) {
        await admin.from("recurring_update_logs").insert({
          update_id: u.id,
          payload: { reason: !phone ? "cliente sem WhatsApp" : "sem métrica" },
          delivery_status: "failed",
        });
        await trigger.recurringUpdateFailed(clientName, !phone ? "sem WhatsApp cadastrado" : "sem métrica");
        result.updatesFailed++;
        continue;
      }

      const message = buildUpdateMessage(clientName, String(u.client_id), metrics);
      const sent = isWhatsappConfigured() ? await sendWhatsappText(phone, message) : false;

      await admin.from("recurring_update_logs").insert({
        update_id: u.id,
        payload: { metrics, phone },
        delivery_status: sent ? "sent" : "failed",
      });
      await admin.from("report_sends").insert({
        client_id: u.client_id,
        kind: "update",
        channel: "whatsapp",
        recipient: phone,
        sent_by: "automático",
        detail: metrics.join(", "),
      });
      await admin
        .from("recurring_updates")
        .update({ last_sent_at: now.toISOString() })
        .eq("id", u.id);

      if (sent) {
        result.updatesSent++;
      } else {
        result.updatesFailed++;
        await trigger.recurringUpdateFailed(clientName, "envio recusado pelo WhatsApp");
      }
    }
  }

  // 1c) Tarefas atrasadas do CRM (dados reais) — resumo diário ao time -----
  if (isSupabaseConfigured() && hasServiceRole() && WHATSAPP_NOTIFY_NUMBERS.length) {
    const admin = createAdminClient();
    const now = new Date();
    const { data: overdue } = await admin
      .from("crm_tasks")
      .select("title, due_date, crm_leads(name, owner)")
      .eq("status", "pending")
      .lt("due_date", now.toISOString())
      .order("due_date", { ascending: true });

    const items = overdue ?? [];
    result.crmOverdue = items.length;
    if (items.length && isWhatsappConfigured()) {
      // Agrupa por responsável.
      const byOwner = new Map<string, string[]>();
      for (const t of items) {
        const lead = t.crm_leads as { name?: string; owner?: string } | null;
        const owner = lead?.owner || "Sem responsável";
        const line = `• ${String(t.title)} — ${lead?.name ?? "negócio"}`;
        byOwner.set(owner, [...(byOwner.get(owner) ?? []), line]);
      }
      const parts = [...byOwner.entries()].map(
        ([owner, lines]) => `*${owner}* (${lines.length})\n${lines.slice(0, 8).join("\n")}`,
      );
      const message = `⏰ *Tarefas atrasadas no CRM* (${items.length})\n\n${parts.join("\n\n")}`;
      for (const num of WHATSAPP_NOTIFY_NUMBERS) {
        await sendWhatsappText(num, message);
      }
    }
  }

  // 2) Alertas derivados de dados mock (protegidos por flag) --------------
  if (process.env.NOTIFY_MOCK_ALERTS === "true") {
    const churn = getCSPortfolio().clients.filter((c) => c.atRisk).length;
    if (churn > 0) {
      await trigger.churnRisk(churn);
      result.churn = churn;
    }
    const overLimit = getHourBank().rows.filter((r) => r.tone === "danger").length;
    if (overLimit > 0) {
      await trigger.hourBankExceeded(overLimit);
      result.hourBank = overLimit;
    }
    const lateTasks = getDeliveryTasks().filter((t) => t.late).length;
    if (lateTasks > 0) {
      await trigger.tasksDue(lateTasks);
      result.tasks = lateTasks;
    }
  }

  return NextResponse.json({ ok: true, ...result });
}
