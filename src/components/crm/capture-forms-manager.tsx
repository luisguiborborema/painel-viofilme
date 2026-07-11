"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, FormInput, Loader2, Plus, Trash2 } from "lucide-react";
import type { CaptureForm } from "@/lib/data/crm";
import { EmptyState } from "./settings-ui";

async function post(body: unknown) {
  await fetch("/api/crm/capture-forms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

export function CaptureFormsManager({
  forms,
  team = [],
}: {
  forms: CaptureForm[];
  team?: string[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [source, setSource] = useState("Site");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  async function create() {
    if (!name.trim() || busy) return;
    setBusy(true);
    await post({ action: "create", name: name.trim(), source: source.trim() });
    setName("");
    setBusy(false);
    router.refresh();
  }

  async function act(body: unknown) {
    setBusy(true);
    await post(body);
    setBusy(false);
    router.refresh();
  }

  function copy(slug: string) {
    navigator.clipboard?.writeText(`${origin}/captura/${slug}`).then(() => {
      setCopied(slug);
      setTimeout(() => setCopied((c) => (c === slug ? null : c)), 1500);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-line bg-surface p-3">
        <label className="flex-1">
          <span className="mb-0.5 block text-[11px] font-medium text-muted">Novo formulário</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="Ex.: Landing page de tráfego"
            className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
          />
        </label>
        <label>
          <span className="mb-0.5 block text-[11px] font-medium text-muted">Origem</span>
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="w-32 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
          />
        </label>
        <button
          onClick={create}
          disabled={busy || !name.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          <Plus className="h-4 w-4" /> Criar
        </button>
      </div>

      {forms.map((f) => (
        <div key={f.id} className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">
                {f.name}
                {!f.active && <span className="ml-2 text-xs font-normal text-muted">(inativo)</span>}
              </p>
              <p className="text-xs text-muted">Origem: {f.source}</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => act({ action: "update", id: f.id, active: !f.active })}
                className="rounded-lg border border-line px-2 py-1 text-xs font-medium text-ink hover:bg-subtle"
              >
                {f.active ? "Desativar" : "Ativar"}
              </button>
              <button
                onClick={() => act({ action: "delete", id: f.id })}
                className="rounded-lg p-1.5 text-muted hover:bg-rose-500/10 hover:text-rose-500"
                title="Excluir"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2 rounded-lg bg-canvas px-2.5 py-1.5">
            <code className="min-w-0 flex-1 truncate text-xs text-muted">{origin}/captura/{f.slug}</code>
            <button onClick={() => copy(f.slug)} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
              {copied === f.slug ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === f.slug ? "copiado" : "copiar"}
            </button>
            <a href={`/captura/${f.slug}`} target="_blank" rel="noreferrer" className="text-muted hover:text-ink" title="Abrir">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-muted">Responsável dos leads:</span>
            <select
              value={f.owner ?? ""}
              onChange={(e) => act({ action: "update", id: f.id, owner: e.target.value })}
              className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-brand-400"
            >
              <option value="">— (sem dono / rodízio manual)</option>
              {team.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>
      ))}
      {forms.length === 0 && (
        <EmptyState icon={FormInput}>Nenhum formulário ainda. Crie o primeiro acima.</EmptyState>
      )}
      {busy && <Loader2 className="h-4 w-4 animate-spin text-muted" />}
    </div>
  );
}
