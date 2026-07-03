/**
 * Gatilhos de notificação — copy + público, disparando em DOIS canais:
 * push (web) e WhatsApp (Uazapi). Cada canal é no-op se não configurado.
 */
import { notifyClient, notifyManagement, type PushPayload } from "./send";
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

/** Cliente: push + WhatsApp (no telefone do cliente). */
async function toClient(clientId: string, p: PushPayload): Promise<void> {
  await notifyClient(clientId, p);
  if (isWhatsappConfigured()) {
    const phone = await clientPhone(clientId);
    if (phone) await sendWhatsappText(phone, waText(p));
  }
}

/** Equipe: push + WhatsApp (números fixos da agência). */
async function toManagement(p: PushPayload): Promise<void> {
  await notifyManagement(p);
  if (isWhatsappConfigured()) {
    await Promise.all(
      WHATSAPP_NOTIFY_NUMBERS.map((n) => sendWhatsappText(n, waText(p))),
    );
  }
}

export const trigger = {
  // --- para o CLIENTE ------------------------------------------------------
  contentAwaitingApproval: (clientId: string, title?: string) =>
    toClient(clientId, {
      title: "Nova peça para aprovar",
      body: title || "Você tem um conteúdo aguardando aprovação.",
      url: "/cliente/conteudo",
    }),

  reportReady: (clientId: string, period: string) =>
    toClient(clientId, {
      title: "Relatório do mês disponível",
      body: `Seus resultados de ${period} já estão no portal.`,
      url: "/cliente/resultados",
    }),

  meetingReminder: (clientId: string, title: string, whenLabel: string) =>
    toClient(clientId, {
      title: "Lembrete de reunião",
      body: `${title} — ${whenLabel}.`,
      url: "/cliente",
    }),

  invoiceDue: (clientId: string, amountLabel: string, dueLabel: string) =>
    toClient(clientId, {
      title: "Fatura a vencer",
      body: `${amountLabel} vence ${dueLabel}.`,
      url: "/cliente/financeiro",
    }),

  paymentReceived: (clientId: string, amountLabel: string) =>
    toClient(clientId, {
      title: "Pagamento confirmado",
      body: `Recebemos seu pagamento de ${amountLabel}. Obrigado!`,
      url: "/cliente/financeiro",
    }),

  paymentOverdue: (clientId: string, amountLabel: string) =>
    toClient(clientId, {
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
      title: decision === "approved" ? "Peça aprovada" : "Ajuste solicitado",
      body: `${clientName}: ${title}`,
      url: `/gerencial/clientes/${clientId}`,
    }),

  churnRisk: (count: number) =>
    toManagement({
      title: "Cliente em risco de churn",
      body: `${count} conta(s) com health score crítico — ação recomendada.`,
      url: "/gerencial/clientes",
    }),

  tasksDue: (count: number) =>
    toManagement({
      title: "Tarefas para hoje / atrasadas",
      body: `${count} tarefa(s) precisam de atenção no Painel de Entregas.`,
      url: "/gerencial/entregas",
    }),

  hourBankExceeded: (count: number) =>
    toManagement({
      title: "Banco de horas excedido",
      body: `${count} colaborador(es) acima do limite de horas.`,
      url: "/gerencial/rh",
    }),

  // --- solicitações do cliente (equipe) ------------------------------------
  requestMeeting: (clientId: string | null, clientName: string) =>
    toManagement({
      title: "Nova solicitação de reunião",
      body: `${clientName} pediu um horário.`,
      url: clientId ? `/gerencial/clientes/${clientId}` : "/gerencial/clientes",
    }),

  requestContent: (clientId: string | null, clientName: string) =>
    toManagement({
      title: "Nova solicitação de conteúdo",
      body: `${clientName} enviou um pedido de conteúdo.`,
      url: clientId ? `/gerencial/clientes/${clientId}` : "/gerencial/clientes",
    }),

  // --- Central de Relatórios (equipe) --------------------------------------
  recurringUpdateFailed: (clientName: string, reason: string) =>
    toManagement({
      title: "Update recorrente falhou",
      body: `${clientName}: ${reason}. Verifique na Central de Relatórios.`,
      url: "/gerencial/relatorios",
    }),
};
