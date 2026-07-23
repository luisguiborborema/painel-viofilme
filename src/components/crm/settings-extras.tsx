"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Lock, Plus, Trash2, X } from "lucide-react";
import type { LostReason } from "@/lib/data/crm";

async function post(body: unknown) {
  return fetch("/api/crm/reasons", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
}

/**
 * Lista editável de motivos (perda ou congelamento). Config estrutural:
 * só gestor edita (canEdit); os demais veem a lista em leitura.
 */
export function ReasonsManager({
  kind,
  reasons,
  canEdit,
}: {
  kind: "loss" | "freeze";
  reasons: LostReason[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(reasons);
  const [novo, setNovo] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!novo.trim()) return;
    setBusy(true);
    await post({ action: "create", kind, label: novo.trim(), position: items.length + 1 });
    setNovo("");
    setBusy(false);
    router.refresh();
  }
  async function save(id: string) {
    if (!draft.trim()) return;
    setBusy(true);
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, label: draft.trim() } : r)));
    await post({ action: "update", kind, id, label: draft.trim() });
    setEditing(null);
    setBusy(false);
    router.refresh();
  }
  async function remove(id: string) {
    if (!window.confirm("Excluir este motivo?")) return;
    setBusy(true);
    setItems((prev) => prev.filter((r) => r.id !== id));
    await post({ action: "delete", kind, id });
    setBusy(false);
    router.refresh();
  }

  if (!canEdit) {
    return (
      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Lock className="h-3.5 w-3.5" /> Configuração estrutural — somente gestor edita.
        </p>
        <ul className="space-y-1">
          {items.map((r) => (
            <li key={r.id} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink">
              {r.label}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-1.5">
        {items.map((r) => (
          <li key={r.id} className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2">
            {editing === r.id ? (
              <>
                <input
                  value={draft}
                  autoFocus
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && save(r.id)}
                  className="flex-1 rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink outline-none focus:border-brand-400"
                />
                <button type="button" onClick={() => save(r.id)} disabled={busy} className="text-emerald-600 hover:text-emerald-700">
                  <Check className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setEditing(null)} className="text-muted hover:text-ink">
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(r.id);
                    setDraft(r.label);
                  }}
                  className="flex-1 text-left text-sm text-ink hover:text-brand-600"
                >
                  {r.label}
                </button>
                <button type="button" onClick={() => remove(r.id)} disabled={busy} className="text-muted hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
          </li>
        ))}
        {items.length === 0 && <li className="text-sm text-muted">Nenhum motivo cadastrado.</li>}
      </ul>
      <div className="flex items-center gap-2">
        <input
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Novo motivo…"
          className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
        />
        <button
          type="button"
          onClick={add}
          disabled={busy || !novo.trim()}
          className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Adicionar
        </button>
      </div>
    </div>
  );
}

/**
 * Seção-atalho: a configuração vive em outra tela (Agenda, Listas, Integrações,
 * Insights). Aqui só explicamos e levamos até lá — sem duplicar interface.
 */
export function ShortcutPanel({ description, href, cta }: { description: string; href: string; cta: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface p-5">
      <p className="text-sm text-muted">{description}</p>
      <Link
        href={href}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-600"
      >
        {cta} <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

/** Regras de lead score — casca (ainda não configurável). */
export function LeadScorePanel() {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface p-5 text-sm text-muted">
      <p className="font-medium text-ink">Regras de lead score · em construção</p>
      <p className="mt-1">
        O lead score é calculado hoje por regra fixa (BANT + engajamento). A configuração dos pesos e gatilhos entra
        aqui numa próxima etapa — a estrutura de propriedades e etapas já dá o insumo.
      </p>
    </div>
  );
}
