/**
 * Categorias de notificação — usadas para o usuário silenciar tipos de aviso.
 * Client-safe (sem código de servidor): a UI de preferências importa daqui.
 */
import type { Role } from "@/lib/auth/types";

export type NotifCategory =
  | "comments"
  | "content"
  | "requests"
  | "reports"
  | "meetings"
  | "finance"
  | "clients"
  | "tasks"
  | "team";

export type NotifCategoryMeta = {
  key: NotifCategory;
  label: string;
  description: string;
  /** Papéis para os quais a categoria faz sentido (aparece nas preferências). */
  roles: Role[];
};

export const NOTIF_CATEGORIES: NotifCategoryMeta[] = [
  { key: "comments", label: "Comentários", description: "Menções e comentários em negócios do CRM.", roles: ["gerencial"] },
  { key: "requests", label: "Solicitações do portal", description: "Pedidos de reunião e conteúdo enviados pelos clientes.", roles: ["gerencial"] },
  { key: "content", label: "Conteúdo", description: "Peças para aprovar, aprovações e ajustes solicitados.", roles: ["gerencial", "cliente"] },
  { key: "tasks", label: "Tarefas & entregas", description: "Tarefas vencendo ou atrasadas.", roles: ["gerencial"] },
  { key: "clients", label: "Saúde dos clientes", description: "Alertas de risco de churn.", roles: ["gerencial"] },
  { key: "team", label: "Equipe & operação", description: "Banco de horas e falhas em automações.", roles: ["gerencial"] },
  { key: "reports", label: "Relatórios", description: "Relatório do mês disponível.", roles: ["gerencial", "cliente"] },
  { key: "meetings", label: "Reuniões", description: "Lembretes de reunião.", roles: ["cliente"] },
  { key: "finance", label: "Financeiro", description: "Faturas a vencer, pagamentos e cobranças.", roles: ["cliente"] },
];

export function categoriesForRole(role: Role): NotifCategoryMeta[] {
  return NOTIF_CATEGORIES.filter((c) => c.roles.includes(role));
}

const VALID = new Set(NOTIF_CATEGORIES.map((c) => c.key));

/** Filtra uma lista arbitrária, mantendo só chaves de categoria válidas. */
export function sanitizeMuted(input: unknown): NotifCategory[] {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.filter((v): v is NotifCategory => typeof v === "string" && VALID.has(v as NotifCategory)))];
}
