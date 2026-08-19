"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Pencil, Plus, Settings2, Trash2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { DiagnosticConfigModal } from "@/components/gerencial/diagnostic-config-modal";
import type { DiagnosticListItem } from "@/lib/data/diagnostic";

const inputCls = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400";

function fmtDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function DiagnosticList({
  diagnostics,
  clients,
  leads,
}: {
  diagnostics: DiagnosticListItem[];
  clients: { id: string; name: string }[];
  leads: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [cfgOpen, setCfgOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"cliente" | "negocio">("cliente");
  const [refId, setRefId] = useState("");
  const [title, setTitle] = useState("Diagnóstico");
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const options = mode === "cliente" ? clients : leads;
  const subject = options.find((o) => o.id === refId)?.name ?? "";

  async function create() {
    if (!refId || !subject) {
      toast(`Escolha o ${mode === "cliente" ? "cliente" : "negócio"}.`, "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/gerencial/diagnostico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          subject,
          title,
          clientId: mode === "cliente" ? refId : undefined,
          leadId: mode === "negocio" ? refId : undefined,
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.id) toast(j?.error ?? "Não foi possível criar.", "error");
      else router.push(`/gerencial/diagnostico/${j.id}`);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Excluir este diagnóstico?")) return;
    setBusyId(id);
    try {
      const res = await fetch("/api/gerencial/diagnostico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      if (!res.ok) toast("Não foi possível excluir.", "error");
      else router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button onClick={() => setCfgOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink hover:bg-subtle">
          <Settings2 className="h-4 w-4" /> Perguntas
        </button>
        <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-600">
          {open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {open ? "Cancelar" : "Novo diagnóstico"}
        </button>
      </div>

      {open && (
        <Card className="space-y-3 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">Vincular a</span>
              <select value={mode} onChange={(e) => { setMode(e.target.value as "cliente" | "negocio"); setRefId(""); }} className={inputCls}>
                <option value="cliente">Cliente</option>
                <option value="negocio">Negócio (comercial)</option>
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">{mode === "cliente" ? "Cliente" : "Negócio"}</span>
              <select value={refId} onChange={(e) => setRefId(e.target.value)} className={inputCls}>
                <option value="">Selecione…</option>
                {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </label>
            <label className="block sm:col-span-3">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">Título</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
            </label>
          </div>
          <div className="flex justify-end">
            <button onClick={create} disabled={busy || !refId} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Criar e preencher
            </button>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        {diagnostics.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">Nenhum diagnóstico ainda. Crie o primeiro.</p>
        ) : (
          <ul className="divide-y divide-line">
            {diagnostics.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-subtle text-muted">
                  <FileText className="h-4 w-4" />
                </span>
                <Link href={`/gerencial/diagnostico/${d.id}`} className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{d.subject}</p>
                  <p className="truncate text-xs text-muted">
                    {d.title} · {d.leadId ? "Comercial" : "Cliente"} · {fmtDate(d.createdAt)}
                  </p>
                </Link>
                <Link href={`/gerencial/diagnostico/${d.id}`} className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-subtle">
                  <Pencil className="h-3.5 w-3.5" />
                </Link>
                <Link href={`/gerencial/diagnostico/${d.id}/documento`} className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-subtle" title="Documento">
                  <FileText className="h-3.5 w-3.5" />
                </Link>
                <button onClick={() => remove(d.id)} disabled={busyId === d.id} className={cn("rounded-lg p-1.5 text-muted hover:bg-rose-500/10 hover:text-rose-500", busyId === d.id && "opacity-50")} aria-label="Excluir">
                  {busyId === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {cfgOpen && <DiagnosticConfigModal onClose={() => setCfgOpen(false)} />}
    </div>
  );
}
