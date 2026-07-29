/**
 * Gatilhos de notificação — copy + público, disparando em DOIS canais:
 * push (web) e WhatsApp (Uazapi). Cada canal é no-op se não configurado.
 */
import { notifyClient, notifyManagement, notifyUser, type PushPayload } from "./send";
import {
  createNotifications,
  notifyClientInApp,
  notifyManagementInApp,
} from "@/lib/notifications";
import { sendWhatsappText } from "@/lib/whatsapp/send";
import {
  WHATSAPP_NOTIFY_NUMBERS,
  isWhatsappConfigured,
} from "@/lib/whatsapp/config";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";

function waText(p: PushPayload): string {
  return `*${p.title}*\n${p.body}`;
}

async function clientPhone(clientId: string): Promise<string | null> {
  if (!isSupabaseConfigured() || !hasServiceRole()) return null;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("clients")
      .select("whatsapp")
      .eq("id", clientId)
      .maybeSingle();
    return (data?.whatsapp as string | null) ?? null;
  } catch {
    return null;
  }
}

/** Cliente: push + WhatsApp (no telefone do cliente) + in-app. */
async function toClient(clientId: string, p: PushPayload): Promise<void> {
  await notifyClient(clientId, p);
  await notifyClientInApp(clientId, {
    title: p.title,
    body: p.body,
    url: p.url,
    category: p.category,
  });
  if (isWhatsappConfigured()) {
    const phone = await clientPhone(clientId);
    if (phone) await sendWhatsappText(phone, waText(p));
  }
}

/** Equipe: push + WhatsApp (números fixos da agência) + in-app. */
async function toManagement(p: PushPayload): Promise<void> {
  await notifyManagement(p);
  await notifyManagementInApp({
    title: p.title,
    body: p.body,
    url: p.url,
    category: p.category,
  });
  if (isWhatsappConfigured()) {
    await Promise.all(
      WHATSAPP_NOTIFY_NUMBERS.map((n) => sendWhatsappText(n, waText(p))),
    );
  }
}

/** Notifica pessoas específicas (por user_id no push e/ou WhatsApp direto). */
async function toUsers(
  recipients: { userId?: string | null; whatsapp?: string | null }[],
  p: PushPayload,
): Promise<void> {
  await Promise.all(
    recipients.map(async (r) => {
      if (r.userId) await notifyUser(r.userId, p).catch(() => {});
      if (r.whatsapp && isWhatsappConfigured())
        await sendWhatsappText(r.whatsapp, waText(p)).catch(() => {});
    }),
  );
  await createNotifications(
    recipients.map((r) => r.userId).filter((id): id is string => Boolean(id)),
    { title: p.title, body: p.body, url: p.url, category: p.category },
  );
}

export const trigger = {
  // --- interno da EQUIPE ---------------------------------------------------
  /** Novo comentário num negócio → notifica responsáveis e @menções. */
  dealComment: (
    recipients: { userId?: string | null; whatsapp?: string | null }[],
    args: { dealName: string; author: string; preview: string; url?: string },
  ) =>
    toUsers(recipients, {
      category: "comments",
      title: `💬 Comentário — ${args.dealName}`,
      body: `${args.author}: ${args.preview}`,
      url: args.url ?? "/gerencial/crm",
    }),

  /** Novo briefing/lead recebido via formulário público → notifica a equipe. */
  formSubmission: (args: { formName: string; title: string; destination: "crm" | "entregas" }) =>
    toManagement({
      category: "requests",
      title: `📋 Novo ${args.destination === "entregas" ? "briefing (tarefa)" : "briefing/lead"} — ${args.formName}`,
      body: args.title || "Formulário preenchido.",
      url: args.destination === "entregas" ? "/gerencial/entregas" : "/gerencial/comercial/pipeline",
    }),

  // --- para o CLIENTE ------------------------------------------------------
  contentAwaitingApproval: (clientId: string, title?: string) =>
    toClient(clientId, {
      category: "content",
      title: "Nova peça para aprovar",
      body: title || "Você tem um conteúdo aguardando aprovação.",
      url: "/cliente/conteudo",
    }),

  reportReady: (clientId: string, period: string) =>
    toClient(clientId, {
      category: "reports",
      title: "Relatório do mês disponível",
      body: `Seus resultados de ${period} já estão no portal.`,
      url: "/cliente/resultados",
    }),

  meetingReminder: (clientId: string, title: string, whenLabel: string) =>
    toClient(clientId, {
      category: "meetings",
      title: "Lembrete de reunião",
      body: `${title} — ${whenLabel}.`,
      url: "/cliente",
    }),

  invoiceDue: (clientId: string, amountLabel: string, dueLabel: string) =>
    toClient(clientId, {
      category: "finance",
      title: "Fatura a vencer",
      body: `${amountLabel} vence ${dueLabel}.`,
      url: "/cliente/financeiro",
    }),

  paymentReceived: (clientId: string, amountLabel: string) =>
    toClient(clientId, {
      category: "finance",
      title: "Pagamento confirmado",
      body: `Recebemos seu pagamento de ${amountLabel}. Obrigado!`,
      url: "/cliente/financeiro",
    }),

  paymentOverdue: (clientId: string, amountLabel: string) =>
    toClient(clientId, {
      category: "finance",
      title: "Fatura vencida",
      body: `Há uma fatura de ${amountLabel} em aberto. Regularize para evitar bloqueios.`,
      url: "/cliente/financeiro",
    }),

  // --- para a EQUIPE (gerencial) -------------------------------------------
  contentDecision: (
    clientId: string,
    clientName: string,
    decision: "approved" | "changes",
    title: string,
  ) =>
    toManagement({
      category: "content",
      title: decision === "approved" ? "Peça aprovada" : "Ajuste solicitado",
      body: `${clientName}: ${title}`,
      url: `/gerencial/clientes/${clientId}`,
    }),

  churnRisk: (count: number) =>
    toManagement({
      category: "clients",
      title: "Cliente em risco de churn",
      body: `${count} conta(s) com health score crítico — ação recomendada.`,
      url: "/gerencial/clientes",
    }),

  tasksDue: (count: number) =>
    toManagement({
      category: "tasks",
      title: "Tarefas para hoje / atrasadas",
      body: `${count} tarefa(s) precisam de atenção no Painel de Entregas.`,
      url: "/gerencial/entregas",
    }),

  hourBankExceeded: (count: number) =>
    toManagement({
      category: "team",
      title: "Banco de horas excedido",
      body: `${count} colaborador(es) acima do limite de horas.`,
      url: "/gerencial/rh",
    }),

  // --- solicitações do cliente (equipe) ------------------------------------
  requestMeeting: (clientId: string | null, clientName: string) =>
    toManagement({
      category: "requests",
      title: "Nova solicitação de reunião",
      body: `${clientName} pediu um horário.`,
      url: clientId ? `/gerencial/clientes/${clientId}` : "/gerencial/clientes",
    }),

  requestContent: (clientId: string | null, clientName: string) =>
    toManagement({
      category: "requests",
      title: "Nova solicitação de conteúdo",
      body: `${clientName} enviou um pedido de conteúdo.`,
      url: clientId ? `/gerencial/clientes/${clientId}` : "/gerencial/clientes",
    }),

  // --- Central de Relatórios (equipe) --------------------------------------
  recurringUpdateFailed: (clientName: string, reason: string) =>
    toManagement({
      category: "team",
      title: "Update recorrente falhou",
      body: `${clientName}: ${reason}. Verifique na Central de Relatórios.`,
      url: "/gerencial/relatorios",
    }),
};
