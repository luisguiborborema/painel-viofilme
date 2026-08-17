"use client";

import { useRef, useState } from "react";
import { Download, FileText, Loader2, Plus, Trash2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { RH_DOCUMENT_KINDS, type RhDocument } from "@/lib/data/rh";

const KIND_LABEL: Record<string, string> = Object.fromEntries(RH_DOCUMENT_KINDS.map((k) => [k.key, k.label]));

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
function isImage(doc: RhDocument) {
  if (doc.fileType?.startsWith("image/")) return true;
  return /\.(svg|jpe?g|png|webp|gif|avif)(\?|$)/i.test(doc.url ?? "");
}

/** Documentos admissionais de um colaborador (contrato/holerite/ASO/CND). */
export function RhDocumentsTab({
  collaboratorId,
  initial = [],
}: {
  collaboratorId: string;
  initial?: RhDocument[];
}) {
  const [docs, setDocs] = useState<RhDocument[]>(initial);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("contrato");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setTitle("");
    setKind("contrato");
    setFile(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit() {
    if (!file) {
      setError("Selecione um arquivo.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const upRes = await fetch("/api/gerencial/task-upload", { method: "POST", body: form });
      const up = await upRes.json();
      if (!upRes.ok) throw new Error(up.error ?? "falha no upload");

      const metaRes = await fetch("/api/gerencial/rh-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          collaboratorId,
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
    if (!window.confirm("Excluir este documento? Esta ação não pode ser desfeita.")) return;
    const prev = docs;
    setDocs((d) => d.filter((x) => x.id !== id));
    const res = await fetch("/api/gerencial/rh-documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    if (!res.ok) setDocs(prev);
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Documentos admissionais</h2>
        <button
          onClick={() => { reset(); setOpen((v) => !v); }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-600"
        >
          {open ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {open ? "Fechar" : "Adicionar"}
        </button>
      </div>

      {open && (
        <div className="mb-4 rounded-xl border border-line bg-subtle/40 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Título</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Contrato CLT"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Tipo</span>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
              >
                {RH_DOCUMENT_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
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
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Enviar
            </button>
          </div>
        </div>
      )}

      {docs.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Nenhum documento ainda.</p>
      ) : (
        <ul className="divide-y divide-line">
          {docs.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 py-3">
              {isImage(doc) ? (
                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={doc.url} alt={doc.title} className="h-9 w-9 rounded-lg border border-line object-cover" />
                </a>
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-subtle text-muted">
                  <FileText className="h-4 w-4" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{doc.title}</p>
                <p className="text-xs text-muted">
                  {[KIND_LABEL[doc.kind] ?? doc.kind, fmtSize(doc.fileSize), fmtDate(doc.createdAt)].filter(Boolean).join(" · ")}
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
                className={cn("flex h-8 w-8 items-center justify-center rounded-lg text-muted", "hover:bg-rose-500/10 hover:text-rose-500")}
                aria-label="Excluir documento"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
