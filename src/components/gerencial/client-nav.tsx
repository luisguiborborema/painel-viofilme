"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { CLIENT_TAB_ITEMS, clientTabHref } from "@/lib/client-tabs-nav";
import { cn } from "@/lib/utils";

/**
 * Cabeçalho da tela do cliente: breadcrumb "Hub de clientes › aba", a régua de
 * abas (cada uma é uma rota própria) e o cartão do cliente (slot `header`). As
 * mesmas abas aparecem no submenu lateral de "Hub de Clientes" — aqui elas
 * ficam sempre visíveis, sem depender do hover no menu.
 */
export function ClientNav({
  header,
  opOnly = false,
}: {
  header: React.ReactNode;
  opOnly?: boolean;
}) {
  const pathname = usePathname();
  const parts = pathname.split("/");
  const clientId = parts[3] ?? "";
  const seg = parts[4] ?? "resumo";
  // Perfil operacional não vê Metas — mesma regra da página e do menu lateral.
  const tabs = CLIENT_TAB_ITEMS.filter((t) => t.key !== "metas" || !opOnly);
  const activeLabel = tabs.find((i) => i.key === seg)?.label ?? "Resumo";

  return (
    <div className="space-y-4">
      <nav data-tour="client-tabs" className="flex items-center gap-1.5 text-sm">
        <Link
          href="/gerencial/clientes"
          className="inline-flex items-center gap-1 font-medium text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> Hub de clientes
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-muted/50" />
        <span className="font-semibold text-ink">{activeLabel}</span>
      </nav>

      <div
        className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line"
        aria-label="Abas do cliente"
      >
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = t.key === seg;
          return (
            <Link
              key={t.key}
              href={clientTabHref(clientId, t.key)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "border-brand-500 text-ink"
                  : "border-transparent text-muted hover:text-ink",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {t.label}
            </Link>
          );
        })}
      </div>

      {header}
    </div>
  );
}
