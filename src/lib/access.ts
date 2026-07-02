/**
 * Controle de acesso do painel gerencial (RBAC por seção/aba).
 *
 * Cada usuário gerencial tem `allowedSections`:
 *  - null/undefined  → acesso TOTAL (Gestor).
 *  - array de chaves → restrito às seções listadas.
 *
 * Helpers puros (client-safe). A aplicação server-side fica no layout gerencial.
 */
export type SectionKey =
  | "visao-geral"
  | "clientes"
  | "entregas"
  | "campanhas"
  | "conteudo"
  | "resultados"
  | "relatorios"
  | "rh"
  | "financeiro"
  | "integracoes";

export const SECTIONS: { key: SectionKey; label: string; href: string }[] = [
  { key: "visao-geral", label: "Visão geral", href: "/gerencial" },
  { key: "clientes", label: "Clientes", href: "/gerencial/clientes" },
  { key: "entregas", label: "Entregas", href: "/gerencial/entregas" },
  { key: "campanhas", label: "Campanhas", href: "/gerencial/campanhas" },
  { key: "conteudo", label: "Conteúdo", href: "/gerencial/conteudo" },
  { key: "resultados", label: "Resultados", href: "/gerencial/resultados" },
  { key: "relatorios", label: "Relatórios", href: "/gerencial/relatorios" },
  { key: "rh", label: "RH & cultura", href: "/gerencial/rh" },
  { key: "financeiro", label: "Financeiro", href: "/gerencial/financeiro" },
  { key: "integracoes", label: "Integrações", href: "/gerencial/integracoes" },
];

export const ALL_SECTIONS: SectionKey[] = SECTIONS.map((s) => s.key);

export type TeamTemplate = {
  value: string;
  label: string;
  /** null = todas as seções (Gestor). */
  sections: SectionKey[] | null;
};

export const TEAM_TEMPLATES: TeamTemplate[] = [
  { value: "gestor", label: "Gestor (vê tudo)", sections: null },
  { value: "financeiro", label: "Financeiro", sections: ["financeiro"] },
  { value: "rh", label: "RH & cultura", sections: ["rh"] },
  {
    value: "social",
    label: "Social Media",
    sections: ["clientes", "conteudo", "resultados", "entregas"],
  },
  {
    value: "trafego",
    label: "Tráfego",
    sections: ["clientes", "campanhas", "resultados", "relatorios"],
  },
  {
    value: "cs",
    label: "Customer Success",
    sections: ["clientes", "relatorios", "financeiro"],
  },
  { value: "custom", label: "Personalizado", sections: [] },
];

/** Acesso total? (Gestor) */
export function hasFullAccess(allowed?: string[] | null): boolean {
  return allowed == null;
}

export function canAccessSection(
  allowed: string[] | null | undefined,
  section: SectionKey,
): boolean {
  if (allowed == null) return true;
  return allowed.includes(section);
}

/** Mapeia o pathname para a seção (mais específica primeiro). */
export function pathToSection(pathname: string): SectionKey | null {
  const match = [...SECTIONS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((s) => pathname === s.href || pathname.startsWith(s.href + "/"));
  return match?.key ?? null;
}

/** Primeira rota que o usuário pode acessar (para redirecionar). */
export function firstAllowedHref(allowed: string[] | null | undefined): string {
  if (allowed == null) return "/gerencial";
  const s = SECTIONS.find((sec) => allowed.includes(sec.key));
  return s?.href ?? "/configuracoes";
}
