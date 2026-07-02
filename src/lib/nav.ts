import {
  LayoutDashboard,
  Users,
  Megaphone,
  Images,
  BarChart3,
  Plug,
  Receipt,
  KeyRound,
  Wallet,
  ListChecks,
  FileBarChart,
  HeartHandshake,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { Role, SessionUser } from "@/lib/auth/types";
import { canAccessSection, type SectionKey } from "@/lib/access";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Seção de acesso (gerencial). Ausente = sempre visível. */
  section?: SectionKey;
};

const GERENCIAL_NAV: NavItem[] = [
  { label: "Visão geral", href: "/gerencial", icon: LayoutDashboard, section: "visao-geral" },
  { label: "Clientes", href: "/gerencial/clientes", icon: Users, section: "clientes" },
  { label: "Entregas", href: "/gerencial/entregas", icon: ListChecks, section: "entregas" },
  { label: "Campanhas", href: "/gerencial/campanhas", icon: Megaphone, section: "campanhas" },
  { label: "Conteúdo", href: "/gerencial/conteudo", icon: Images, section: "conteudo" },
  { label: "Resultados", href: "/gerencial/resultados", icon: BarChart3, section: "resultados" },
  { label: "Relatórios", href: "/gerencial/relatorios", icon: FileBarChart, section: "relatorios" },
  { label: "RH & cultura", href: "/gerencial/rh", icon: HeartHandshake, section: "rh" },
  { label: "Financeiro", href: "/gerencial/financeiro", icon: Wallet, section: "financeiro" },
  { label: "Integrações", href: "/gerencial/integracoes", icon: Plug, section: "integracoes" },
  { label: "Configurações", href: "/configuracoes", icon: Settings },
];

const CLIENTE_NAV: NavItem[] = [
  { label: "Visão geral", href: "/cliente", icon: LayoutDashboard },
  { label: "Conteúdo", href: "/cliente/conteudo", icon: Images },
  { label: "Campanhas", href: "/cliente/campanhas", icon: Megaphone },
  { label: "Resultados", href: "/cliente/resultados", icon: BarChart3 },
  { label: "Financeiro", href: "/cliente/financeiro", icon: Receipt },
  { label: "Marca & acessos", href: "/cliente/central", icon: KeyRound },
  { label: "Configurações", href: "/configuracoes", icon: Settings },
];

export function navForRole(role: Role): NavItem[] {
  return role === "gerencial" ? GERENCIAL_NAV : CLIENTE_NAV;
}

/** Menu filtrado pelas permissões do usuário (gerencial). */
export function visibleNav(user: SessionUser): NavItem[] {
  if (user.role !== "gerencial") return CLIENTE_NAV;
  return GERENCIAL_NAV.filter(
    (item) => !item.section || canAccessSection(user.allowedSections, item.section),
  );
}
