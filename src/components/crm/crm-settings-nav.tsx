"use client";

import { useEffect, useState } from "react";
import {
  ArrowDownUp,
  CalendarClock,
  Copy,
  FileText,
  FormInput,
  Gauge,
  GitBranch,
  LayoutGrid,
  Link2,
  Package,
  Plug,
  Search,
  SlidersHorizontal,
  Snowflake,
  Tags,
  Target,
  Waypoints,
  Workflow,
  XCircle,
  Zap,
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
  workflows: Waypoints,
  flows: Workflow,
  scripts: FileText,
  automation: Zap,
  "loss-reasons": XCircle,
  "freeze-reasons": Snowflake,
  routines: CalendarClock,
  scheduling: Link2,
  goals: Target,
  leadscore: Gauge,
  forms: FormInput,
  duplicates: Copy,
  import: ArrowDownUp,
  channels: Plug,
  products: Package,
};

const GROUPS: { title: string; keys: string[] }[] = [
  { title: "Personalização", keys: ["layout", "properties", "tags"] },
  { title: "Funil", keys: ["pipelines", "workflows", "flows", "scripts", "automation", "loss-reasons", "freeze-reasons"] },
  { title: "Rotina & Agenda", keys: ["routines", "scheduling"] },
  { title: "Metas & Score", keys: ["goals", "leadscore"] },
  { title: "Aquisição", keys: ["forms"] },
  { title: "Dados", keys: ["duplicates", "import"] },
  { title: "Integrações", keys: ["channels", "products"] },
];

/**
 * Navegação lateral das Configurações do CRM: categorias à esquerda, o painel
 * selecionado à direita. Substitui o scroll longo por uma "página de settings".
 */
export function CrmSettingsNav({ sections }: { sections: SettingsSection[] }) {
  const byKey = new Map(sections.map((s) => [s.key, s]));
  const [active, setActive] = useState(sections[0]?.key ?? "");
  const [q, setQ] = useState("");
  const current = byKey.get(active) ?? sections[0];
  const term = q.trim().toLowerCase();
  const matches = (s: SettingsSection) => !term || s.label.toLowerCase().includes(term) || s.key.includes(term);

  // Âncora direta (§1): abre a seção pedida via #hash e reage a atalhos externos.
  useEffect(() => {
    const apply = () => {
      const h = decodeURIComponent(window.location.hash.replace("#", ""));
      if (h && sections.some((s) => s.key === h)) setActive(h);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function select(k: string) {
    setActive(k);
    if (typeof window !== "undefined") window.history.replaceState(null, "", `#${k}`);
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <nav className="shrink-0 space-y-5 lg:w-60">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar configuração…"
            className="w-full rounded-lg border border-line bg-surface py-1.5 pl-8 pr-2 text-sm text-ink outline-none focus:border-brand-400"
          />
        </div>
        {GROUPS.map((g) => {
          const items = (g.keys.map((k) => byKey.get(k)).filter(Boolean) as SettingsSection[]).filter(matches);
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
                      onClick={() => select(s.key)}
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
