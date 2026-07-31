import {
  BarChart3,
  CalendarDays,
  CalendarRange,
  Clapperboard,
  FolderOpen,
  Images,
  ListChecks,
  Rocket,
  Target,
  type LucideIcon,
} from "lucide-react";

export type ClientTabDef = { key: string; label: string; icon: LucideIcon };

/**
 * Abas da tela do cliente (Hub de Clientes › cliente). Cada uma é uma rota
 * própria (`/gerencial/clientes/[id]/<key>`) e vira sub-item do menu lateral.
 */
export const CLIENT_TAB_ITEMS: ClientTabDef[] = [
  { key: "resumo", label: "Resumo", icon: BarChart3 },
  { key: "metas", label: "Metas", icon: Target },
  { key: "tarefas", label: "Tarefas", icon: ListChecks },
  { key: "editorial", label: "Linha editorial", icon: CalendarRange },
  { key: "criativos", label: "Criativos de performance", icon: Images },
  { key: "violaunch", label: "VioLaunch", icon: Rocket },
  { key: "vioday", label: "VioDay", icon: Clapperboard },
  { key: "agenda", label: "Agenda", icon: CalendarDays },
  { key: "documentos", label: "Documentos", icon: FolderOpen },
];

export function clientTabHref(clientId: string, key: string): string {
  return `/gerencial/clientes/${clientId}/${key}`;
}
