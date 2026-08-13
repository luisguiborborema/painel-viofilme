"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Database,
  FileText,
  KanbanSquare,
  LayoutDashboard,
  ListChecks,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Régua de abas do módulo Comercial (estilo HubSpot): fica sempre visível no
 * topo de todas as telas de /gerencial/comercial, funcionando como o
 * "object switcher" do CRM. As mesmas rotas também estão no menu lateral.
 */
const COMMERCIAL_TABS: { seg: string; label: string; icon: LucideIcon }[] = [
  { seg: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { seg: "pipeline", label: "Pipeline", icon: KanbanSquare },
  { seg: "atividades", label: "Atividades", icon: ListChecks },
  { seg: "listas", label: "Listas", icon: Database },
  { seg: "insights", label: "Insights", icon: BarChart3 },
  { seg: "documentos", label: "Documentos", icon: FileText },
  { seg: "configuracoes", label: "Configurações", icon: SlidersHorizontal },
];

export function ComercialNav() {
  const pathname = usePathname();
  // /gerencial/comercial/<seg>/...
  const seg = pathname.split("/")[3] ?? "dashboard";

  return (
    <div
      className="no-scrollbar mb-4 flex gap-1 overflow-x-auto border-b border-line"
      aria-label="Abas do Comercial"
    >
      {COMMERCIAL_TABS.map((t) => {
        const Icon = t.icon;
        const active = t.seg === seg;
        return (
          <Link
            key={t.seg}
            href={`/gerencial/comercial/${t.seg}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors",
              active ? "border-brand-500 text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
