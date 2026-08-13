"use client";

import type { ReactNode } from "react";
import { CalendarClock, GitBranch, Target, Users, Wallet } from "lucide-react";
import { cn, formatBRL } from "@/lib/utils";
import { dayMonth } from "@/lib/datetime";
import type { CrmLead, Stage } from "@/lib/data/crm";

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function Tile({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Wallet;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-[128px] flex-1 border-r border-line px-4 py-2.5 last:border-r-0">
      <p className="mb-0.5 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
        <Icon className="h-3 w-3" /> {label}
      </p>
      <div className="text-sm font-semibold text-ink">{children}</div>
    </div>
  );
}

/**
 * Barra de highlights do negócio (estilo HubSpot): tiles de KPI logo abaixo do
 * cabeçalho da ficha. Só leitura — a edição fica nos controles de cada zona.
 */
export function DealHighlights({ lead, stages }: { lead: CrmLead; stages: Stage[] }) {
  const openStages = stages.filter((s) => s.kind !== "lost");
  const idx = openStages.findIndex((s) => s.key === lead.stage);
  const current = stages.find((s) => s.key === lead.stage);
  const owners = lead.assignees?.length ? lead.assignees : lead.owner ? [lead.owner] : [];

  return (
    <div className="flex items-stretch overflow-x-auto border-b border-line bg-surface">
      <Tile icon={Wallet} label="Valor">
        {formatBRL(lead.monthlyValue)}
        <span className="text-xs font-normal text-muted">/mês</span>
      </Tile>
      <Tile icon={GitBranch} label="Etapa">
        <span className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: current?.color ?? "#64748b" }}
          />
          <span className="truncate">{current?.label ?? lead.stage}</span>
        </span>
        {idx >= 0 && openStages.length > 1 && (
          <div className="mt-1.5 flex gap-0.5">
            {openStages.map((s, i) => (
              <span
                key={s.key}
                className={cn("h-1 flex-1 rounded-full", i <= idx ? "bg-brand-500" : "bg-subtle-strong")}
              />
            ))}
          </div>
        )}
      </Tile>
      <Tile icon={Target} label="Probabilidade">{lead.probability}%</Tile>
      <Tile icon={CalendarClock} label="Fechamento previsto">
        {lead.expectedCloseAt ? dayMonth(lead.expectedCloseAt) : <span className="text-muted">—</span>}
      </Tile>
      <Tile icon={Users} label="Dono">
        {owners.length ? (
          <span className="flex items-center gap-1.5">
            <span className="flex -space-x-1.5">
              {owners.slice(0, 3).map((o) => (
                <span
                  key={o}
                  title={o}
                  className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-brand-500 text-[10px] font-semibold text-white"
                >
                  {initials(o)}
                </span>
              ))}
            </span>
            {owners.length === 1 && <span className="truncate">{owners[0]}</span>}
          </span>
        ) : (
          <span className="text-muted">—</span>
        )}
      </Tile>
    </div>
  );
}
