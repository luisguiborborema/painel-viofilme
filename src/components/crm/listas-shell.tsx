"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownUp,
  Columns3,
  Download,
  Filter,
  GitMerge,
  Plus,
  Save,
  Search,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import type { Tag } from "@/lib/data/crm";
import {
  applyConditions,
  applyLens,
  CONDITION_OPS,
  type Condition,
  type FieldDef,
  type Lens,
  type SavedView,
} from "@/lib/data/listas";

/** Coluna da tabela: usada para renderizar e exportar (CSV). */
export type Col<T> = {
  key: string;
  header: string;
  sortKey?: string; // key de FieldDef p/ ordenar
  cell: (row: T) => ReactNode;
  csv: (row: T) => string;
  align?: "left" | "right";
  hideable?: boolean;
};

type RowBase = { id: string; name: string; tags: string[]; hasDeal: boolean; companyId?: string };

const LENS_LABELS: Record<Lens, string> = {
  todos: "Todos",
  com_negocio: "Com negócio",
  sem_negocio: "Sem negócio",
};

/**
 * Casca genérica das listas Pessoas/Empresas: busca, condições empilháveis,
 * visões salvas, lente com/sem negócio, colunas configuráveis, seleção em massa
 * e ações em lote (atribuir, marcar tag, criar negócio, exportar, excluir,
 * mesclar). O corpo da tabela vem por configuração de colunas.
 */
