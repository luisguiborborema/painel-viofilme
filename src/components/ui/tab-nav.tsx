"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type TabItem<K extends string = string> = {
  key: K;
  label: string;
  icon?: LucideIcon;
  count?: number;
};

/** Sub-navegação em pílulas (Listas, Documentos, …) — um só visual. */
export function TabNav<K extends string>({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: TabItem<K>[];
  active: K;
  onChange: (k: K) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {tabs.map((t) => {
        const on = t.key === active;
        const Icon = t.icon;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            aria-pressed={on}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors",
              on ? "border-brand-500 bg-brand-500 text-white" : "border-line bg-surface text-muted hover:text-ink",
            )}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {t.label}
            {t.count != null && (
              <span className={cn("rounded-full px-1.5 text-[11px]", on ? "bg-white/20" : "bg-subtle text-muted")}>{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
