"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { CLIENT_TAB_ITEMS } from "@/lib/client-tabs-nav";

/**
 * Cabeçalho da tela do cliente: breadcrumb "Hub de clientes › aba" + o cartão
 * do cliente (slot `header`). A navegação entre abas fica no menu lateral
 * (submenu de "Hub de Clientes"); aqui o breadcrumb só reflete a aba atual.
 */
export function ClientNav({ header }: { header: React.ReactNode }) {
  const pathname = usePathname();
  const seg = pathname.split("/")[4] ?? "resumo";
  const activeLabel =
    CLIENT_TAB_ITEMS.find((i) => i.key === seg)?.label ?? "Resumo";

  return (
    <div className="space-y-4">
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
    </div>
  );
}
