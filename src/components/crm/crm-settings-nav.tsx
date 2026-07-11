"use client";

import { useState } from "react";
import {
  ArrowDownUp,
  Copy,
  FormInput,
  GitBranch,
  LayoutGrid,
  SlidersHorizontal,
  Tags,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type SettingsSection = {
  key: string;
  label: string;
  description: string;
  node: React.ReactNode;
};

const ICONS: Record<string, LucideIcon> = {
  layout: LayoutGrid,
  properties: SlidersHorizontal,
  tags: Tags,
  pipelines: GitBranch,
  flows: Workflow,
  forms: FormInput,
  duplicates: Copy,
  import: ArrowDownUp,
};

const GROUPS: { title: string; keys: string[] }[] = [
  { title: "Personalização", keys: ["layout", "properties", "tags"] },
  { title: "Funil", keys: ["pipelines", "flows"] },
  { title: "Aquisição", keys: ["forms"] },
  { title: "Dados", keys: ["duplicates", "import"] },
];

/**
 * Navegação lateral das Configurações do CRM: categorias à esquerda, o painel
 * selecionado à direita. Substitui o scroll longo por uma "página de settings".
 */
export function CrmSettingsNav({ sections }: { sections: SettingsSection[] }) {
  const byKey = new Map(sections.map((s) => [s.key, s]));
  const [active, setActive] = useState(sections[0]?.key ?? "");
  const current = byKey.get(active) ?? sections[0];

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <nav className="shrink-0 space-y-5 lg:w-60">
        {GROUPS.map((g) => {
          const items = g.keys.map((k) => byKey.get(k)).filter(Boolean) as SettingsSection[];
          if (!items.length) return null;
          return (
            <div key={g.title}>
              <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                {g.title}
              </p>
              <div className="space-y-0.5">
                {items.map((s) => {
                  const Icon = ICONS[s.key] ?? SlidersHorizontal;
                  const on = s.key === active;
                  return (
                    <button
                      key={s.key}
                      onClick={() => setActive(s.key)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors",
                        on ? "bg-brand-600 text-white" : "text-muted hover:bg-subtle hover:text-ink",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 truncate">{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="min-w-0 flex-1">
        {current && (
          <>
            <div className="mb-4 border-b border-line pb-3">
              <h2 className="text-base font-bold text-ink">{current.label}</h2>
              <p className="mt-0.5 text-xs text-muted">{current.description}</p>
            </div>
            {current.node}
          </>
        )}
      </div>
    </div>
  );
}