export function ListaShell<T extends RowBase>({
  scope,
  rows,
  fields,
  columns,
  searchGet,
  savedViews,
  tags,
  team,
  newButton,
  onOpenRow,
}: {
  scope: "pessoas" | "empresas";
  rows: T[];
  fields: FieldDef<T>[];
  columns: Col<T>[];
  searchGet: (row: T) => string;
  savedViews: SavedView[];
  tags: Tag[];
  team: string[];
  newButton: ReactNode;
  onOpenRow: (row: T) => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [lens, setLens] = useState<Lens>("todos");
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [showConditions, setShowConditions] = useState(false);
  const [showCols, setShowCols] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const noun = scope === "pessoas" ? "pessoa" : "empresa";
  const nounPlural = scope === "pessoas" ? "pessoas" : "empresas";

  const filtered = useMemo(() => {
    let out = rows;
    const term = q.trim().toLowerCase();
    if (term) out = out.filter((r) => searchGet(r).toLowerCase().includes(term));
    out = applyLens(out, lens);
    out = applyConditions(out, conditions, fields);
    const def = fields.find((f) => f.key === sortKey);
    if (def) {
      const dir = sortDir === "asc" ? 1 : -1;
      out = [...out].sort((a, b) => {
        const av = def.get(a);
        const bv = def.get(b);
        if (def.type === "number") return ((Number(av) || 0) - (Number(bv) || 0)) * dir;
        return String(Array.isArray(av) ? av.join(" ") : av ?? "").localeCompare(
          String(Array.isArray(bv) ? bv.join(" ") : bv ?? ""),
        ) * dir;
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, lens, conditions, sortKey, sortDir]);

  const visibleCols = columns.filter((c) => !hidden.has(c.key));
  const allChecked = filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  function toggleSort(key?: string) {
    if (!key) return;
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function toggleAll() {
    setSelected((prev) => {
      if (filtered.every((r) => prev.has(r.id))) return new Set();
      return new Set(filtered.map((r) => r.id));
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedRows = filtered.filter((r) => selected.has(r.id));

  // ── Ações em massa ─────────────────────────────────────────────────────────
  async function post(url: string, body: unknown) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
  }

  async function runBulk(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
      setSelected(new Set());
      router.refresh();
    }
  }

  const objectType = scope === "pessoas" ? "contact" : "company";

  function bulkAssign(owner: string) {
    if (!owner) return;
    void runBulk(async () => {
      await Promise.all(
        selectedRows.map((r) => post("/api/crm/object", { objectType, id: r.id, fields: { owner } })),
      );
    });
  }

  function bulkTag(tagId: string) {
    if (!tagId) return;
    void runBulk(async () => {
      await Promise.all(
        selectedRows.map((r) =>
          post("/api/crm/object", { objectType, id: r.id, tags: Array.from(new Set([...(r.tags ?? []), tagId])) }),
        ),
      );
    });
  }

  function bulkCreateDeal() {
    void runBulk(async () => {
      await Promise.all(
        selectedRows.map((r) => {
          const payload =
            scope === "pessoas"
              ? {
                  action: "create",
                  name: r.name,
                  companyId: r.companyId ?? undefined,
                  contactId: r.id,
                  stage: "sdr_contactar_urgente",
                  pipelineId: "11111111-1111-4111-8111-111111111111",
                  originKind: "outbound",
                }
              : {
                  action: "create",
                  name: r.name,
                  companyId: r.id,
                  allowNoContact: true,
                  stage: "sdr_contactar_urgente",
                  pipelineId: "11111111-1111-4111-8111-111111111111",
                  originKind: "outbound",
                };
          return post("/api/crm/leads", payload);
        }),
      );
    });
  }

  function bulkDelete() {
    if (!window.confirm(`Excluir ${selectedRows.length} ${selectedRows.length === 1 ? noun : nounPlural}?`)) return;
    const url = scope === "pessoas" ? "/api/crm/contacts" : "/api/crm/companies";
    void runBulk(async () => {
      await Promise.all(selectedRows.map((r) => post(url, { action: "delete", id: r.id })));
    });
  }

  function bulkMerge() {
    if (selectedRows.length < 2) {
      window.alert("Selecione ao menos 2 registros para mesclar.");
      return;
    }
    const [primary, ...rest] = selectedRows;
    if (!window.confirm(`Mesclar ${rest.length} em "${primary.name}"? Os demais serão apagados.`)) return;
    void runBulk(async () => {
      await post("/api/crm/merge", { type: objectType, primaryId: primary.id, mergeIds: rest.map((r) => r.id) });
    });
  }

  function exportCsv() {
    const cols = visibleCols;
    const head = cols.map((c) => c.header).join(";");
    const lines = (selectedRows.length ? selectedRows : filtered).map((r) =>
      cols.map((c) => `"${c.csv(r).replace(/"/g, '""')}"`).join(";"),
    );
    const csv = [head, ...lines].join("\n");
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${nounPlural}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ── Condições ──────────────────────────────────────────────────────────────
  function addCondition() {
    setConditions((prev) => [...prev, { field: fields[0].key, op: "contem", value: "" }]);
    setShowConditions(true);
  }
  function updateCondition(i: number, patch: Partial<Condition>) {
    setConditions((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function removeCondition(i: number) {
    setConditions((prev) => prev.filter((_, idx) => idx !== i));
  }

  // ── Visões salvas ──────────────────────────────────────────────────────────
  const myViews = savedViews.filter((v) => v.scope === scope);
  function loadView(v: SavedView) {
    setConditions(v.conditions);
    setLens(v.lens ?? "todos");
    setShowConditions(v.conditions.length > 0);
  }
  async function saveView() {
    const name = window.prompt("Nome da visão salva:");
    if (!name?.trim()) return;
    await post("/api/crm/saved-views", { action: "create", scope, name: name.trim(), conditions, lens });
    router.refresh();
  }
  async function deleteView(id: string) {
    if (!window.confirm("Excluir esta visão?")) return;
    await post("/api/crm/saved-views", { action: "delete", id });
    router.refresh();
  }

  const activeConditions = conditions.filter((c) => c.op === "vazio" || c.op === "preenchido" || c.value.trim());

  return (
    <div className="space-y-3">
      {/* Visões salvas */}
      {(myViews.length > 0 || activeConditions.length > 0 || lens !== "todos") && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted">Visões:</span>
          {myViews.map((v) => (
            <span
              key={v.id}
              className="group inline-flex items-center gap-1 rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink"
            >
              <button type="button" onClick={() => loadView(v)} className="hover:text-brand-500">
                {v.name}
              </button>
              <button type="button" onClick={() => deleteView(v.id)} className="text-muted hover:text-red-500">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {(activeConditions.length > 0 || lens !== "todos") && (
            <button
              type="button"
              onClick={saveView}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-3 py-1 text-xs text-muted hover:border-brand-400 hover:text-brand-500"
            >
              <Save className="h-3 w-3" /> Salvar visão
            </button>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {filtered.length} {filtered.length === 1 ? noun : nounPlural}
          {filtered.length !== rows.length && ` de ${rows.length}`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Buscar ${noun}…`}
              className="w-56 rounded-xl border border-line bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-brand-400"
            />
          </div>
          {/* Lente com/sem negócio */}
          <div className="inline-flex rounded-xl border border-line bg-surface p-0.5 text-xs">
            {(["todos", "com_negocio", "sem_negocio"] as Lens[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLens(l)}
                className={`rounded-lg px-2.5 py-1.5 font-medium transition ${
                  lens === l ? "bg-brand-500 text-white" : "text-muted hover:text-ink"
                }`}
              >
                {LENS_LABELS[l]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => (showConditions ? setShowConditions(false) : addCondition())}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm ${
              activeConditions.length ? "border-brand-400 text-brand-600" : "border-line text-muted hover:text-ink"
            }`}
          >
            <Filter className="h-4 w-4" /> Filtros{activeConditions.length ? ` (${activeConditions.length})` : ""}
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowCols((s) => !s)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm text-muted hover:text-ink"
            >
              <Columns3 className="h-4 w-4" /> Colunas
            </button>
            {showCols && (
              <div className="absolute right-0 z-20 mt-1 w-52 rounded-xl border border-line bg-surface p-2 shadow-lg">
                {columns.filter((c) => c.hideable).map((c) => (
                  <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-black/5">
                    <input
                      type="checkbox"
                      checked={!hidden.has(c.key)}
                      onChange={() =>
                        setHidden((prev) => {
                          const next = new Set(prev);
                          if (next.has(c.key)) next.delete(c.key);
                          else next.add(c.key);
                          return next;
                        })
                      }
                    />
                    {c.header}
                  </label>
                ))}
              </div>
            )}
          </div>
          {newButton}
        </div>
      </div>

      {/* Painel de condições */}
      {showConditions && (
        <div className="space-y-2 rounded-xl border border-line bg-surface p-3">
          {conditions.length === 0 && <p className="text-xs text-muted">Nenhuma condição. Adicione uma abaixo.</p>}
          {conditions.map((c, i) => {
            const def = fields.find((f) => f.key === c.field);
            const ops = CONDITION_OPS.filter((o) => o.forType.includes(def?.type ?? "text"));
            const needsValue = c.op !== "vazio" && c.op !== "preenchido";
            return (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <select
                  value={c.field}
                  onChange={(e) => updateCondition(i, { field: e.target.value, op: "contem" })}
                  className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
                >
                  {fields.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <select
                  value={c.op}
                  onChange={(e) => updateCondition(i, { op: e.target.value as Condition["op"] })}
                  className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
                >
                  {ops.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {needsValue && (
                  <input
                    value={c.value}
                    onChange={(e) => updateCondition(i, { value: e.target.value })}
                    placeholder="valor"
                    className="w-40 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
                  />
                )}
                <button type="button" onClick={() => removeCondition(i)} className="text-muted hover:text-red-500">
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={addCondition}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-500"
          >
            <Plus className="h-3 w-3" /> Adicionar condição
          </button>
        </div>
      )}

      {/* Barra de ações em massa */}
      {selectedRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-400 bg-brand-50/60 px-3 py-2 text-sm">
          <span className="font-medium text-brand-700">{selectedRows.length} selecionado(s)</span>
          <select
            defaultValue=""
            disabled={busy}
            onChange={(e) => {
              bulkAssign(e.target.value);
              e.target.value = "";
            }}
            className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-ink outline-none focus:border-brand-400"
          >
            <option value="">Atribuir a…</option>
            {team.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          {tags.length > 0 && (
            <select
              defaultValue=""
              disabled={busy}
              onChange={(e) => {
                bulkTag(e.target.value);
                e.target.value = "";
              }}
              className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-ink outline-none focus:border-brand-400"
            >
              <option value="">Marcar tag…</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={bulkCreateDeal}
            className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            <UserPlus className="h-3.5 w-3.5" /> Criar negócio
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={exportCsv}
            className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs text-ink hover:bg-black/5 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" /> Exportar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={bulkMerge}
            className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs text-ink hover:bg-black/5 disabled:opacity-50"
          >
            <GitMerge className="h-3.5 w-3.5" /> Mesclar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={bulkDelete}
            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </button>
        </div>
      )}

      {/* Tabela */}
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-black/[0.02] text-left text-xs uppercase tracking-wide text-muted">
              <th className="w-10 px-3 py-2.5">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} />
              </th>
              {visibleCols.map((c) => (
                <th key={c.key} className={`px-3 py-2.5 font-medium ${c.align === "right" ? "text-right" : ""}`}>
                  {c.sortKey ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(c.sortKey)}
                      className="inline-flex items-center gap-1 hover:text-ink"
                    >
                      {c.header}
                      {sortKey === c.sortKey && <ArrowDownUp className="h-3 w-3" />}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={visibleCols.length + 1} className="px-3 py-10 text-center text-sm text-muted">
                  Nenhum registro encontrado.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr
                key={r.id}
                onClick={() => onOpenRow(r)}
                className="cursor-pointer border-b border-line/60 last:border-0 hover:bg-black/[0.02]"
              >
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} />
                </td>
                {visibleCols.map((c) => (
                  <td key={c.key} className={`px-3 py-2.5 ${c.align === "right" ? "text-right" : ""}`}>
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
