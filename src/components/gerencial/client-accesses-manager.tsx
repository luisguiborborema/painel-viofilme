"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";

type Access = {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  status: string;
  note: string | null;
  url: string | null;
};

const ICONS = ["meta", "google", "rd", "wordpress", "ecommerce", "other"] as const;
const ICON_LABEL: Record<string, string> = {
  meta: "Meta Business", google: "Google", rd: "RD Station", wordpress: "WordPress", ecommerce: "E-commerce / loja", other: "Outro",
};
const STATUSES = ["connected", "review", "setup", "soon"] as const;
const STATUS_LABEL: Record<string, string> = {
  connected: "Conectado", review: "Revisar", setup: "Configurar", soon: "Em breve",
};
const STATUS_CHIP: Record<string, string> = {
  connected: "bg-emerald-500/15 text-emerald-600",
  review: "bg-amber-500/15 text-amber-600",
  setup: "bg-sky-500/15 text-sky-500",
  soon: "bg-subtle-strong text-muted",
};

const inputCls =
  "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400";
const labelCls = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted";

const empty = { name: "", description: "", icon: "other", status: "connected", note: "", url: "" };

/** Cofre de acessos por cliente (gerencial) — reflete no portal do cliente. */
export function ClientAccessesManager({ clientId }: { clientId: string }) {
  const [rows, setRows] = useState<Access[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [f, setF] = useState({ ...empty });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/gerencial/client-accesses?clientId=${clientId}`, { cache: "no-store" });
      const j = await res.json().catch(() => null);
      setRows(Array.isArray(j?.accesses) ? j.accesses : []);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  function openNew() {
    setF({ ...empty });
    setEditingId("new");
  }
  function openEdit(a: Access) {
    setF({ name: a.name, description: a.description ?? "", icon: a.icon, status: a.status, note: a.note ?? "", url: a.url ?? "" });
    setEditingId(a.id);
  }

  async function save() {
    if (!f.name.trim()) {
      toast("Informe o nome do acesso.", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/gerencial/client-accesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: editingId === "new" ? "create" : "update",
          clientId,
          id: editingId === "new" ? undefined : editingId,
          ...f,
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) toast(j?.error ?? "Não foi possível salvar.", "error");
      else {
        setEditingId(null);
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Excluir este acesso?")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/gerencial/client-accesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      if (!res.ok) toast("Não foi possível excluir.", "error");
      else await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
          <KeyRound className="h-4 w-4 text-brand-500" /> Cofre de acessos
          <span className="text-xs font-normal text-muted">(aparece no portal do cliente)</span>
        </h2>
        {editingId === null && (
          <button onClick={openNew} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">
            <Plus className="h-3.5 w-3.5" /> Novo acesso
          </button>
        )}
      </div>

      {editingId !== null && (
        <div className="mb-4 grid grid-cols-1 gap-2.5 rounded-xl border border-line p-3 sm:grid-cols-2">
          <label className="block">
            <span className={labelCls}>Nome</span>
            <input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Meta Business" className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Plataforma (ícone)</span>
            <select value={f.icon} onChange={(e) => set("icon", e.target.value)} className={inputCls}>
              {ICONS.map((i) => <option key={i} value={i}>{ICON_LABEL[i]}</option>)}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className={labelCls}>Descrição</span>
            <input value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Ex.: Gerenciador de Anúncios · Instagram" className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Status</span>
            <select value={f.status} onChange={(e) => set("status", e.target.value)} className={inputCls}>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Link (Acessar)</span>
            <input value={f.url} onChange={(e) => set("url", e.target.value)} placeholder="https://…" className={inputCls} />
          </label>
          <label className="block sm:col-span-2">
            <span className={labelCls}>Observação</span>
            <input value={f.note} onChange={(e) => set("note", e.target.value)} placeholder="Ex.: Acesso revisado 01/06" className={inputCls} />
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button onClick={() => setEditingId(null)} className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-sm text-ink hover:bg-subtle">
              <X className="h-3.5 w-3.5" /> Cancelar
            </button>
            <button onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Salvar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="flex items-center gap-2 py-4 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</p>
      ) : rows.length === 0 && editingId === null ? (
        <p className="py-6 text-center text-sm text-muted">Nenhum acesso cadastrado. Clique em “Novo acesso”.</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((a) => (
            <li key={a.id} className="group flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-ink">{a.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_CHIP[a.status] ?? STATUS_CHIP.connected}`}>
                    {STATUS_LABEL[a.status] ?? a.status}
                  </span>
                </div>
                {a.description && <p className="truncate text-xs text-muted">{a.description}</p>}
                {a.note && <p className="truncate text-[11px] text-muted">{a.note}</p>}
              </div>
              <button onClick={() => openEdit(a)} className="rounded-lg p-1.5 text-muted hover:bg-subtle hover:text-ink" aria-label="Editar">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => remove(a.id)} className="rounded-lg p-1.5 text-muted hover:bg-rose-500/10 hover:text-rose-500" aria-label="Excluir">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
