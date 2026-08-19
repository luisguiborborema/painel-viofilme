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
  | "crm"
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
  { key: "crm", label: "Comercial", href: "/gerencial/comercial/dashboard" },
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
  {
    value: "comercial",
    label: "Comercial / BDR",
    sections: ["crm", "clientes"],
  },
  { value: "financeiro", label: "Financeiro", sections: ["financeiro"] },
  { value: "rh", label: "RH & cultura", sections: ["rh"] },
  // Operacional: só o escopo de produção (Linha Editorial + Tarefas/Entregas).
  // Sem CRM/Comercial, Financeiro nem Configurações administrativas.
  {
    value: "social",
    label: "Social Media",
    sections: ["clientes", "entregas", "conteudo"],
  },
  {
    value: "designer",
    label: "Designer",
    sections: ["clientes", "entregas"],
  },
  {
    value: "editor-video",
    label: "Editor de Vídeo",
    sections: ["clientes", "entregas"],
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

/**
 * Perfil do usuário (tier). Define o nível de acesso de forma nomeada:
 *  - admin       → tudo + gerencia usuários
 *  - gestor      → todas as abas (sem gerenciar usuários)
 *  - colaborador → abas escolhidas (allowed_sections), pode editar
 *  - viewer      → abas escolhidas, SOMENTE LEITURA
 */
export type ProfileTier = "admin" | "gestor" | "colaborador" | "viewer";

export const PROFILE_TIERS: { value: ProfileTier; label: string; hint: string }[] = [
  { value: "admin", label: "Admin", hint: "Acesso total + gerencia usuários" },
  { value: "gestor", label: "Gestor", hint: "Vê e edita todas as abas" },
  { value: "colaborador", label: "Colaborador", hint: "Acesso às abas escolhidas" },
  { value: "viewer", label: "Viewer", hint: "Somente leitura das abas escolhidas" },
];

/** Tiers com acesso a todas as seções (allowed_sections = null). */
export function tierHasFullAccess(tier?: string | null): boolean {
  return tier === "admin" || tier === "gestor";
}
/** Só o admin gerencia usuários. */
export function isAdminTier(tier?: string | null): boolean {
  return tier === "admin";
}
/** Viewer = somente leitura (bloqueia escrita). */
export function isReadOnlyTier(tier?: string | null): boolean {
  return tier === "viewer";
}

/** Acesso total? (Gestor/Admin) */
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

/**
 * Rotas combinadas (uma página com sub-guias de várias seções): visíveis se o
 * usuário tiver QUALQUER uma das seções listadas.
 */
const COMBINED_ROUTES: { href: string; anyOf: SectionKey[] }[] = [
  { href: "/gerencial/gestao-a-vista", anyOf: ["campanhas", "resultados"] },
  { href: "/gerencial/nps", anyOf: ["clientes"] },
  { href: "/gerencial/pos-reuniao", anyOf: ["clientes"] },
  { href: "/gerencial/diagnostico", anyOf: ["crm", "entregas", "clientes"] },
  { href: "/gerencial/comercial/disparos", anyOf: ["crm"] },
  { href: "/gerencial/comercial/formularios", anyOf: ["crm"] },
];

/** O usuário pode acessar esta rota do painel gerencial? */
export function canAccessPath(
  allowed: string[] | null | undefined,
  pathname: string,
): boolean {
  const combined = COMBINED_ROUTES.find(
    (r) => pathname === r.href || pathname.startsWith(r.href + "/"),
  );
  if (combined) return combined.anyOf.some((s) => canAccessSection(allowed, s));
  const section = pathToSection(pathname);
  return !section || canAccessSection(allowed, section);
}

/** Primeira rota que o usuário pode acessar (para redirecionar). */
export function firstAllowedHref(allowed: string[] | null | undefined): string {
  if (allowed == null) return "/gerencial";
  const s = SECTIONS.find((sec) => allowed.includes(sec.key));
  return s?.href ?? "/configuracoes";
}
