"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlignLeft,
  Archive,
  ArchiveRestore,
  Calendar,
  CalendarClock,
  CheckSquare,
  DollarSign,
  FolderPlus,
  Hash,
  Link2,
  List,
  ListChecks,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Type,
  X,
  type LucideIcon,
} from "lucide-react";
import type {
  CrmObjectType,
  PropertyDef,
  PropertyFieldType,
  PropertyGroup,
  PropertyOption,
} from "@/lib/data/crm";
import { EmptyState } from "./settings-ui";

const OBJECTS: { key: CrmObjectType; label: string }[] = [
  { key: "company", label: "Empresa" },
  { key: "contact", label: "Contato" },
  { key: "deal", label: "Negócio" },
  { key: "task", label: "Tarefa" },
];

const FIELD_TYPES: { key: PropertyFieldType; label: string; icon: LucideIcon }[] = [
  { key: "text", label: "Texto", icon: Type },
  { key: "number", label: "Número", icon: Hash },
  { key: "currency", label: "Moeda (R$)", icon: DollarSign },
  { key: "select", label: "Seleção", icon: List },
  { key: "multiselect", label: "Múltipla seleção", icon: ListChecks },
  { key: "date", label: "Data", icon: Calendar },
  { key: "datetime", label: "Data e hora", icon: CalendarClock },
  { key: "textarea", label: "Texto longo", icon: AlignLeft },
  { key: "checkbox", label: "Sim/Não", icon: CheckSquare },
  { key: "phone", label: "Telefone", icon: Phone },
  { key: "email", label: "E-mail", icon: Mail },
  { key: "url", label: "URL", icon: Link2 },
];

const fieldTypeMeta = (t: string) => FIELD_TYPES.find((f) => f.key === t);
const fieldTypeLabel = (t: string) => fieldTypeMeta(t)?.label ?? t;

