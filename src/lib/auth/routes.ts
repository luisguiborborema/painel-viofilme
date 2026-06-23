import type { Role } from "./types";

/** Página inicial conforme o papel. */
export function homeForRole(role: Role): string {
  return role === "gerencial" ? "/gerencial" : "/cliente";
}

/** Prefixo de rota protegido por papel. */
export const ROLE_PREFIX: Record<Role, string> = {
  gerencial: "/gerencial",
  cliente: "/cliente",
};
