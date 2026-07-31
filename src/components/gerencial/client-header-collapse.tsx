"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "ok" | "late" | "waiting";

const TONE: Record<Tone, string> = {
  ok: "bg-emerald-500/15 text-emerald-600",
  late: "bg-rose-500/15 text-rose-500",
  waiting: "bg-amber-500/15 text-amber-600",
};

/**
 * Em abas de trabalho pesado (ex.: Linha editorial), a ficha do cliente é
 * recolhida por padrão numa barra fina — o palco fica para o conteúdo da aba.
 * O usuário expande a ficha completa quando quiser.
 */
export function ClientHeaderCollapse({
  name,
  initials,
  statusLabel,
  statusTone,
  collapsibleTabs,
  children,
}: {
  name: string;
  initials: string;
  statusLabel?: string;
  statusTone?: Tone;
  collapsibleTabs: string[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const seg = pathname.split("/")[4] ?? "resumo";
  const collapsible = collapsibleTabs.includes(seg);
  const [expanded, setExpanded] = useState(false);

  if (collapsible && !expanded) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-2.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-[11px] font-bold text-white">
            {initials}
          </span>
          <span className="truncate font-semibold text-ink">{name}</span>
          {statusLabel && statusTone && (
            <span
              className={cn(
                "hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold sm:inline-block",
                TONE[statusTone],
              )}
            >
              {statusLabel}
            </span>
          )}
        </div>
        <button
          onClick={() => setExpanded(true)}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-subtle hover:text-ink"
        >
          Ver ficha <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {collapsible && (
        <div className="flex justify-end">
          <button
            onClick={() => setExpanded(false)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-subtle hover:text-ink"
          >
            Recolher ficha <ChevronUp className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {children}
    </div>
  );
}