export function PropertyManager({ properties, groups = [] }: { properties: PropertyDef[]; groups?: PropertyGroup[] }) {
  const router = useRouter();
  const [obj, setObj] = useState<CrmObjectType>("company");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<PropertyDef | null>(null);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const objGroups = groups.filter((g) => g.objectType === obj).sort((a, b) => a.position - b.position);
  const term = search.trim().toLowerCase();
  const list = properties
    .filter((p) => p.objectType === obj)
    .filter((p) => (showArchived ? p.isArchived : !p.isArchived))
    .filter((p) => !term || p.label.toLowerCase().includes(term) || p.key.toLowerCase().includes(term))
    .sort((a, b) => a.position - b.position);

  // Agrupa por grupo (ordem dos grupos + "Sem grupo" no fim), estilo HubSpot.
  const grouped: { group: PropertyGroup | null; items: PropertyDef[] }[] = [];
  for (const g of objGroups) {
    const items = list.filter((p) => p.groupId === g.id);
    if (items.length) grouped.push({ group: g, items });
  }
  const ungrouped = list.filter((p) => !p.groupId || !objGroups.some((g) => g.id === p.groupId));
  if (ungrouped.length) grouped.push({ group: null, items: ungrouped });

  function post(body: unknown) {
    return fetch("/api/crm/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  }
  async function archive(id: string, on: boolean) {
    setBusyId(id);
    await post({ action: on ? "archive" : "unarchive", id });
    setBusyId(null);
    router.refresh();
  }
  async function remove(id: string) {
    setBusyId(id);
    await post({ action: "delete", id });
    setBusyId(null);
    router.refresh();
  }
  async function createGroup() {
    const name = window.prompt("Nome do grupo:");
    if (!name?.trim()) return;
    await post({ action: "create-group", objectType: obj, name: name.trim() });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-line bg-canvas p-1">
          {OBJECTS.map((o) => (
            <button
              key={o.key}
              onClick={() => {
                setObj(o.key);
                setAdding(false);
              }}
              className={
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors " +
                (obj === o.key ? "bg-brand-600 text-white" : "text-muted hover:bg-subtle")
              }
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar propriedade…"
              className="w-44 rounded-lg border border-line bg-surface py-1.5 pl-8 pr-2 text-sm text-ink outline-none focus:border-brand-400"
            />
          </div>
          <button
            onClick={() => setShowArchived((a) => !a)}
            className={
              "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors " +
              (showArchived ? "border-brand-400 bg-brand-50 text-brand-700" : "border-line text-muted hover:bg-subtle")
            }
            title="Ver propriedades arquivadas"
          >
            <Archive className="mr-1 inline h-3.5 w-3.5" /> Arquivadas
          </button>
          <button
            onClick={createGroup}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-subtle"
          >
            <FolderPlus className="h-4 w-4" /> Novo grupo
          </button>
          <button
            onClick={() => { setEditing(null); setAdding((a) => !a); }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" /> Nova propriedade
          </button>
        </div>
      </div>

      {(adding || editing) && (
        <PropertyForm
          objectType={obj}
          initial={editing}
          groups={objGroups}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={() => {
            setAdding(false);
            setEditing(null);
            router.refresh();
          }}
        />
      )}

      {grouped.length > 0 ? (
        <div className="space-y-4">
          {grouped.map(({ group, items }) => (
            <div key={group?.id ?? "sem-grupo"}>
              <div className="mb-1.5 flex items-center gap-2 px-1">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{group?.name ?? "Sem grupo"}</p>
                <span className="text-[11px] text-muted">· {items.length}</span>
                {group && (
                  <button
                    onClick={() => post({ action: "delete-group", id: group.id }).then(() => router.refresh())}
                    className="text-[11px] text-muted hover:text-rose-500"
                    title="Excluir grupo (as propriedades ficam sem grupo)"
                  >
                    excluir grupo
                  </button>
                )}
              </div>
              <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                {items.map((p) => {
                  const Icon = fieldTypeMeta(p.fieldType)?.icon ?? Type;
                  return (
                    <div key={p.id} className="flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-b-0">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-sm font-medium text-ink">
                          {p.label}
                          {p.required && <span className="text-rose-500" title="Obrigatória">*</span>}
                          {p.isDefault && (
                            <span className="rounded-full bg-subtle px-1.5 py-0.5 text-[10px] font-medium text-muted">padrão</span>
                          )}
                        </p>
                        <p className="truncate text-xs text-muted">
                          <code className="rounded bg-subtle px-1">{p.key}</code>
                          {p.options.length > 0 && ` · ${p.options.length} opções`}
                          {p.description ? ` · ${p.description}` : ""}
                        </p>
                      </div>
                      <span className="hidden shrink-0 rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-muted sm:inline">
                        {fieldTypeLabel(p.fieldType)}
                      </span>
                      <button
                        onClick={() => { setAdding(false); setEditing(p); }}
                        className="rounded-lg p-2 text-muted hover:bg-subtle hover:text-ink"
                        title="Editar propriedade"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {p.isArchived ? (
                        <>
                          <button
                            onClick={() => archive(p.id, false)}
                            disabled={busyId === p.id}
                            className="rounded-lg p-2 text-muted hover:bg-subtle hover:text-ink disabled:opacity-50"
                            title="Restaurar"
                          >
                            <ArchiveRestore className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => remove(p.id)}
                            disabled={busyId === p.id}
                            className="rounded-lg p-2 text-muted hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-50"
                            title="Excluir definitivamente"
                          >
                            {busyId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => archive(p.id, true)}
                          disabled={busyId === p.id}
                          className="rounded-lg p-2 text-muted hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-50"
                          title="Arquivar propriedade"
                        >
                          {busyId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        !adding && (
          <EmptyState icon={SlidersHorizontal}>
            {showArchived
              ? "Nenhuma propriedade arquivada."
              : `Nenhuma propriedade customizada para ${OBJECTS.find((o) => o.key === obj)?.label}.`}
          </EmptyState>
        )
      )}
    </div>
  );
}

function PropertyForm({
  objectType,
  initial,
  groups = [],
  onClose,
  onSaved,
}: {
  objectType: CrmObjectType;
  initial?: PropertyDef | null;
  groups?: PropertyGroup[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const editingId = initial?.id ?? null;
  const [label, setLabel] = useState(initial?.label ?? "");
  const [fieldType, setFieldType] = useState<PropertyFieldType>(initial?.fieldType ?? "text");
  const [optionsText, setOptionsText] = useState((initial?.options ?? []).map((o) => o.label).join("\n"));
  const [description, setDescription] = useState(initial?.description ?? "");
  const [required, setRequired] = useState(Boolean(initial?.required));
  const [groupId, setGroupId] = useState(initial?.groupId ?? "");
  const [busy, setBusy] = useState(false);

  const hasOptions = fieldType === "select" || fieldType === "multiselect";

  async function save() {
    if (!label.trim() || busy) return;
    setBusy(true);
    const options: PropertyOption[] = hasOptions
      ? optionsText
          .split(/[\n,]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .map((label) => ({
            value: label.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
            label,
          }))
      : [];
    const common = {
      label: label.trim(),
      fieldType,
      options,
      description: description.trim() || null,
      required,
      groupId: groupId || null,
    };
    const body = editingId
      ? { action: "update", id: editingId, ...common }
      : { action: "create", objectType, ...common };
    await fetch("/api/crm/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
    setBusy(false);
    onSaved();
  }

  return (
    <div className="rounded-2xl border border-brand-400/40 bg-brand-50/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">{editingId ? "Editar propriedade" : "Nova propriedade"}</p>
        <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-subtle">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-0.5 block text-[11px] font-medium text-muted">Rótulo</span>
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex.: Instagram, Faturamento…"
            className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
          />
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[11px] font-medium text-muted">Tipo de campo</span>
          <select
            value={fieldType}
            onChange={(e) => setFieldType(e.target.value as PropertyFieldType)}
            className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
          >
            {FIELD_TYPES.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        {hasOptions && (
          <label className="block sm:col-span-2">
            <span className="mb-0.5 block text-[11px] font-medium text-muted">
              Opções (uma por linha ou separadas por vírgula)
            </span>
            <textarea
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              rows={3}
              placeholder={"Opção A\nOpção B\nOpção C"}
              className="w-full resize-none rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
            />
          </label>
        )}
        <label className="block">
          <span className="mb-0.5 block text-[11px] font-medium text-muted">Grupo</span>
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
          >
            <option value="">Sem grupo</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 self-end pb-1.5 text-sm text-ink">
          <input
            type="checkbox"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
            className="h-4 w-4 rounded border-line accent-brand-600"
          />
          Obrigatória
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-0.5 block text-[11px] font-medium text-muted">Descrição (opcional)</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ajuda que aparece junto do campo"
            className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
          />
        </label>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted hover:bg-subtle"
        >
          Cancelar
        </button>
        <button
          onClick={save}
          disabled={busy || !label.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          {editingId ? "Salvar" : "Criar propriedade"}
        </button>
      </div>
    </div>
  );
}
