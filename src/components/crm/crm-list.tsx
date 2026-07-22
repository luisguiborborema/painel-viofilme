"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpDown,
  Check,
  Download,
  Search,
  Snowflake,
  Tag as TagIcon,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { cn, formatBRL } from "@/lib/utils";
import { dayMonth } from "@/lib/datetime";
import {
  LEAD_PRIORITIES,
  stageLabel,
  type Company,
  type CrmLeadCard,
  type Pipeline,
  type Tag,
} from "@/lib/data/crm";
import type { Attendant } from "@/lib/data/inbox";
import { AvatarStack } from "@/components/ui/avatar";

type SortKey = "name" | "empresa" | "stage" | "owner" | "value" | "priority" | "days";
type StatusFilter = "abertos" | "ganhos" | "perdidos" | "congelados" | "todos";

const PRIORITY_ORDER: Record<string, number> = { urgente: 4, alta: 3, media: 2, baixa: 1 };

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "abertos", label: "Abertos" },
  { key: "ganhos", label: "Ganhos" },
  { key: "perdidos", label: "Perdidos" },
  { key: "congelados", label: "Congelados" },
  { key: "todos", label: "Todos" },
];

export function CrmList({
  cards,
  pipelines = [],
  tags = [],
  companies = [],
  team = [],
  teamMembers = [],
  currentUser = "",
}: {
  cards: CrmLeadCard[];
  pipelines?: Pipeline[];
  tags?: Tag[];
  companies?: Company[];
  team?: string[];
  teamMembers?: Attendant[];
  currentUser?: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(cards);
  const [search, setSearch] = useState("");
  const [pipelineFilter, setPipelineFilter] = useState<string>("all");
  const [status, setStatus] = useState<StatusFilter>("abertos");
  const [mine, setMine] = useState(false);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("days");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const companyById = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies]);
  const stageMetaByKey = useMemo(() => {
    const m = new Map<string, { label: string; color: string; pipeline: string }>();
    for (const p of pipelines) {
      for (const s of p.stages) m.set(`${p.id}:${s.key}`, { label: s.label, color: s.color, pipeline: p.name });
    }
    return m;
  }, [pipelines]);

  function companyName(c: CrmLeadCard) {
    return (c.companyId && companyById.get(c.companyId)?.name) || c.contactName || "—";
  }
  function stageMeta(c: CrmLeadCard) {
    return (
      stageMetaByKey.get(`${c.pipelineId ?? ""}:${c.stage}`) ?? {
        label: stageLabel(c.stage),
        color: "#64748b",
        pipeline: "—",
      }
    );
  }
  const ownerOf = (c: CrmLeadCard) => (c.assignees?.length ? c.assignees : c.owner ? [c.owner] : []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = rows.filter((c) => {
      if (pipelineFilter !== "all" && (c.pipelineId ?? "") !== pipelineFilter) return false;
      const frozen = Boolean(c.frozenAt);
      if (status === "abertos" && (frozen || c.stage === "ganho" || c.stage === "perdido")) return false;
      if (status === "ganhos" && c.stage !== "ganho") return false;
      if (status === "perdidos" && c.stage !== "perdido") return false;
      if (status === "congelados" && !frozen) return false;
      if (mine && !ownerOf(c).includes(currentUser)) return false;
      if (tagFilter && !c.tags?.includes(tagFilter)) return false;
      if (term) {
        const hay = `${c.name} ${c.contactName ?? ""} ${companyName(c)}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      switch (sortKey) {
        case "name": av = a.name.toLowerCase(); bv = b.name.toLowerCase(); break;
        case "empresa": av = companyName(a).toLowerCase(); bv = companyName(b).toLowerCase(); break;
        case "stage": av = stageMeta(a).label.toLowerCase(); bv = stageMeta(b).label.toLowerCase(); break;
        case "owner": av = (a.owner ?? "").toLowerCase(); bv = (b.owner ?? "").toLowerCase(); break;
        case "value": av = a.monthlyValue; bv = b.monthlyValue; break;
        case "priority": av = PRIORITY_ORDER[a.priority ?? "media"] ?? 2; bv = PRIORITY_ORDER[b.priority ?? "media"] ?? 2; break;
        case "days": av = a.daysInStage; bv = b.daysInStage; break;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, pipelineFilter, status, mine, tagFilter, sortKey, sortDir, currentUser]);

  const totalValue = filtered.reduce((s, c) => s + c.monthlyValue, 0);
  const allSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "name" || key === "empresa" || key === "stage" || key === "owner" ? "asc" : "desc");
    }
  }
  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(filtered.map((c) => c.id)));
  }

  function post(payload: Record<string, unknown>) {
    return fetch("/api/crm/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }
  const selectedIds = () => [...selected];

  async function bulkAssign(name: string) {
    const ids = selectedIds();
    setBusy(true);
    setRows((prev) => prev.map((c) => (selected.has(c.id) ? { ...c, owner: name, assignees: [name] } : c)));
    await Promise.all(ids.map((id) => post({ action: "set-assignees", id, assignees: [name] }).catch(() => {})));
    setBusy(false);
    setSelected(new Set());
    router.refresh();
  }
  async function bulkTag(tagId: string) {
    const ids = selectedIds();
    setBusy(true);
    setRows((prev) => prev.map((c) => (selected.has(c.id) ? { ...c, tags: [...new Set([...(c.tags ?? []), tagId])] } : c)));
    await Promise.all(
      ids.map((id) => {
        const card = rows.find((c) => c.id === id);
        const nextTags = [...new Set([...(card?.tags ?? []), tagId])];
        return fetch("/api/crm/object", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ objectType: "deal", id, tags: nextTags }),
        }).catch(() => {});
      }),
    );
    setBusy(false);
    setSelected(new Set());
    router.refresh();
  }
  async function bulkFreeze() {
    const ids = selectedIds();
    setBusy(true);
    setRows((prev) => prev.map((c) => (selected.has(c.id) ? { ...c, frozenAt: new Date().toISOString() } : c)));
    await Promise.all(ids.map((id) => post({ action: "freeze", id }).catch(() => {})));
    setBusy(false);
    setSelected(new Set());
    router.refresh();
  }
  async function bulkDelete() {
    const ids = selectedIds();
    setBusy(true);
    setRows((prev) => prev.filter((c) => !selected.has(c.id)));
    await Promise.all(ids.map((id) => post({ action: "delete", id }).catch(() => {})));
    setBusy(false);
    setSelected(new Set());
    setConfirmDelete(false);
    router.refresh();
  }

  function exportCsv(which: "selecionados" | "todos") {
    const list = which === "selecionados" ? filtered.filter((c) => selected.has(c.id)) : filtered;
    const header = ["negocio", "empresa", "contato", "funil", "estagio", "responsavel", "valor_mensal", "prioridade", "dias_na_etapa", "proxima_acao"];
    const esc = (v: string) => (v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = [header.join(",")];
    for (const c of list) {
      const m = stageMeta(c);
      lines.push(
        [
          c.name,
          companyName(c),
          c.contactName ?? "",
          m.pipeline,
          m.label,
          ownerOf(c).join(" / "),
          String(c.monthlyValue),
          c.priority ?? "media",
          String(c.daysInStage),
          c.nextTaskDue ? dayMonth(c.nextTaskDue) : "",
        ].map((x) => esc(String(x))).join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `negocios-${which}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar negócio, empresa ou contato…"
            className="w-64 rounded-xl border border-line bg-surface py-2 pl-8 pr-3 text-sm text-ink outline-none focus:border-brand-400"
          />
        </div>
        <select
          value={pipelineFilter}
          onChange={(e) => setPipelineFilter(e.target.value)}
          className="rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
        >
          <option value="all">Todos os funis</option>
          {pipelines.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <div className="inline-flex rounded-xl border border-line p-0.5">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setStatus(t.key)}
              className={cn("rounded-lg px-2.5 py-1.5 text-xs font-semibold", status === t.key ? "bg-ink text-surface" : "text-muted hover:bg-subtle")}
            >
              {t.label}
            </button>
          ))}
        </div>
        {currentUser && (
          <button
            onClick={() => setMine((m) => !m)}
            className={cn("rounded-full px-3 py-1.5 text-xs font-semibold", mine ? "bg-brand-600 text-white" : "bg-subtle text-muted hover:bg-subtle-strong")}
          >
            Meus
          </button>
        )}
        {tags.length > 0 && (
          <select
            value={tagFilter ?? ""}
            onChange={(e) => setTagFilter(e.target.value || null)}
            className="rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
          >
            <option value="">Todas as tags</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
        <button
          onClick={() => exportCsv("todos")}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-subtle"
        >
          <Download className="h-4 w-4" /> Exportar
        </button>
      </div>

      <p className="text-sm text-muted">
        {filtered.length} negócios · <span className="font-semibold text-ink">{formatBRL(totalValue)}</span>
      </p>

      {/* Barra de ações em massa */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-400/40 bg-brand-50/50 px-3 py-2">
          <span className="text-sm font-semibold text-ink">{selected.size} selecionado{selected.size > 1 ? "s" : ""}</span>
          <BulkMenu icon={UserPlus} label="Atribuir" options={team.map((n) => ({ key: n, label: n }))} onPick={bulkAssign} disabled={busy} />
          <BulkMenu icon={TagIcon} label="Tag" options={tags.map((t) => ({ key: t.id, label: t.name }))} onPick={bulkTag} disabled={busy} />
          <button onClick={bulkFreeze} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-subtle disabled:opacity-60">
            <Snowflake className="h-3.5 w-3.5" /> Congelar
          </button>
          <button onClick={() => exportCsv("selecionados")} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-subtle">
            <Download className="h-3.5 w-3.5" /> Exportar
          </button>
          {confirmDelete ? (
            <span className="inline-flex items-center gap-1.5">
              <button onClick={bulkDelete} disabled={busy} className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60">
                Confirmar exclusão
              </button>
              <button onClick={() => setConfirmDelete(false)} className="rounded-lg px-2 py-1.5 text-xs text-muted hover:bg-subtle">Cancelar</button>
            </span>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-500/10">
              <Trash2 className="h-3.5 w-3.5" /> Excluir
            </button>
          )}
          <button onClick={() => setSelected(new Set())} className="ml-auto inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
            <X className="h-3.5 w-3.5" /> limpar
          </button>
        </div>
      )}

      {/* Tabela */}
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-canvas text-left text-xs text-muted">
              <th className="w-10 px-3 py-2.5">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 rounded border-line accent-brand-600" />
              </th>
              <Th label="Negócio" onClick={() => toggleSort("name")} active={sortKey === "name"} dir={sortDir} />
              <Th label="Empresa" onClick={() => toggleSort("empresa")} active={sortKey === "empresa"} dir={sortDir} />
              <Th label="Funil / Estágio" onClick={() => toggleSort("stage")} active={sortKey === "stage"} dir={sortDir} />
              <Th label="Responsável" onClick={() => toggleSort("owner")} active={sortKey === "owner"} dir={sortDir} />
              <Th label="Valor" onClick={() => toggleSort("value")} active={sortKey === "value"} dir={sortDir} right />
              <Th label="Prioridade" onClick={() => toggleSort("priority")} active={sortKey === "priority"} dir={sortDir} />
              <Th label="Dias" onClick={() => toggleSort("days")} active={sortKey === "days"} dir={sortDir} right />
              <th className="px-3 py-2.5">Próx. ação</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-muted">Nenhum negócio com esses filtros.</td>
              </tr>
            )}
            {filtered.map((c) => {
              const m = stageMeta(c);
              const pr = LEAD_PRIORITIES.find((x) => x.key === (c.priority ?? "media"));
              const owners = ownerOf(c);
              const isSel = selected.has(c.id);
              return (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/gerencial/crm/${c.id}`)}
                  className={cn("cursor-pointer border-b border-line last:border-0 hover:bg-subtle/60", isSel && "bg-brand-50/40")}
                >
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={isSel} onChange={() => toggleRow(c.id)} className="h-4 w-4 rounded border-line accent-brand-600" />
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-ink">{c.name}</p>
                    {c.contactName && <p className="text-xs text-muted">{c.contactName}</p>}
                  </td>
                  <td className="px-3 py-2.5 text-ink">{companyName(c)}</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.color }} />
                      <span className="text-ink">{m.label}</span>
                    </span>
                    <p className="text-[11px] text-muted">{m.pipeline}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    {owners.length ? <AvatarStack names={owners} team={teamMembers} /> : <span className="text-muted">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-ink">{formatBRL(c.monthlyValue)}</td>
                  <td className="px-3 py-2.5">
                    {pr && (
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", pr.chip)}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", pr.dot)} /> {pr.label}
                      </span>
                    )}
                  </td>
                  <td className={cn("px-3 py-2.5 text-right", c.rot === "stale" ? "font-semibold text-rose-500" : "text-muted")}>
                    {c.daysInStage}
                    {(c.noShowCount ?? 0) > 0 && <span className="ml-1 text-[10px] text-rose-500">·{c.noShowCount}✕</span>}
                  </td>
                  <td className="px-3 py-2.5 text-muted">{c.nextTaskDue ? dayMonth(c.nextTaskDue) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ label, onClick, active, dir, right }: { label: string; onClick: () => void; active: boolean; dir: "asc" | "desc"; right?: boolean }) {
  return (
    <th className="px-3 py-2.5 font-medium">
      <button onClick={onClick} className={cn("inline-flex items-center gap-1 hover:text-ink", active && "text-ink", right && "flex-row-reverse")}>
        {label}
        <ArrowUpDown className={cn("h-3 w-3", active ? "opacity-100" : "opacity-30")} />
        {active && <span className="text-[9px]">{dir === "asc" ? "▲" : "▼"}</span>}
      </button>
    </th>
  );
}

function BulkMenu({
  icon: Icon,
  label,
  options,
  onPick,
  disabled,
}: {
  icon: typeof UserPlus;
  label: string;
  options: { key: string; label: string }[];
  onPick: (key: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-subtle disabled:opacity-60"
      >
        <Icon className="h-3.5 w-3.5" /> {label}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 max-h-64 w-52 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-xl">
            {options.length === 0 && <p className="px-2 py-1.5 text-xs text-muted">Nada disponível.</p>}
            {options.map((o) => (
              <button
                key={o.key}
                onClick={() => {
                  onPick(o.key);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-subtle"
              >
                <Check className="h-3.5 w-3.5 text-brand-500 opacity-0" />
                <span className="flex-1 text-ink">{o.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
