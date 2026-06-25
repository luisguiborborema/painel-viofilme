import type { SessionUser } from "./types";

/**
 * Usuários de demonstração usados quando o Supabase NÃO está configurado.
 * Servem apenas para visualizar o painel rapidamente — não use em produção.
 */
export const DEMO_USERS: Record<
  string,
  { password: string; user: SessionUser }
> = {
  "gerencial@viofilme.com.br": {
    password: "viofilme",
    user: {
      id: "demo-gerencial",
      email: "gerencial@viofilme.com.br",
      name: "Equipe Viofilme",
      role: "gerencial",
      clientId: null,
      clientName: null,
    },
  },
  "cliente@viofilme.com.br": {
    password: "viofilme",
    user: {
      id: "demo-cliente",
      email: "cliente@viofilme.com.br",
      name: "Marina Souza",
      role: "cliente",
      clientId: "cli-001",
      clientName: "Restaurante Sabor do Mar",
    },
  },
};

export const DEMO_COOKIE = "vio_demo_session";

/** Valida credenciais demo e devolve o usuário, ou null. */
export function authenticateDemo(
  email: string,
  password: string,
): SessionUser | null {
  const entry = DEMO_USERS[email.trim().toLowerCase()];
  if (!entry || entry.password !== password) return null;
  return entry.user;
}
