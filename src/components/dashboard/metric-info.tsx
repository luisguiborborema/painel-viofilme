"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { METRIC_GLOSSARY, type GlossaryEntry } from "@/lib/metric-glossary";
import { cn } from "@/lib/utils";

function MetricScale({ entry, size = "sm" }: { entry: GlossaryEntry; size?: "sm" | "md" }) {
  // Régua: verde→vermelho quando menor é melhor; vermelho→verde caso contrário.
  const gradient = entry.goodIsLow
    ? "from-emerald-400 to-rose-400"
    : "from-rose-400 to-emerald-400";
  return (
    <div>
      <div
        className={cn(
          "w-full rounded-full bg-gradient-to-r",
          gradient,
          size === "md" ? "h-2.5" : "h-1.5",
        )}
      />
      <div className="mt-1 flex justify-between text-[11px] text-muted">
        <span>{entry.scaleLow}</span>
        <span>{entry.scaleHigh}</span>
      </div>
    </div>
  );
}

/** Pop-up "i" compacto (não-modal). Fecha ao clicar fora. */
export function InfoPopover({
  metricKey,
  className,
}: {
  metricKey: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const entry = METRIC_GLOSSARY[metricKey];
  if (!entry) return null;

  return (
    <span className={cn("relative inline-flex", className)}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="text-muted transition-colors hover:text-ink"
        aria-label={`O que é ${entry.name}?`}
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && (
        <>
          <span
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          />
          <span className="absolute right-0 top-5 z-50 block w-60 rounded-xl border border-line bg-surface p-3 text-left shadow-xl">
            <span className="block text-sm font-semibold text-ink">
              {entry.name}
            </span>
            <span className="mt-0.5 block text-xs text-muted">
              {entry.description}
            </span>
            <span className="mt-2 block">
              <MetricScale entry={entry} />
            </span>
            <span className="mt-2 block text-xs italic text-muted">
              {entry.tip}
            </span>
          </span>
        </>
      )}
    </span>
  );
}

/** Modal "Entender os números" — glossário didático. */
export function MetricsGlossaryModal({
  open,
  onClose,
  keys,
}: {
  open: boolean;
  onClose: () => void;
  keys: string[];
}) {
  return (
    <Modal open={open} onClose={onClose} title="Entender os números" size="lg">
      <div className="space-y-4">
        {keys
          .map((k) => [k, METRIC_GLOSSARY[k]] as const)
          .filter(([, e]) => e)
          .map(([k, entry]) => (
            <div key={k} className="rounded-xl border border-line p-4">
              <p className="text-sm font-semibold text-ink">{entry.name}</p>
              <p className="mt-0.5 text-sm text-muted">{entry.description}</p>
              <div className="mt-3">
                <MetricScale entry={entry} size="md" />
              </div>
              <p className="mt-2 text-xs italic text-muted">{entry.tip}</p>
            </div>
          ))}
      </div>
    </Modal>
  );
}
