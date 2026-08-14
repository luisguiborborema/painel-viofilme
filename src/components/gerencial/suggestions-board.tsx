"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Loader2, Paperclip, Send, Trash2, Video, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  SUGGESTION_STATUS,
  type Suggestion,
  type SuggestionAttachment,
} from "@/lib/data/suggestions";

const inputCls =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15";

function fileType(mime: string): "image" | "video" | "file" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "file";
}
function fmtDate(iso: string) {
  // Data + hora de quando a sugestão foi enviada (created_at do banco).
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
const statusMeta = (k: string) => SUGGESTION_STATUS.find((s) => s.key === k) ?? SUGGESTION_STATUS[0];

export function SuggestionsBoard({
  initial,
  meId,
  isAdmin,
  readOnly,
}: {
  initial: Suggestion[];
  meId: string;
  isAdmin: boolean;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [attachments, setAttachments] = useState<SuggestionAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("all");

  async function onFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/gerencial/task-upload", { method: "POST", body: fd });
        const j = await res.json().catch(() => null);
        if (res.ok && j?.url) {
          setAttachments((prev) => [
            ...prev,
            { url: String(j.url), type: fileType(file.type), name: String(j.name ?? file.name) },
          ]);
        }
      }
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/gerencial/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", title, description: desc, attachments }),
      });
      if (res.ok) {
        setTitle("");
        setDesc("");
        setAttachments([]);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: string) {
    await fetch("/api/gerencial/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set-status", id, status }),
    });
    router.refresh();
  }
  async function del(id: string) {
    if (!window.confirm("Excluir esta sugestão?")) return;
    await fetch("/api/gerencial/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    router.refresh();
  }

  const shown = filter === "all" ? initial : initial.filter((s) => s.status === filter);

  return (
    <div className="space-y-4">
      {!readOnly && (
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">Nova sugestão de ajuste</h2>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título — o que ajustar?" className={inputCls} />
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
            placeholder="Descreva a sugestão: comportamento atual, esperado, contexto…"
            className={cn(inputCls, "mt-2 resize-y")}
          />
          {attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {attachments.map((a, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-lg border border-line bg-subtle px-2 py-1 text-xs">
                  {a.type === "image" ? <ImageIcon className="h-3.5 w-3.5" /> : a.type === "video" ? <Video className="h-3.5 w-3.5" /> : <Paperclip className="h-3.5 w-3.5" />}
                  <span className="max-w-[140px] truncate">{a.name}</span>
                  <button onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))} className="text-muted hover:text-rose-500" aria-label="Remover anexo">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-subtle">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />} Anexar imagem/vídeo
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => {
                  void onFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            <button
              onClick={submit}
              disabled={busy || uploading || !title.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar sugestão
            </button>
          </div>
        </Card>
      )}

      {/* Filtro por status */}
      <div className="no-scrollbar flex flex-wrap gap-1.5">
        {[{ key: "all", label: "Todas" }, ...SUGGESTION_STATUS].map((s) => (
          <button
            key={s.key}
            onClick={() => setFilter(s.key)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              filter === s.key ? "bg-brand-600 text-white" : "bg-subtle text-muted hover:text-ink",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted">
          Nenhuma sugestão ainda. Seja o primeiro a sugerir uma melhoria. 💡
        </Card>
      ) : (
        <div className="space-y-3">
          {shown.map((s) => {
            const st = statusMeta(s.status);
            const canDelete = isAdmin || (s.authorId && s.authorId === meId);
            return (
              <Card key={s.id} className="p-4">
                <div className="mb-1.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{s.title}</p>
                    <p className="text-[11px] text-muted">
                      {s.authorName} · {fmtDate(s.createdAt)}
                    </p>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", st.tone)}>{st.label}</span>
                </div>
                {s.description && <p className="whitespace-pre-wrap text-sm text-ink/80">{s.description}</p>}

                {s.attachments.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                    {s.attachments.map((a, i) =>
                      a.type === "image" ? (
                        <a key={i} href={a.url} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={a.url} alt={a.name} className="h-28 w-full rounded-lg border border-line object-cover" />
                        </a>
                      ) : a.type === "video" ? (
                        <video key={i} src={a.url} controls className="h-28 w-full rounded-lg border border-line bg-black object-cover" />
                      ) : (
                        <a
                          key={i}
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex h-28 flex-col items-center justify-center gap-1 rounded-lg border border-line bg-subtle text-xs text-muted hover:bg-subtle-strong"
                        >
                          <Paperclip className="h-5 w-5" />
                          <span className="max-w-full truncate px-2">{a.name}</span>
                        </a>
                      ),
                    )}
                  </div>
                )}

                {!readOnly && (
                  <div className="mt-3 flex items-center gap-2 border-t border-line pt-2.5">
                    <span className="text-[11px] font-medium text-muted">Status:</span>
                    <select
                      value={s.status}
                      onChange={(e) => setStatus(s.id, e.target.value)}
                      className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-brand-400"
                    >
                      {SUGGESTION_STATUS.map((o) => (
                        <option key={o.key} value={o.key}>{o.label}</option>
                      ))}
                    </select>
                    {canDelete && (
                      <button onClick={() => del(s.id)} className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-rose-500">
                        <Trash2 className="h-3.5 w-3.5" /> Excluir
                      </button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
