import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { trigger } from "@/lib/push/triggers";
import { sendWhatsappText } from "@/lib/whatsapp/send";
import { isWhatsappConfigured, WHATSAPP_NOTIFY_NUMBERS } from "@/lib/whatsapp/config";
import { isDue, type UpdateMetric } from "@/lib/data/recurring";
import { purgeOldAuditEvents } from "@/lib/audit/log";
import { purgeOldApiLogs } from "@/lib/audit/api-log";
import { formatCompact, formatNumber } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Status do Asaas considerados pagos / a ignorar (não são recebíveis em aberto).
const PAID_STATUS_SET = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "DUNNING_RECEIVED"]);
const SKIP_STATUS_SET = new Set(["REFUNDED", "REFUND_REQUESTED", "CHARGEBACK_REQUESTED", "DELETED"]);

// --- Update recorrente: métricas reais (admin, sem sessão) -------------------
const UPDATE_LABEL: Record<UpdateMetric, string> = {
  followers_growth: "Crescimento de seguidores",
  reach: "Alcance",
  engagement: "Engajamento",
  conversions: "Conversões",
};

function dISO(nowMs: number, daysAgo: number): string {
  return new Date(nowMs - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

function pctVar(cur: number, prev: number): string {
  if (prev <= 0) return cur > 0 ? "novo" : "—";
  const p = Math.round(((cur - prev) / prev) * 100);
  return `${p >= 0 ? "+" : ""}${p}%`;
}

async function sumReach(admin: SupabaseClient, clientId: string, from: string, to: string): Promise<number> {
  const { data } = await admin
    .from("account_metrics")
    .select("reach")
    .eq("client_id", clientId)
    .gte("date", from)
    .lt("date", to);
  return (data ?? []).reduce((s, r) => s + Number((r as { reach?: number }).reach || 0), 0);
}

async function sumConversions(admin: SupabaseClient, clientId: string, from: string, to: string): Promise<number> {
  const { data: camps } = await admin.from("campaigns").select("id").eq("client_id", clientId);
  const ids = (camps ?? []).map((c) => (c as { id: string }).id);
  if (!ids.length) return 0;
  const { data } = await admin
    .from("campaign_metrics")
    .select("conversions")
    .in("campaign_id", ids)
    .gte("date", from)
    .lt("date", to);
  return (data ?? []).reduce((s, r) => s + Number((r as { conversions?: number }).conversions || 0), 0);
}

async function followerDelta(admin: SupabaseClient, clientId: string, from: string, to: string): Promise<number> {
  const { data } = await admin
    .from("account_metrics")
    .select("platform, date, followers")
    .eq("client_id", clientId)
    .gte("date", from)
    .lt("date", to)
    .order("date");
  const first = new Map<string, number>();
  const last = new Map<string, number>();
  for (const r of data ?? []) {
    const row = r as { platform?: string; followers?: number };
    const p = String(row.platform ?? "");
    const f = Number(row.followers || 0);
    if (!first.has(p)) first.set(p, f);
    last.set(p, f);
  }
  let delta = 0;
  for (const p of last.keys()) delta += (last.get(p) ?? 0) - (first.get(p) ?? 0);
  return delta;
}

async function engagementRate(admin: SupabaseClient, clientId: string, from: string, to: string): Promise<number> {
  const { data } = await admin
    .from("content_posts")
    .select("likes, comments, shares, saves, reach")
    .eq("client_id", clientId)
    .eq("status", "published")
    .gte("published_at", from)
    .lt("published_at", to);
  let inter = 0;
  let reach = 0;
  for (const r of data ?? []) {
    const x = r as { likes?: number; comments?: number; shares?: number; saves?: number; reach?: number };
    inter += Number(x.likes || 0) + Number(x.comments || 0) + Number(x.shares || 0) + Number(x.saves || 0);
    reach += Number(x.reach || 0);
  }
  return reach > 0 ? (inter / reach) * 100 : 0;
}

/** Valor + variação de uma métrica do update (30d vs. 30d anteriores). */
async function realUpdateMetric(
  admin: SupabaseClient,
  clientId: string,
  metric: UpdateMetric,
): Promise<{ formatted: string; variation: string }> {
  const now = Date.now();
  const d0 = dISO(now, 0);
  const d30 = dISO(now, 30);
  const d60 = dISO(now, 60);

  if (metric === "reach") {
    const [cur, prev] = [await sumReach(admin, clientId, d30, d0), await sumReach(admin, clientId, d60, d30)];
    return { formatted: formatCompact(cur), variation: pctVar(cur, prev) };
  }
  if (metric === "conversions") {
    const [cur, prev] = [
      await sumConversions(admin, clientId, d30, d0),
      await sumConversions(admin, clientId, d60, d30),
    ];
    return { formatted: formatNumber(cur), variation: pctVar(cur, prev) };
  }
  if (metric === "followers_growth") {
    const [cur, prev] = [
      await followerDelta(admin, clientId, d30, d0),
      await followerDelta(admin, clientId, d60, d30),
    ];
    return {
      formatted: cur >= 0 ? `+${formatNumber(cur)}` : formatNumber(cur),
      variation: pctVar(cur, prev),
    };
  }
  // engagement
  const cur = await engagementRate(admin, clientId, d30, d0);
  const prev = await engagementRate(admin, clientId, d60, d30);
  const pp = Math.round((cur - prev) * 10) / 10;
  return { formatted: `${cur.toFixed(1)}%`, variation: `${pp >= 0 ? "+" : ""}${pp}pp` };
}

/** Monta a mensagem do update recorrente com métricas reais. */
async function buildRealUpdateMessage(
  admin: SupabaseClient,
  clientName: string,
  clientId: string,
  metrics: UpdateMetric[],
): Promise<string> {
  const lines: string[] = [];
  for (const m of metrics) {
    const r = await realUpdateMetric(admin, clientId, m);
    lines.push(`• ${UPDATE_LABEL[m]}: *${r.formatted}* (${r.variation})`);
  }
  return [
    `Olá! 👋 Resumo de ${clientName} — Viofilme:`,
    "",
    ...lines,
    "",
    "Qualquer dúvida, é só chamar por aqui. 🚀",
  ].join("\n");
}

/**
 * Cron de notificações agendadas (Vercel Cron → CRON_SECRET).
 *
 * Todos os alertas usam dados reais: lembrete de reunião (24h), updates
 * recorrentes no WhatsApp (métricas da sincronização Meta, via admin), fatura
 * a vencer (D-3) e vencida (D+3/D+10/D+20), tarefas atrasadas do CRM, churn
 * (fatura vencida 10+ dias), banco de horas (acima do limite no mês) e
 * entregas atrasadas (delivery_tasks).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const result: Record<string, number> = {
    meetingReminders: 0,
    invoiceDue: 0,
    paymentOverdue: 0,
    churn: 0,
    hourBank: 0,
    tasks: 0,
    crmOverdue: 0,
    updatesSent: 0,
    updatesFailed: 0,
    auditPageviewsPurged: 0,
    auditEventsPurged: 0,
  };

  // 0) Retenção do monitoramento (limpa navegação antiga; best-effort).
  {
    const purged = await purgeOldAuditEvents();
    result.auditPageviewsPurged = purged.pageviews;
    result.auditEventsPurged = purged.events;
    // Logs de API: sucesso 30 dias, erro 90 dias.
    const api = await purgeOldApiLogs();
    result.apiLogsPurged = api.ok + api.errors;
  }

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

      const message = await buildRealUpdateMessage(admin, clientName, String(u.client_id), metrics);
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

  // 1c) Tarefas atrasadas do CRM — DM individual ao responsável -------------
  if (isSupabaseConfigured() && hasServiceRole() && isWhatsappConfigured()) {
    const admin = createAdminClient();
    const now = new Date();
    const { data: overdue } = await admin
      .from("crm_tasks")
      .select("title, due_date, assignee, crm_leads(name, owner)")
      .eq("status", "pending")
      .lt("due_date", now.toISOString())
      .order("due_date", { ascending: true });

    const items = overdue ?? [];
    result.crmOverdue = items.length;

    if (items.length) {
      // Telefone por responsável (profiles.whatsapp), casado pelo nome.
      const { data: profiles } = await admin
        .from("profiles")
        .select("full_name, whatsapp")
        .eq("role", "gerencial");
      const phoneByName = new Map<string, string>();
      for (const p of profiles ?? []) {
        if (p.full_name && p.whatsapp) phoneByName.set(String(p.full_name), String(p.whatsapp));
      }

      // Agrupa por responsável (assignee da tarefa, senão dono do negócio).
      const byOwner = new Map<string, string[]>();
      for (const t of items) {
        const lead = t.crm_leads as { name?: string; owner?: string } | null;
        const owner = (t.assignee as string | null) || lead?.owner || "Sem responsável";
        const line = `• ${String(t.title)} — ${lead?.name ?? "negócio"}`;
        byOwner.set(owner, [...(byOwner.get(owner) ?? []), line]);
      }

      const teamFallback: string[] = [];
      for (const [owner, lines] of byOwner.entries()) {
        const phone = phoneByName.get(owner);
        const block = `*${owner}* (${lines.length})\n${lines.slice(0, 12).join("\n")}`;
        if (phone) {
          await sendWhatsappText(
            phone,
            `⏰ *Suas tarefas atrasadas no CRM* (${lines.length})\n${lines.slice(0, 12).join("\n")}`,
          );
        } else {
          teamFallback.push(block);
        }
      }
      // Quem não tem WhatsApp cadastrado entra no resumo ao time.
      if (teamFallback.length && WHATSAPP_NOTIFY_NUMBERS.length) {
        const message = `⏰ *Tarefas atrasadas no CRM (sem responsável com WhatsApp)*\n\n${teamFallback.join("\n\n")}`;
        for (const num of WHATSAPP_NOTIFY_NUMBERS) await sendWhatsappText(num, message);
      }
    }
  }

  // 1d) Financeiro: fatura a vencer (D-3) e vencida (D+3/D+10/D+20) ---------
  // Lê o `payments` real. Dispara só nos offsets da régua para não repetir
  // diariamente a mesma fatura (o cron roda 1x/dia).
  if (isSupabaseConfigured() && hasServiceRole()) {
    const admin = createAdminClient();
    const now = new Date();
    const dayMs = 86_400_000;
    const lo = new Date(now.getTime() - 21 * dayMs).toISOString().slice(0, 10);
    const hi = new Date(now.getTime() + 4 * dayMs).toISOString().slice(0, 10);

    const { data: pays } = await admin
      .from("payments")
      .select("client_id, value, due_date, status")
      .not("client_id", "is", null)
      .gte("due_date", lo)
      .lte("due_date", hi);

    const brl = (v: number) =>
      Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    for (const p of pays ?? []) {
      const clientId = p.client_id as string | null;
      const due = p.due_date as string | null;
      const status = String(p.status ?? "");
      if (!clientId || !due || PAID_STATUS_SET.has(status) || SKIP_STATUS_SET.has(status)) continue;

      const days = Math.round((new Date(due).getTime() - now.getTime()) / dayMs);
      const amount = brl(Number(p.value ?? 0));
      const dueLabel = new Date(due).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      });

      if (days === 3) {
        await trigger.invoiceDue(clientId, amount, `em ${dueLabel}`);
        result.invoiceDue++;
      } else if (days < 0) {
        const od = -days;
        if (od === 3 || od === 10 || od === 20) {
          await trigger.paymentOverdue(clientId, amount);
          result.paymentOverdue++;
        }
      }
    }
  }

  // 1e) Churn real: clientes com fatura vencida há 10+ dias (payments) ------
  if (isSupabaseConfigured() && hasServiceRole()) {
    const admin = createAdminClient();
    const now = new Date();
    const cutoff = new Date(now.getTime() - 10 * 86_400_000).toISOString().slice(0, 10);
    const { data: latePays } = await admin
      .from("payments")
      .select("client_id, status")
      .not("client_id", "is", null)
      .lte("due_date", cutoff);

    const atRisk = new Set<string>();
    for (const p of latePays ?? []) {
      const st = String(p.status ?? "");
      if (!PAID_STATUS_SET.has(st) && !SKIP_STATUS_SET.has(st)) {
        atRisk.add(String(p.client_id));
      }
    }
    if (atRisk.size > 0) {
      await trigger.churnRisk(atRisk.size);
      result.churn = atRisk.size;
    }
  }

  // 1f) Banco de horas: colaboradores acima do limite (hour_entries real) ---
  if (isSupabaseConfigured() && hasServiceRole()) {
    const admin = createAdminClient();
    const now = new Date();
    const ymNow = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const { data: he } = await admin.from("hour_entries").select("employee, hours, work_date");
    const bal = new Map<string, number>();
    for (const e of he ?? []) {
      if (!String(e.work_date ?? "").startsWith(ymNow)) continue;
      const emp = String(e.employee ?? "");
      bal.set(emp, (bal.get(emp) ?? 0) + Number(e.hours ?? 0));
    }
    const overLimit = [...bal.values()].filter((v) => v > 12).length;
    if (overLimit > 0) {
      await trigger.hourBankExceeded(overLimit);
      result.hourBank = overLimit;
    }
  }

  // 1g) Entregas atrasadas (delivery_tasks real) ---------------------------
  if (isSupabaseConfigured() && hasServiceRole()) {
    const admin = createAdminClient();
    const today = new Date().toISOString().slice(0, 10);
    const { count } = await admin
      .from("delivery_tasks")
      .select("id", { count: "exact", head: true })
      .lt("due_date", today)
      .not("stage", "in", "(done,approval)");
    const lateTasks = count ?? 0;
    if (lateTasks > 0) {
      await trigger.tasksDue(lateTasks);
      result.tasks = lateTasks;
    }
  }

  // 1h) Relatório mensal (dia 1º): avisa cada cliente recorrente que o
  // relatório do mês está disponível no portal (push + WhatsApp + in-app).
  if (isSupabaseConfigured() && hasServiceRole()) {
    const now = new Date();
    if (now.getUTCDate() === 1) {
      const admin = createAdminClient();
      const p = now.toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
        timeZone: "America/Sao_Paulo",
      });
      const label = p.charAt(0).toUpperCase() + p.slice(1);
      const { data: cls } = await admin.from("clients").select("id, contract_model").limit(500);
      let sent = 0;
      for (const c of cls ?? []) {
        if (String(c.contract_model ?? "recorrente") === "pontual") continue;
        await trigger.reportReady(String(c.id), label).catch(() => {});
        sent++;
      }
      result.monthlyReports = sent;
    }
  }

  return NextResponse.json({ ok: true, ...result });
}
