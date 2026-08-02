// Tipos client-safe de formulários (sem acesso a servidor).

/** Uma resposta de formulário atribuída a um cliente (visão do Hub). */
export type ClientFormSubmission = {
  id: string;
  formName: string;
  createdAt: string;
  taskId: string | null;
  leadId: string | null;
  entries: { label: string; value: string }[];
};
