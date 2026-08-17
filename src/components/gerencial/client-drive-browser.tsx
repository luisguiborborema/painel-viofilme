"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  Download,
  Folder,
  FolderPlus,
  File as FileIcon,
  Loader2,
  Pencil,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";

type Entry = {
  id: string;
  name: string;
  isFolder: boolean;
  url?: string;
  size?: number;
  modifiedAt?: string;
};
type Crumb = { id: string; name: string };

function fmtSize(b?: number) {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

/** Navegador do Google Drive do cliente: pastas/subpastas + upload/renomear/excluir. */
export function ClientDriveBrowser({ clientId }: { clientId: string }) {
  const [stack, setStack] = useState<Crumb[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "nofolder" | "error">("loading");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const list = useCallback(
    async (folderId?: string, crumbs?: Crumb[]) => {
      try {
        const res = await fetch("/api/gerencial/client-drive", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list", clientId, folderId }),
        });
        const j = await res.json().catch(() => null);
        if (res.status === 409 && j?.connected === false) {
          setState("nofolder");
          return;
        }
        if (!res.ok || !j) {
          setState("error");
          setMsg(j?.error ?? "Falha ao carregar o Drive.");
          return;
        }
        setEntries(j.entries ?? []);
        if (crumbs) setStack(crumbs);
        else if (folderId === undefined) setStack([{ id: j.folderId, name: j.folderName }]);
        setState("ok");
      } catch {
        setState("error");
        setMsg("Falha de rede.");
      }
    },
    [clientId],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial do Drive
    void list();
  }, [list]);

  const current = stack[stack.length - 1];

  function openFolder(e: Entry) {
    void list(e.id, [...stack, { id: e.id, name: e.name }]);
  }
  function goTo(i: number) {
    const next = stack.slice(0, i + 1);
    void list(next[next.length - 1].id, next);
  }
  function refresh() {
    if (current) void list(current.id, stack);
  }

  async function onUpload(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file || !current) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("clientId", clientId);
      fd.append("folderId", current.id);
      const res = await fetch("/api/gerencial/drive-upload", { method: "POST", body: fd });
      const j = await res.json().catch(() => null);
      if (!res.ok) toast(j?.error ?? "Falha no upload.", "error");
      else refresh();
    } finally {
      setUploading(false);
    }
  }

  async function act(body: Record<string, unknown>, okMsg?: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/gerencial/client-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, ...body }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) toast(j?.error ?? "Falha na operação.", "error");
      else {
        if (okMsg) toast(okMsg, "success");
        refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  function mkdir() {
    const name = window.prompt("Nome da nova pasta:");
    if (name?.trim() && current) void act({ action: "mkdir", folderId: current.id, name: name.trim() });
  }
  function rename(e: Entry) {
    const name = window.prompt("Renomear para:", e.name);
    if (name?.trim() && name.trim() !== e.name) void act({ action: "rename", fileId: e.id, name: name.trim() });
  }
  function del(e: Entry) {
    if (window.confirm(`Excluir "${e.name}"? (vai para a lixeira do Drive)`)) void act({ action: "delete", fileId: e.id });
  }

  async function provision() {
    setBusy(true);
    try {
      const res = await fetch("/api/gerencial/client-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "provision", clientId }),
      });
      const j = await res.json().catch(() => null);
      if (res.status === 409) {
        toast("Reconecte o Google em Integrações para criar a pasta.", "error");
      } else if (!res.ok || !j?.folderId) {
        toast(j?.error ?? "Não foi possível criar a pasta.", "error");
      } else {
        setEntries(j.entries ?? []);
        setStack([{ id: j.folderId, name: j.folderName }]);
        setState("ok");
        toast("Pasta do cliente criada no Drive.", "success");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
          <Folder className="h-4 w-4 text-brand-500" /> Google Drive do cliente
        </h2>
        {state === "ok" && (
          <div className="flex items-center gap-1.5">
            <button onClick={mkdir} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-subtle disabled:opacity-60">
              <FolderPlus className="h-3.5 w-3.5" /> Nova pasta
            </button>
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Upload
            </button>
            <button onClick={refresh} className="rounded-lg border border-line p-1.5 text-muted hover:bg-subtle" aria-label="Atualizar">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <input ref={fileRef} type="file" hidden onChange={onUpload} />
          </div>
        )}
      </div>

      {/* Breadcrumb */}
      {state === "ok" && (
        <div className="mb-2 flex flex-wrap items-center gap-0.5 text-xs text-muted">
          {stack.map((c, i) => (
            <span key={c.id} className="inline-flex items-center">
              {i > 0 && <ChevronRight className="mx-0.5 h-3 w-3" />}
              <button onClick={() => goTo(i)} className={i === stack.length - 1 ? "font-semibold text-ink" : "hover:text-ink"}>
                {c.name}
              </button>
            </span>
          ))}
        </div>
      )}

      {state === "loading" && (
        <p className="flex items-center gap-2 py-6 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Carregando o Drive…</p>
      )}
      {state === "nofolder" && (
        <div className="rounded-lg bg-subtle px-3 py-3 text-sm text-muted">
          <p>
            Este cliente ainda não tem pasta no Drive. Clique abaixo para criar a estrutura padrão
            na conta Google conectada: <strong>{"<Cliente>"}</strong> → 00. Material de Apoio · 01. Redes Sociais · 02. Performance · 03. Relatórios · 04. Materiais Pontuais, com a árvore
            <strong> Ano → Mês → Histórico/Finalizadas/Desenvolvimento</strong> dentro de Redes Sociais e Performance.
          </p>
          <button
            onClick={provision}
            disabled={busy}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderPlus className="h-3.5 w-3.5" />} Criar pasta no Drive
          </button>
          <p className="mt-2 text-[11px]">
            Novos clientes recebem a pasta automaticamente ao entrar em operações — este botão é só para clientes antigos.
          </p>
        </div>
      )}
      {state === "error" && (
        <p className="rounded-lg bg-rose-500/10 px-3 py-3 text-sm text-rose-500">{msg ?? "Erro ao acessar o Drive."}</p>
      )}

      {state === "ok" && (
        entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Pasta vazia.</p>
        ) : (
          <ul className="divide-y divide-line">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2.5">
                <button
                  onClick={() => (e.isFolder ? openFolder(e) : e.url && window.open(e.url, "_blank"))}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-subtle text-muted">
                    {e.isFolder ? <Folder className="h-4 w-4 text-brand-500" /> : <FileIcon className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{e.name}</span>
                    {!e.isFolder && <span className="text-[11px] text-muted">{fmtSize(e.size)}</span>}
                  </span>
                </button>
                {!e.isFolder && e.url && (
                  <a href={e.url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-line p-1.5 text-muted hover:bg-subtle" aria-label="Abrir">
                    <Download className="h-3.5 w-3.5" />
                  </a>
                )}
                <button onClick={() => rename(e)} disabled={busy} className="rounded-lg p-1.5 text-muted hover:bg-subtle disabled:opacity-60" aria-label="Renomear">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => del(e)} disabled={busy} className="rounded-lg p-1.5 text-muted hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-60" aria-label="Excluir">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )
      )}
    </Card>
  );
}
