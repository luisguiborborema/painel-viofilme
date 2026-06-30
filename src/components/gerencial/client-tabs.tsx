"use client";

import { useState } from "react";
import {
  BarChart3,
  CalendarDays,
  CalendarRange,
  FolderOpen,
  Images,
  ListChecks,
  Rocket,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  resumo: BarChart3,
  tarefas: ListChecks,
  editorial: CalendarRange,
  criativos: Images,
  violaunch: Rocket,
  agenda: CalendarDays,
  documentos: FolderOpen,
};

export type ClientTab = {
  key: string;
  label: string;
  content: React.ReactNode;
};

export function ClientTabs({ tabs }: { tabs: ClientTab[] }) {
  const [active, setActive] = useState(tabs[0]?.key);
  const current = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div className="space-y-4">
      <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((t) => {
          const Icon = ICONS[t.key] ?? BarChart3;
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "border-brand-500 text-ink"
                  : "border-transparent text-muted hover:text-ink",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div>{current?.content}</div>
    </div>
  );
}
