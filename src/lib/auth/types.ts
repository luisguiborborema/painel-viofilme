/** Papéis de acesso do painel. */
export type Role = "gerencial" | "cliente";

/** Usuário autenticado, normalizado entre modo demo e Supabase. */
export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** Cliente vinculado (para acesso "cliente"). Nulo para gerencial. */
  clientId: string | null;
  /** Nome do cliente/empresa exibido no painel. */
  clientName: string | null;
  avatarUrl?: string | null;
};

export const ROLE_LABEL: Record<Role, string> = {
  gerencial: "Gerencial",
  cliente: "Cliente",
};
