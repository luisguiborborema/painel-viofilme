"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlignLeft,
  Building2,
  Calendar,
  Check,
  Circle,
  ClipboardCheck,
  FileText,
  Gauge,
  GitBranch,
  GripVertical,
  History,
  Link2,
  ListTodo,
  Loader2,
  SlidersHorizontal,
  Tag as TagIcon,
  Target,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CARD_PROP_PREFIX,
  resolveCardFields,
  type CardFieldSetting,
  type ResolvedCardField,
} from "@/lib/data/crm";

type LucideIcon = typeof Circle;

const ICONS: Record<string, LucideIcon> = {
  status: Circle,
  responsaveis: Users,
  valor_mensal: Wallet,
  proxima_acao: Calendar,
  probabilidade: Target,
  origem: TagIcon,
  pipeline: GitBranch,
  plano: FileText,
  descricao: AlignLeft,
  link: Link2,
  empresa: Building2,
  contatos: Users,
  campos: SlidersHorizontal,
  bant: ClipboardCheck,
  tarefas: ListTodo,
  score: Gauge,
  historico: History,
};

/**
 * Personalização visual do card/modal do negócio: o Gestor arrasta para
 * reordenar e usa o switch para mostrar/ocultar cada item. Agrupado em Campos
 * (grade) e Seções — que é como o modal renderiza.
 */
export function CardLayoutManager({
  initial,
  canEdit,
  dealProps = [],
}: {
  initial: CardFieldSetting[];
  canEdit: boolean;
  dealProps?: { key: string; label: string }[];
}) {
  const router = useRouter();
  const resolved = resolveCardFields(initial, dealProps);
  const [campos, setCampos] = useState<ResolvedCardField[]>(
    resolved.filter((f) => f.group === "grid"),
  );
  const [secoes, setSecoes] = useState<ResolvedCardField[]>(
    resolved.filter((f) => f.group === "section"),
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const drag = useRef<{ group: "grid" | "section"; index: number } | null>(null);

  if (!canEdit) {
    return (
      <p className="rounded-xl border border-line bg-canvas px-3 py-2 text-xs text-muted">
        Somente o Gestor (acesso total) pode alterar o layout do card.
      </p>
    );
  }

  const setterFor = (group: "grid" | "section") => (group === "grid" ? setCampos : setSecoes);

  function toggle(group: "grid" | "section", key: string) {
    setterFor(group)((prev) =>
      prev.map((f) => (f.key === key ? { ...f, visible: !f.visible } : f)),
    );
    setSaved(false);
  }

  function onDragEnter(group: "grid" | "section", index: number) {
    const d = drag.current;
    if (!d || d.group !== group || d.index === index) return;
    setterFor(group)((prev) => {
      const next = [...prev];
      const [moved] = next.splice(d.index, 1);
      next.splice(index, 0, moved);
      return next;
    });
    drag.current = { group, index };
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    try {
      const fields = [...campos, ...secoes].map((f) => ({ key: f.key, visible: f.visible }));
      await fetch("/api/crm/card-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectType: "deal", fields }),
      });
      setSaved(true);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Group
        title="Campos"
        hint="Aparecem na grade do topo do card."
        items={campos}
        group="grid"
        onToggle={toggle}
        onDragStart={(i) => (drag.current = { group: "grid", index: i })}
        onDragEnter={onDragEnter}
        onDragEnd={() => (drag.current = null)}
      />
      <Group
        title="Seções"
        hint="Blocos abaixo da grade (descrição, empresa, tarefas…)."
        items={secoes}
        group="section"
        onToggle={toggle}
        onDragStart={(i) => (drag.current = { group: "section", index: i })}
        onDragEnter={onDragEnter}
        onDragEnd={() => (drag.current = null)}
      />

      <div className="flex items-center justify-end gap-2">
        {saved && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
            <Check className="h-3.5 w-3.5" /> Salvo
          </span>
        )}
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Salvar layout
        </button>
      </div>
    </div>
  );
}

function Group({
  title,
  hint,
  items,
  group,
  onToggle,
  onDragStart,
  onDragEnter,
  onDragEnd,
}: {
  title: string;
  hint: string;
  items: ResolvedCardField[];
  group: "grid" | "section";
  onToggle: (group: "grid" | "section", key: string) => void;
  onDragStart: (index: number) => void;
  onDragEnter: (group: "grid" | "section", index: number) => void;
  onDragEnd: () => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink">{title}</h3>
        <span className="text-[11px] text-muted">{hint}</span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map((f, i) => {
          const Icon = f.key.startsWith(CARD_PROP_PREFIX)
            ? SlidersHorizontal
            : (ICONS[f.key] ?? Circle);
          return (
            <div
              key={f.key}
              draggable
              onDragStart={() => onDragStart(i)}
              onDragEnter={() => onDragEnter(group, i)}
              onDragOver={(e) => e.preventDefault()}
              onDragEnd={onDragEnd}
              className={cn(
                "group flex items-center gap-2.5 rounded-xl border bg-surface px-3 py-2.5 transition-colors",
                f.visible ? "border-line" : "border-dashed border-line/70 opacity-60",
              )}
            >
              <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted active:cursor-grabbing" />
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  f.visible ? "bg-brand-50 text-brand-600" : "bg-subtle text-muted",
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span
                className={cn(
                  "flex-1 truncate text-sm font-medium",
                  f.visible ? "text-ink" : "text-muted",
                )}
              >
                {f.label}
              </span>
              <Switch on={f.visible} onClick={() => onToggle(group, f.key)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="switch"
      aria-checked={on}
      title={on ? "Ocultar" : "Mostrar"}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
        on ? "bg-brand-600" : "bg-line",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
          on ? "translate-x-4" : "translate-x-0",
        )}
      />
    </button>
  );
}
