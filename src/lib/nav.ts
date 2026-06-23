import {
  LayoutDashboard,
  Users,
  Megaphone,
  Images,
  BarChart3,
  Plug,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/auth/types";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

const GERENCIAL_NAV: NavItem[] = [
  { label: "Visão geral", href: "/gerencial", icon: LayoutDashboard },
  { label: "Clientes", href: "/gerencial/clientes", icon: Users },
  { label: "Campanhas", href: "/gerencial/campanhas", icon: Megaphone },
  { label: "Conteúdo", href: "/gerencial/conteudo", icon: Images },
  { label: "Resultados", href: "/gerencial/resultados", icon: BarChart3 },
  { label: "Integrações", href: "/gerencial/integracoes", icon: Plug },
];

const CLIENTE_NAV: NavItem[] = [
  { label: "Visão geral", href: "/cliente", icon: LayoutDashboard },
  { label: "Conteúdo", href: "/cliente/conteudo", icon: Images },
  { label: "Campanhas", href: "/cliente/campanhas", icon: Megaphone },
  { label: "Resultados", href: "/cliente/resultados", icon: BarChart3 },
];

export function navForRole(role: Role): NavItem[] {
  return role === "gerencial" ? GERENCIAL_NAV : CLIENTE_NAV;
}
