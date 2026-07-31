"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CalendarRange,
  ChevronRight,
  Clapperboard,
  FolderOpen,
  Images,
  ListChecks,
  Rocket,
  Target,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  resumo: BarChart3,
  metas: Target,
  tarefas: ListChecks,
  editorial: CalendarRange,
  criativos: Images,
  violaunch: Rocket,
  vioday: Clapperboard,
  agenda: CalendarDays,
  documentos: FolderOpen,
};

export type ClientNavItem = { key: string; label: string; badge?: number };

/**
 * Cabeçalho de navegação do cliente: breadcrumb "Hub de clientes › aba" +
 * barra de abas (cada aba é uma rota própria). O cartão do cliente entra no
 * slot `header`, entre o breadcrumb e as abas. A aba ativa vem do pathname.
 */
export function ClientNav({
  clientId,
  items,
  header,
}: {
  clientId: string;
  items: ClientNavItem[];
  header: React.ReactNode;
}) {
  const pathname = usePathname();
  const seg = pathname.split("/")[4] ?? "resumo";
  const activeLabel = items.find((i) => i.key === seg)?.label ?? "Resumo";

  return (
    <div className="space-y-4">
      {/* Breadcrumb: Hub de clientes › aba atual */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link
          href="/gerencial/clientes"
          className="inline-flex items-center gap-1 font-medium text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> Hub de clientes
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-muted/50" />
        <span className="font-semibold text-ink">{activeLabel}</span>
      </nav>

      {header}

      {/* Abas como rotas */}
      <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line">
        {items.map((t) => {
          const Icon = ICONS[t.key] ?? BarChart3;
          const isActive = t.key === seg;
          return (
            <Link
              key={t.key}
              href={`/gerencial/clientes/${clientId}/${t.key}`}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "border-brand-500 text-ink"
                  : "border-transparent text-muted hover:text-ink",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
              {t.badge ? (
                <span
                  className={cn(
                    "ml-0.5 inline-flex min-w-[1.1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold",
                    isActive ? "bg-brand-500 text-white" : "bg-brand-500/15 text-brand-600",
                  )}
                >
                  {t.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
