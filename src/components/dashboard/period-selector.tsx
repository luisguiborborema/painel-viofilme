"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type PeriodOption = { label: string; value: string };

const DEFAULT_OPTIONS: PeriodOption[] = [
  { label: "Últimos 30 dias", value: "30d" },
  { label: "Este mês", value: "month" },
  { label: "Últimos 3 meses", value: "3m" },
  { label: "Este ano", value: "year" },
];

/**
 * Seletor de período reutilizável (Campanhas/Resultados). Hoje é client-side
 * sobre dados mock; quando ligar ao Supabase, passar `value`/`onChange` e
 * propagar o intervalo para gráficos e tabelas.
 */
export function PeriodSelector({
  options = DEFAULT_OPTIONS,
  value,
  onChange,
}: {
  options?: PeriodOption[];
  value?: string;
  onChange?: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [internal, setInternal] = useState(options[0]?.value);
  const current = value ?? internal;
  const label = options.find((o) => o.value === current)?.label ?? options[0]?.label;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink transition-colors hover:bg-subtle"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {label}
        <ChevronDown className="h-4 w-4 text-muted" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute right-0 z-20 mt-2 w-48 rounded-xl border border-line bg-surface p-1.5 shadow-lg"
          >
            {options.map((o) => {
              const active = o.value === current;
              return (
                <button
                  key={o.value}
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => {
                    if (value === undefined) setInternal(o.value);
                    onChange?.(o.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors",
                    active
                      ? "bg-brand-500/15 text-brand-300"
                      : "text-ink hover:bg-subtle",
                  )}
                >
                  <span className="flex-1 text-left">{o.label}</span>
                  {active && <Check className="h-4 w-4" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
