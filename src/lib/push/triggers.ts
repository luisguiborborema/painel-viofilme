/**
 * Gatilhos de notificação — copy + público-alvo centralizados.
 * Cada função monta a mensagem e envia via os helpers de `send.ts`.
 */
import { notifyClient, notifyManagement } from "./send";

export const trigger = {
  // --- para o CLIENTE ------------------------------------------------------
  contentAwaitingApproval: (clientId: string, title?: string) =>
    notifyClient(clientId, {
      title: "Nova peça para aprovar",
      body: title || "Você tem um conteúdo aguardando aprovação.",
      url: "/cliente/conteudo",
    }),

  reportReady: (clientId: string, period: string) =>
    notifyClient(clientId, {
      title: "Relatório do mês disponível",
      body: `Seus resultados de ${period} já estão no portal.`,
      url: "/cliente/resultados",
    }),

  meetingReminder: (clientId: string, title: string, whenLabel: string) =>
    notifyClient(clientId, {
      title: "Lembrete de reunião",
      body: `${title} — ${whenLabel}.`,
      url: "/cliente",
    }),

  invoiceDue: (clientId: string, amountLabel: string, dueLabel: string) =>
    notifyClient(clientId, {
      title: "Fatura a vencer",
      body: `${amountLabel} vence ${dueLabel}.`,
      url: "/cliente/financeiro",
    }),

  // --- para a EQUIPE (gerencial) -------------------------------------------
  contentDecision: (
    clientId: string,
    clientName: string,
    decision: "approved" | "changes",
    title: string,
  ) =>
    notifyManagement({
      title: decision === "approved" ? "Peça aprovada" : "Ajuste solicitado",
      body: `${clientName}: ${title}`,
      url: `/gerencial/clientes/${clientId}`,
    }),

  churnRisk: (count: number) =>
    notifyManagement({
      title: "Cliente em risco de churn",
      body: `${count} conta(s) com health score crítico — ação recomendada.`,
      url: "/gerencial/clientes",
    }),

  tasksDue: (count: number) =>
    notifyManagement({
      title: "Tarefas para hoje / atrasadas",
      body: `${count} tarefa(s) precisam de atenção no Painel de Entregas.`,
      url: "/gerencial/entregas",
    }),

  hourBankExceeded: (count: number) =>
    notifyManagement({
      title: "Banco de horas excedido",
      body: `${count} colaborador(es) acima do limite de horas.`,
      url: "/gerencial/rh",
    }),
};
