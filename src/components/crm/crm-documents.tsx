"use client";

import { useMemo, useRef, useState } from "react";
import { Briefcase, Building2, Download, FileText, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CRM_DOCUMENT_KINDS, type CrmDocument } from "@/lib/data/crm";

const KIND_LABEL: Record<string, string> = Object.fromEntries(CRM_DOCUMENT_KINDS.map((k) => [k.key, k.label]));

function fmtSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function fmtDate(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

const inputCls = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400";

export function CrmDocuments({
  documents,
  dealId,
  deals = [],
  companies = [],
  compact = false,
}: {
  documents: CrmDocument[];
  dealId?: string; // modo "scoped" (ficha do negócio)
  deals?: { id: string; name: string }[];
  companies?: { id: string; name: string }[];
  compact?: boolean;
}) {
  const scoped = Boolean(dealId);
  const [docs, setDocs] = useState<CrmDocument[]>(documents);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("outro");
  const [targetDeal, setTargetDeal] = useState(dealId ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [search, setSearch] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const dealName = useMemo(() => new Map(deals.map((d) => [d.id, d.name])), [deals]);
  const companyName = useMemo(() => new Map(companies.map((c) => [c.id, c.name])), [companies]);

  function reset() {
    setTitle("");
    setKind("outro");
    setTargetDeal(dealId ?? "");
    setFile(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit() {
    if (!file) return setError("Selecione um arquivo.");
    if (!scoped && !targetDeal) return setError("Escolha o negócio.");
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const upRes = await fetch("/api/gerencial/task-upload", { method: "POST", body: form });
      const up = await upRes.json();
      if (!upRes.ok) throw new Error(up.error ?? "falha no upload");

      const dealTarget = dealId ?? targetDeal;
      const metaRes = await fetch("/api/crm/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          dealId: dealTarget,
          title: title.trim() || file.name,
          url: up.url,
          fileName: up.name,
          fileType: file.type || null,
          fileSize: file.size,
          kind,
        }),
      });
      const meta = await metaRes.json();
      if (!metaRes.ok) throw new Error(meta.error ?? "falha ao salvar");

      setDocs((prev) => [
        {
          id: meta.id ?? `tmp-${prev.length}`,
          dealId: dealTarget,
          title: title.trim() || file.name,
          url: up.url,
          fileName: up.name,
          fileType: file.type || undefined,
          fileSize: file.size,
          kind,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      reset();
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const prev = docs;
    setDocs((d) => d.filter((x) => x.id !== id));
    const res = await fetch("/api/crm/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    if (!res.ok) setDocs(prev);
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return docs;
    return docs.filter((d) =>
      `${d.title} ${dealName.get(d.dealId ?? "") ?? ""} ${companyName.get(d.companyId ?? "") ?? ""}`.toLowerCase().includes(term),
    );
  }, [docs, search, dealName, companyName]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        {!compact && <h2 className="text-sm font-semibold text-ink">Documentos {scoped ? "do negócio" : "do comercial"}</h2>}
        <button
          onClick={() => {
            reset();
            setOpen((v) => !v);
          }}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-700",
            compact && "ml-auto",
          )}
        >
          {open ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {open ? "Fechar" : "Adicionar"}
        </button>
      </div>

      {open && (
        <div className="rounded-xl border border-line bg-canvas p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {!scoped && (
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-muted">Negócio *</span>
                <select value={targetDeal} onChange={(e) => setTargetDeal(e.target.value)} className={inputCls}>
                  <option value="">Selecione o negócio…</option>
                  {deals.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Título</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Contrato assinado" className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Tipo</span>
              <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputCls}>
                {CRM_DOCUMENT_KINDS.map((k) => (
                  <option key={k.key} value={k.key}>{k.label}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-xs text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-subtle file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink hover:file:bg-line"
            />
            {file && <span className="text-xs text-muted">{fmtSize(file.size)}</span>}
          </div>
          {error && <p className="mt-2 text-xs text-rose-500">{error}</p>}
          <div className="mt-3 flex justify-end">
            <button
              onClick={submit}
              disabled={busy || !file}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Enviar
            </button>
          </div>
        </div>
      )}

      {!scoped && docs.length > 0 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título ou negócio…"
            className="w-full rounded-xl border border-line bg-surface py-2 pl-8 pr-3 text-sm text-ink outline-none focus:border-brand-400 sm:w-80"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line py-8 text-center text-sm text-muted">
          Nenhum documento ainda. Anexe contratos, propostas e materiais.
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
          {filtered.map((doc) => {
            const link = doc.dealId ? dealName.get(doc.dealId) : doc.companyId ? companyName.get(doc.companyId) : null;
            const LinkIcon = doc.companyId && !doc.dealId ? Building2 : Briefcase;
            return (
              <li key={doc.id} className="flex items-center gap-3 bg-surface px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-subtle text-muted">
                  <FileText className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{doc.title}</p>
                  <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
                    <span className="rounded-full bg-subtle px-1.5 py-0.5 text-[10px]">{KIND_LABEL[doc.kind] ?? doc.kind}</span>
                    {!scoped && link && (
                      <span className="inline-flex items-center gap-1">
                        <LinkIcon className="h-3 w-3" /> {link}
                      </span>
                    )}
                    {[fmtSize(doc.fileSize), fmtDate(doc.createdAt)].filter(Boolean).map((x, i) => (
                      <span key={i}>· {x}</span>
                    ))}
                  </p>
                </div>
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={doc.fileName}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-subtle"
                >
                  <Download className="h-3.5 w-3.5" /> Baixar
                </a>
                <button
                  onClick={() => remove(doc.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-rose-500/10 hover:text-rose-500"
                  aria-label="Excluir documento"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
