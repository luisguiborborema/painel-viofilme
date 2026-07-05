import {
  LayoutDashboard,
  Users,
  Megaphone,
  Images,
  BarChart3,
  MessagesSquare,
  CalendarDays,
  Target,
  Gauge,
  Plug,
  Receipt,
  KeyRound,
  FolderOpen,
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
  /** Visível se o usuário tiver QUALQUER uma destas seções (rotas combinadas). */
  anySection?: SectionKey[];
};

/** Grupo (Aba) do menu: um cabeçalho + seus itens (sub-abas). */
export type NavGroup = {
  /** Título do grupo. Ausente = sem cabeçalho (cliente). */
  title?: string;
  items: NavItem[];
};

const GERENCIAL_GROUPS: NavGroup[] = [
  {
    title: "Comercial",
    items: [
      { label: "CRM & Vendas", href: "/gerencial/crm", icon: Target, section: "crm" },
      { label: "Atendimento", href: "/gerencial/inbox", icon: MessagesSquare, section: "crm" },
      { label: "Agenda", href: "/gerencial/agenda", icon: CalendarDays, section: "crm" },
    ],
  },
  {
    title: "Operacional",
    items: [
      { label: "Hub de Clientes", href: "/gerencial/clientes", icon: Users, section: "clientes" },
      { label: "Painel de Entregas", href: "/gerencial/entregas", icon: ListChecks, section: "entregas" },
      { label: "VioFlux", href: "/gerencial/conteudo", icon: Images, section: "conteudo" },
      {
        label: "Gestão à Vista",
        href: "/gerencial/gestao-a-vista",
        icon: Gauge,
        anySection: ["campanhas", "resultados"],
      },
      { label: "Central de Relatórios", href: "/gerencial/relatorios", icon: FileBarChart, section: "relatorios" },
      {
        label: "Playbooks",
        href: "/gerencial/documentos",
        icon: FolderOpen,
        anySection: ["clientes", "entregas", "conteudo", "campanhas", "resultados", "relatorios"],
      },
    ],
  },
  {
    title: "Gestão",
    items: [
      { label: "Visão geral", href: "/gerencial", icon: LayoutDashboard, section: "visao-geral" },
      { label: "Financeiro", href: "/gerencial/financeiro", icon: Wallet, section: "financeiro" },
      { label: "RH & Cultura", href: "/gerencial/rh", icon: HeartHandshake, section: "rh" },
      { label: "Integrações", href: "/gerencial/integracoes", icon: Plug, section: "integracoes" },
    ],
  },
  {
    title: "Conta",
    items: [{ label: "Configurações", href: "/configuracoes", icon: Settings }],
  },
];

const CLIENTE_GROUPS: NavGroup[] = [
  {
    items: [
      { label: "Visão geral", href: "/cliente", icon: LayoutDashboard },
      { label: "Conteúdo", href: "/cliente/conteudo", icon: Images },
      { label: "Campanhas", href: "/cliente/campanhas", icon: Megaphone },
      { label: "Resultados", href: "/cliente/resultados", icon: BarChart3 },
      { label: "Financeiro", href: "/cliente/financeiro", icon: Receipt },
      { label: "Marca & acessos", href: "/cliente/central", icon: KeyRound },
      { label: "Configurações", href: "/configuracoes", icon: Settings },
    ],
  },
];

function itemVisible(user: SessionUser, item: NavItem): boolean {
  if (item.section) return canAccessSection(user.allowedSections, item.section);
  if (item.anySection) {
    return item.anySection.some((s) => canAccessSection(user.allowedSections, s));
  }
  return true;
}

/** Menu (em grupos) filtrado pelas permissões do usuário. */
export function visibleNav(user: SessionUser): NavGroup[] {
  if (user.role !== "gerencial") return CLIENTE_GROUPS;
  return GERENCIAL_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => itemVisible(user, item)),
  })).filter((group) => group.items.length > 0);
}

export function navForRole(role: Role): NavGroup[] {
  return role === "gerencial" ? GERENCIAL_GROUPS : CLIENTE_GROUPS;
}
