"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen, ChevronDown, ChevronRight, ExternalLink, FileText, FileType2,
  FolderPlus, ImageIcon, Loader2, Paperclip, Pencil, Plus, Search, Trash2, Upload, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlaybookAttachment, PlaybookFormat, PlaybookSector } from "@/lib/data/playbooks";
import { PlaybookViewer } from "./playbook-viewer";

const isImage = (ct: string, name: string) => /^image\//.test(ct) || /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(name);
const fmtSize = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

async function post(body: unknown) {
  const res = await fetch("/api/gerencial/playbooks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  return res;
}

type EditorState =
  | null
  | { mode: "create"; sectorId: string }
  | { mode: "edit"; id: string; sectorId: string; title: string; content: string; format: PlaybookFormat };

export function PlaybooksApp({ sectors }: { sectors: PlaybookSector[] }) {
  const router = useRouter();
  const allDocs = useMemo(() => sectors.flatMap((s) => s.playbooks), [sectors]);
  const [selId, setSelId] = useState<string | null>(allDocs[0]?.id ?? null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set(sectors.map((s) => s.id)));
  const [editor, setEditor] = useState<EditorState>(null);
  const [busy, setBusy] = useState(false);
  const [nameModal, setNameModal] = useState<{ mode: "new" } | { mode: "rename"; id: string } | null>(null);
  const [nameValue, setNameValue] = useState("");

  const selected = allDocs.find((d) => d.id === selId) ?? null;
  const selectedSector = sectors.find((s) => s.id === selected?.sectorId);

  const term = q.trim().toLowerCase();
  const match = (t: string) => !term || t.toLowerCase().includes(term);

  function toggle(id: string) {
    setOpen((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function act(body: unknown) {
    setBusy(true);
    await post(body);
    setBusy(false);
    router.refresh();
  }

  function newSector() {
    setNameValue("");
    setNameModal({ mode: "new" });
  }
  function renameSector(id: string, current: string) {
    setNameValue(current);
    setNameModal({ mode: "rename", id });
  }
  async function confirmName() {
    const name = nameValue.trim();
    if (!name || !nameModal) return;
    const body =
      nameModal.mode === "new"
        ? { action: "create-sector", name }
        : { action: "rename-sector", id: nameModal.id, name };
    setNameModal(null);
    await act(body);
  }
  async function deleteSector(id: string, name: string) {
    if (window.confirm(`Excluir o setor "${name}" e todos os seus playbooks?`))
      await act({ action: "delete-sector", id });
  }
  async function deletePlaybook(id: string, title: string) {
    if (window.confirm(`Excluir o playbook "${title}"?`)) {
      await act({ action: "delete-playbook", id });
      if (selId === id) setSelId(null);
    }
  }

  return (
    <div className="flex min-h-[70vh] gap-4">
      {/* Sidebar */}
      <aside className="w-72 shrink-0 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar…"
              className="w-full rounded-xl border border-line bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-brand-400"
            />
          </div>
          <button
            onClick={newSector}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line text-muted hover:bg-subtle"
            title="Novo setor"
          >
            <FolderPlus className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-1">
          {sectors.map((s) => {
            const docs = s.playbooks.filter((d) => match(d.title) || match(s.name));
            const isOpen = open.has(s.id) || Boolean(term);
            return (
              <div key={s.id} className="rounded-xl border border-line bg-surface">
                <div className="group flex items-center gap-1 px-2 py-2">
                  <button onClick={() => toggle(s.id)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                    {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted" /> : <ChevronRight className="h-3.5 w-3.5 text-muted" />}
                    <span className="truncate text-sm font-semibold text-ink">{s.name}</span>
                    <span className="text-[10px] text-muted">{s.playbooks.length}</span>
                  </button>
                  <button onClick={() => setEditor({ mode: "create", sectorId: s.id })} className="rounded p-1 text-muted opacity-0 hover:text-brand-600 group-hover:opacity-100" title="Novo playbook">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => renameSector(s.id, s.name)} className="rounded p-1 text-muted opacity-0 hover:text-ink group-hover:opacity-100" title="Renomear">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => deleteSector(s.id, s.name)} className="rounded p-1 text-muted opacity-0 hover:text-rose-500 group-hover:opacity-100" title="Excluir setor">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {isOpen && (
                  <div className="space-y-0.5 px-1.5 pb-1.5">
                    {docs.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => setSelId(d.id)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm",
                          selId === d.id ? "bg-brand-600 text-white" : "text-ink hover:bg-subtle",
                        )}
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0 opacity-70" />
                        <span className="truncate">{d.title}</span>
                      </button>
                    ))}
                    {docs.length === 0 && (
                      <button
                        onClick={() => setEditor({ mode: "create", sectorId: s.id })}
                        className="w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-muted hover:bg-subtle"
                      >
                        + adicionar playbook
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {sectors.length === 0 && (
            <button onClick={newSector} className="w-full rounded-xl border border-dashed border-line px-3 py-6 text-center text-sm text-muted hover:bg-subtle">
              Criar o primeiro setor
            </button>
          )}
        </div>
      </aside>

      {/* Conteúdo */}
      <div className="min-w-0 flex-1 rounded-2xl border border-line bg-surface">
        {selected ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-5">
              <div>
                <p className="text-xs text-muted">{selectedSector?.name}</p>
                <h1 className="text-xl font-bold text-ink">{selected.title}</h1>
                <p className="mt-0.5 text-[11px] text-muted">
                  {selected.format.toUpperCase()}
                  {selected.updatedAt ? ` · atualizado ${new Date(selected.updatedAt).toLocaleDateString("pt-BR")}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditor({ mode: "edit", id: selected.id, sectorId: selected.sectorId, title: selected.title, content: selected.content, format: selected.format })}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-subtle"
                >
                  <Pencil className="h-4 w-4" /> Editar
                </button>
                <button
                  onClick={() => deletePlaybook(selected.id, selected.title)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-medium text-muted hover:bg-rose-500/10 hover:text-rose-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <PlaybookViewer content={selected.content} format={selected.format} />
            </div>
            <AttachmentsPanel key={selected.id} playbook={selected} />
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-subtle text-muted">
              <BookOpen className="h-6 w-6" />
            </span>
            <p className="text-sm font-semibold text-ink">Selecione um playbook</p>
            <p className="max-w-sm text-sm text-muted">
              Escolha um documento à esquerda, ou crie um novo setor e adicione playbooks (Markdown ou HTML).
            </p>
          </div>
        )}
      </div>

      {editor && (
        <PlaybookEditor
          sectors={sectors}
          state={editor}
          busy={busy}
          onClose={() => setEditor(null)}
          onSaved={(id) => {
            setEditor(null);
            if (id) setSelId(id);
            router.refresh();
          }}
        />
      )}

      {nameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setNameModal(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-line bg-surface p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-ink">{nameModal.mode === "new" ? "Novo setor" : "Renomear setor"}</h2>
              <button onClick={() => setNameModal(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-subtle"><X className="h-4 w-4" /></button>
            </div>
            <input
              autoFocus
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") confirmName(); }}
              placeholder="Nome do setor (ex.: Operações, Comercial)"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setNameModal(null)} className="rounded-xl px-3 py-2 text-sm font-medium text-muted hover:bg-subtle">Cancelar</button>
              <button onClick={confirmName} disabled={busy || !nameValue.trim()} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                {nameModal.mode === "new" ? "Criar" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AttachmentsPanel({
  playbook,
}: {
  playbook: { id: string; attachments: PlaybookAttachment[] };
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const items = playbook.attachments ?? [];

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setBusy(true);
    setErr(null);
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("playbookId", playbook.id);
      const up = await fetch("/api/gerencial/playbooks/upload", { method: "POST", body: fd })
        .then((r) => r.json())
        .catch(() => null);
      if (!up?.attachment) {
        setErr(up?.error ?? "Falha ao enviar arquivo. Verifique se o Storage está configurado.");
        continue;
      }
      await post({ action: "add-attachment", id: playbook.id, attachment: up.attachment });
    }
    setBusy(false);
    router.refresh();
  }

  async function remove(a: PlaybookAttachment) {
    if (!window.confirm(`Remover o anexo "${a.name}"?`)) return;
    setBusy(true);
    await post({ action: "remove-attachment", id: playbook.id, attachmentId: a.id });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="border-t border-line p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Paperclip className="h-4 w-4 text-muted" /> Anexos
          {items.length > 0 && <span className="text-xs font-normal text-muted">({items.length})</span>}
        </h2>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-subtle disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Anexar arquivo
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,image/*,application/pdf"
          onChange={onFiles}
          className="hidden"
        />
      </div>

      {err && <p className="mb-3 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-500">{err}</p>}

      {items.length === 0 ? (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full rounded-xl border border-dashed border-line px-3 py-6 text-center text-sm text-muted hover:bg-subtle"
        >
          Nenhum anexo. Envie um PDF ou imagem para este playbook.
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((a) => (
            <div key={a.id} className="group relative overflow-hidden rounded-xl border border-line bg-canvas">
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="block">
                {isImage(a.contentType, a.name) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.url} alt={a.name} className="h-28 w-full object-cover" />
                ) : (
                  <div className="flex h-28 w-full items-center justify-center bg-subtle">
                    {/pdf/i.test(a.contentType) || /\.pdf$/i.test(a.name) ? (
                      <FileType2 className="h-9 w-9 text-rose-500" />
                    ) : (
                      <FileText className="h-9 w-9 text-muted" />
                    )}
                  </div>
                )}
                <div className="flex items-center gap-1.5 p-2.5">
                  {isImage(a.contentType, a.name) ? (
                    <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted" />
                  ) : (
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted" />
                  )}
                  <span className="truncate text-xs font-medium text-ink" title={a.name}>{a.name}</span>
                </div>
                <p className="px-2.5 pb-2.5 text-[10px] text-muted">{fmtSize(a.size)}</p>
              </a>
              <button
                onClick={() => remove(a)}
                disabled={busy}
                className="absolute right-1.5 top-1.5 rounded-lg bg-surface/90 p-1 text-muted opacity-0 shadow-sm hover:text-rose-500 group-hover:opacity-100 disabled:opacity-60"
                title="Remover anexo"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PlaybookEditor({
  sectors, state, busy, onClose, onSaved,
}: {
  sectors: PlaybookSector[];
  state: NonNullable<EditorState>;
  busy: boolean;
  onClose: () => void;
  onSaved: (id?: string) => void;
}) {
  const isEdit = state.mode === "edit";
  const [title, setTitle] = useState(isEdit ? state.title : "");
  const [sectorId, setSectorId] = useState(state.sectorId);
  const [format, setFormat] = useState<PlaybookFormat>(isEdit ? state.format : "md");
  const [content, setContent] = useState(isEdit ? state.content : "");
  const [saving, setSaving] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setContent(text);
    const isHtml = /\.html?$/i.test(file.name) || /^\s*<(!doctype|html|div|section|h[1-6]|p)\b/i.test(text);
    setFormat(isHtml ? "html" : "md");
    if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ""));
  }

  async function save() {
    if (!title.trim() || saving) return;
    setSaving(true);
    const body = isEdit
      ? { action: "update-playbook", id: state.id, title: title.trim(), content, format, sectorId }
      : { action: "create-playbook", sectorId, title: title.trim(), content, format };
    const res = await post(body);
    let id: string | undefined;
    try {
      id = (await res?.json())?.id;
    } catch { /* */ }
    setSaving(false);
    onSaved(isEdit ? state.id : id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-line p-4">
          <h2 className="text-base font-bold text-ink">{isEdit ? "Editar playbook" : "Novo playbook"}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-subtle"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex flex-wrap items-end gap-3 border-b border-line p-4">
          <label className="min-w-[200px] flex-1">
            <span className="mb-1 block text-[11px] font-medium text-muted">Título</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Onboarding de cliente" className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400" />
          </label>
          <label>
            <span className="mb-1 block text-[11px] font-medium text-muted">Setor</span>
            <select value={sectorId} onChange={(e) => setSectorId(e.target.value)} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400">
              {sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <div>
            <span className="mb-1 block text-[11px] font-medium text-muted">Formato</span>
            <div className="inline-flex rounded-lg border border-line bg-canvas p-0.5">
              {(["md", "html"] as const).map((f) => (
                <button key={f} onClick={() => setFormat(f)} className={cn("rounded-md px-2.5 py-1.5 text-xs font-medium", format === f ? "bg-brand-600 text-white" : "text-muted hover:bg-subtle")}>
                  {f === "md" ? "Markdown" : "HTML"}
                </button>
              ))}
            </div>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-subtle">
            <Upload className="h-4 w-4" /> Enviar arquivo
            <input type="file" accept=".md,.markdown,.html,.htm,text/markdown,text/html" onChange={onFile} className="hidden" />
          </label>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={format === "md" ? "# Título\n\nEscreva em Markdown…" : "<h1>Título</h1>"}
            className="min-h-[320px] resize-none border-b border-line bg-canvas p-4 font-mono text-xs text-ink outline-none lg:border-b-0 lg:border-r"
          />
          <div className="min-h-[320px] overflow-y-auto p-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted">Pré-visualização</p>
            <PlaybookViewer content={content} format={format} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line p-4">
          <button onClick={onClose} className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-subtle">Cancelar</button>
          <button onClick={save} disabled={saving || busy || !title.trim()} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {isEdit ? "Salvar" : "Criar playbook"}
          </button>
        </div>
      </div>
    </div>
  );
}
