"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import {
  MetricSection,
  type MetricDef,
  type MetricGroup,
} from "@/components/dashboard/metric-chart-panel";
import { usePersistentState } from "@/lib/use-persistent-state";
import { cn } from "@/lib/utils";

const GROUPS: MetricGroup[] = ["Orgânico", "Pago", "Financeiro"];

export function HomeMetrics({
  pool,
  defaultKeys,
  rightColumn,
}: {
  pool: MetricDef[];
  defaultKeys: string[];
  rightColumn?: React.ReactNode;
}) {
  const [keys, setKeys] = usePersistentState("vio-home-metrics", defaultKeys);
  const [open, setOpen] = useState(false);

  const valid = keys.filter((k) => pool.some((m) => m.key === k));
  const selectedKeys = valid.length === 4 ? valid : defaultKeys;
  const metrics = selectedKeys
    .map((k) => pool.find((m) => m.key === k))
    .filter((m): m is MetricDef => Boolean(m));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-ink"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" /> Personalizar métricas
        </button>
      </div>

      <MetricSection metrics={metrics} defaultKey={selectedKeys[0]} rightColumn={rightColumn} />

      <CustomizeMetricsModal
        open={open}
        onClose={() => setOpen(false)}
        pool={pool}
        selected={selectedKeys}
        onSave={(next) => {
          setKeys(next);
          setOpen(false);
        }}
      />
    </div>
  );
}

function CustomizeMetricsModal({
  open,
  onClose,
  pool,
  selected,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  pool: MetricDef[];
  selected: string[];
  onSave: (keys: string[]) => void;
}) {
  const [working, setWorking] = useState<string[]>(selected);
  const count = working.length;
  const full = count >= 4;

  // Reinicia a seleção de trabalho sempre que o modal abre.
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setWorking(selected);
  }

  function toggle(key: string) {
    setWorking((w) =>
      w.includes(key) ? w.filter((k) => k !== key) : full ? w : [...w, key],
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Personalizar métricas"
      description={`Escolha exatamente 4 métricas para os cards. (${count}/4)`}
      size="md"
      footer={
        <>
          <button
            disabled={count !== 4}
            onClick={() => onSave(working)}
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-40"
          >
            Salvar
          </button>
          <button
            onClick={onClose}
            className="rounded-xl border border-line bg-subtle px-4 py-2.5 text-sm font-medium text-ink hover:bg-subtle-strong"
          >
            Cancelar
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {GROUPS.map((group) => {
          const items = pool.filter((m) => m.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group}>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                {group}
              </p>
              <div className="space-y-1">
                {items.map((m) => {
                  const on = working.includes(m.key);
                  const blocked = !on && full;
                  return (
                    <button
                      key={m.key}
                      onClick={() => toggle(m.key)}
                      disabled={blocked}
                      title={blocked ? "Desmarque outra métrica primeiro" : undefined}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                        on ? "bg-brand-500/10 text-ink" : "text-ink hover:bg-subtle",
                        blocked && "cursor-not-allowed opacity-40",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded border",
                          on ? "border-brand-500 bg-brand-500 text-white" : "border-line",
                        )}
                      >
                        {on && <span className="text-[10px]">✓</span>}
                      </span>
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: m.color }}
                      />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
