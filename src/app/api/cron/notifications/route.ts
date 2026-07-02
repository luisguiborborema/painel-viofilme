import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { trigger } from "@/lib/push/triggers";
import { getCSPortfolio } from "@/lib/data/cs";
import { getHourBank } from "@/lib/data/rh";
import { getDeliveryTasks } from "@/lib/data/operacao";

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
