import {
  Activity,
  TrendingUp,
  LayoutDashboard,
  Users,
  Megaphone,
  Images,
  BarChart3,
  MessagesSquare,
  CalendarDays,
  Gauge,
  Inbox,
  Plug,
  Receipt,
  KeyRound,
  FolderOpen,
  Wallet,
  ListChecks,
  FileBarChart,
  HeartHandshake,
  Settings,
  Briefcase,
  Boxes,
  Building2,
  CircleUser,
  KanbanSquare,
  Database,
  SlidersHorizontal,
  FileText,
  ShieldCheck,
  Sun,
  Lightbulb,
  type LucideIcon,
} from "lucide-react";
import type { Role, SessionUser } from "@/lib/auth/types";
import { canAccessSection, isAdminTier, type SectionKey } from "@/lib/access";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Seção de acesso (gerencial). Ausente = sempre visível. */
  section?: SectionKey;
  /** Visível se o usuário tiver QUALQUER uma destas seções (rotas combinadas). */
  anySection?: SectionKey[];
  /** Só para admin (ex.: gestão de usuários). */
  adminOnly?: boolean;
};

/** Grupo (Aba) do menu: um cabeçalho + seus itens (sub-abas). */
export type NavGroup = {
  /** Título do grupo. Ausente = sem cabeçalho (cliente). */
  title?: string;
  /** Ícone do grupo (usado no modo recolhido como gatilho do flyout). */
  icon?: LucideIcon;
  items: NavItem[];
};

const GERENCIAL_GROUPS: NavGroup[] = [
  {
    title: "Comercial",
    icon: Briefcase,
    items: [
      { label: "Dashboard Comercial", href: "/gerencial/comercial/dashboard", icon: LayoutDashboard, section: "crm" },
      { label: "Comunicações", href: "/gerencial/inbox", icon: MessagesSquare, section: "crm" },
      { label: "Pipeline (funis)", href: "/gerencial/comercial/pipeline", icon: KanbanSquare, section: "crm" },
      { label: "Calendário/Agenda", href: "/gerencial/agenda", icon: CalendarDays, section: "crm" },
      { label: "Atividades", href: "/gerencial/comercial/atividades", icon: ListChecks, section: "crm" },
      { label: "Listas", href: "/gerencial/comercial/listas", icon: Database, section: "crm" },
      { label: "Insights", href: "/gerencial/comercial/insights", icon: BarChart3, section: "crm" },
      { label: "Configurações", href: "/gerencial/comercial/configuracoes", icon: SlidersHorizontal, section: "crm" },
      { label: "Documentos", href: "/gerencial/comercial/documentos", icon: FileText, section: "crm" },
    ],
  },
  {
    title: "Operacional",
    icon: Boxes,
    items: [
      { label: "Meu dia", href: "/gerencial/meu-dia", icon: Sun },
      { label: "Hub de Clientes", href: "/gerencial/clientes", icon: Users, section: "clientes" },
      { label: "NPS", href: "/gerencial/nps", icon: Gauge, section: "clientes" },
      { label: "Solicitações", href: "/gerencial/solicitacoes", icon: Inbox, section: "clientes" },
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
    icon: Building2,
    items: [
      { label: "Visão geral", href: "/gerencial", icon: LayoutDashboard, section: "visao-geral" },
      { label: "Painel Executivo", href: "/gerencial/painel-executivo", icon: TrendingUp, section: "visao-geral" },
      { label: "Financeiro", href: "/gerencial/financeiro", icon: Wallet, section: "financeiro" },
      { label: "RH & Cultura", href: "/gerencial/rh", icon: HeartHandshake, section: "rh" },
      { label: "Integrações", href: "/gerencial/integracoes", icon: Plug, section: "integracoes" },
      { label: "Usuários", href: "/gerencial/usuarios", icon: ShieldCheck, adminOnly: true },
      { label: "Monitoramento", href: "/gerencial/monitoramento", icon: Activity, adminOnly: true },
    ],
  },
  {
    title: "Conta",
    icon: CircleUser,
    items: [
      { label: "Sugestões", href: "/gerencial/sugestoes", icon: Lightbulb },
      { label: "Configurações", href: "/configuracoes", icon: Settings },
    ],
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
  if (item.adminOnly) return isAdminTier(user.tier);
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
