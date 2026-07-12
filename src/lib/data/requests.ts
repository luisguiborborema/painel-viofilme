/** Solicitações do portal do cliente (reunião / conteúdo) — visão da equipe. */

export type RequestStatus =
  | "pending"
  | "scheduled"
  | "in_progress"
  | "done"
  | "declined";

export const REQUEST_STATUS: { key: RequestStatus; label: string }[] = [
  { key: "pending", label: "Pendente" },
  { key: "scheduled", label: "Agendada" },
  { key: "in_progress", label: "Em andamento" },
  { key: "done", label: "Concluída" },
  { key: "declined", label: "Recusada" },
];

export type MeetingRequest = {
  id: string;
  clientId: string;
  clientName?: string;
  subject: string;
  notes?: string;
  urgency: "normal" | "urgent";
  status: RequestStatus;
  createdAt: string;
};

export type ContentRequest = {
  id: string;
  clientId: string;
  clientName?: string;
  format: string;
  networks: string[];
  desiredDate?: string;
  desiredTime?: string;
  subject: string;
  description?: string;
  guideline?: string;
  referenceUrls: string[];
  urgency: "normal" | "urgent";
  status: RequestStatus;
  createdAt: string;
};

export type ClientRequests = { meetings: MeetingRequest[]; content: ContentRequest[] };
