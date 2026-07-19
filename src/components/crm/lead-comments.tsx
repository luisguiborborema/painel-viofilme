"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerUpLeft, Loader2, Paperclip, Pencil, Send, SmilePlus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { dayMonth, clockLabel } from "@/lib/datetime";
import type { CrmComment } from "@/lib/data/crm";

const EMOJIS = ["👍", "❤️", "🎉", "😄", "🙌", "👀", "🔥", "✅"];

function initials(name?: string) {
  if (!name) return "•";
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

async function api(payload: Record<string, unknown>) {
  return fetch("/api/crm/comments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((r) => r.json())
    .catch(() => null);
}

/**
 * Aba de Comentários internos do negócio: criar, responder (1 nível), editar,
 * excluir e reagir com emoji. Otimista — funciona mesmo em modo demo.
 */
export function LeadComments({
  leadId,
  initial,
  currentUser,
  team = [],
}: {
  leadId: string;
  initial: CrmComment[];
  currentUser: string;
  team?: string[];
}) {
  const router = useRouter();
  const me = currentUser || "Você";
  const [comments, setComments] = useState<CrmComment[]>(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingAtts, setPendingAtts] = useState<{ name: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const tmpSeq = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPickFile(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/gerencial/task-upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) setPendingAtts((p) => [...p, { name: data.name, url: data.url }]);
    } finally {
      setUploading(false);
    }
  }

  // Autocomplete de @menção (mostra a equipe ao digitar "@…").
  const mentionMatch = text.match(/@([^@\n]{0,40})$/);
  const mentionQuery = mentionMatch ? mentionMatch[1] : null;
  const mentionSuggestions =
    mentionQuery != null
      ? team.filter((n) => n.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 5)
      : [];
  function pickMention(name: string) {
    setText((prev) => prev.replace(/@([^@\n]{0,40})$/, `@${name} `));
  }

  const roots = comments.filter((c) => !c.parentId);
  const repliesOf = (id: string) =>
    comments.filter((c) => c.parentId === id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  async function post(body: string, parentId?: string, attachments: { name: string; url: string }[] = []) {
    const tmpId = `tmp-${tmpSeq.current++}`;
    const optimistic: CrmComment = {
      id: tmpId,
      leadId,
      parentId: parentId ?? null,
      author: me,
      authorId: null,
      body,
      reactions: {},
      attachments,
      edited: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setComments((prev) => [...prev, optimistic]);
    const res = await api({ action: "create", leadId, body, parentId: parentId ?? null, attachments });
    if (res?.id) {
      setComments((prev) =>
        prev.map((c) => (c.id === tmpId ? { ...c, id: res.id, createdAt: res.createdAt ?? c.createdAt } : c)),
      );
    }
    router.refresh();
  }

  async function submitRoot() {
    if ((!text.trim() && pendingAtts.length === 0) || busy) return;
    setBusy(true);
    await post(text.trim(), undefined, pendingAtts);
    setText("");
    setPendingAtts([]);
    setBusy(false);
  }

  async function edit(id: string, body: string) {
    setComments((prev) => prev.map((c) => (c.id === id ? { ...c, body, edited: true } : c)));
    await api({ action: "edit", id, body });
  }

  async function remove(id: string) {
    setComments((prev) => prev.filter((c) => c.id !== id && c.parentId !== id));
    await api({ action: "delete", id });
    router.refresh();
  }

  function react(id: string, emoji: string) {
    setComments((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const set = new Set(c.reactions[emoji] ?? []);
        if (set.has(me)) set.delete(me);
        else set.add(me);
        const next = { ...c.reactions };
        if (set.size) next[emoji] = [...set];
        else delete next[emoji];
        return { ...c, reactions: next };
      }),
    );
    void api({ action: "react", id, emoji });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {roots.length === 0 && (
          <p className="pt-8 text-center text-sm text-muted">Nenhum comentário ainda.</p>
        )}
        {roots
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          .map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              replies={repliesOf(c.id)}
              me={me}
              onReply={(body) => post(body, c.id)}
              onEdit={edit}
              onDelete={remove}
              onReact={react}
            />
          ))}
      </div>

      <div className="border-t border-line p-3">
        <div className="relative">
          {mentionSuggestions.length > 0 && (
            <div className="absolute bottom-full left-0 z-20 mb-1 w-56 overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
              {mentionSuggestions.map((n) => (
                <button
                  key={n}
                  onClick={() => pickMention(n)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-ink hover:bg-subtle"
                >
                  <span className="text-muted">@</span>
                  {n}
                </button>
              ))}
            </div>
          )}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitRoot();
            }}
            rows={2}
            placeholder="Escreva um comentário… use @ para mencionar"
            className="w-full resize-none rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
          />
        </div>
        {pendingAtts.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {pendingAtts.map((a, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-lg bg-subtle px-2 py-1 text-[11px] text-ink">
                <Paperclip className="h-3 w-3" /> {a.name}
                <button onClick={() => setPendingAtts((p) => p.filter((_, j) => j !== i))} className="text-muted hover:text-rose-500"><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              title="Anexar arquivo"
              className="rounded-lg border border-line px-2 py-1.5 text-muted hover:bg-subtle disabled:opacity-60"
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
            </button>
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onPickFile(f); e.target.value = ""; }} />
            <p className="text-[11px] text-muted">⌘/Ctrl + Enter para enviar</p>
          </div>
          <button
            onClick={submitRoot}
            disabled={busy || (!text.trim() && pendingAtts.length === 0)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-surface hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Comentar
          </button>
        </div>
      </div>
    </div>
  );
}

function CommentItem({
  comment,
  replies = [],
  me,
  onReply,
  onEdit,
  onDelete,
  onReact,
  depth = 0,
}: {
  comment: CrmComment;
  replies?: CrmComment[];
  me: string;
  onReply?: (body: string) => void;
  onEdit: (id: string, body: string) => void;
  onDelete: (id: string) => void;
  onReact: (id: string, emoji: string) => void;
  depth?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const mine = (comment.author ?? "") === me;

  const reactionEntries = Object.entries(comment.reactions).filter(([, names]) => names.length > 0);

  return (
    <div className={cn(depth > 0 && "ml-3 border-l border-line pl-3")}>
      <div className="group flex gap-2.5">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-semibold text-brand-600">
          {initials(comment.author)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="font-medium text-ink">{comment.author ?? "—"}</span>
            <span>
              {dayMonth(comment.createdAt)} {clockLabel(comment.createdAt)}
            </span>
            {comment.edited && <span>· editado</span>}
          </div>

          {editing ? (
            <div className="mt-1">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
                className="w-full resize-none rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
              />
              <div className="mt-1 flex justify-end gap-1.5">
                <button
                  onClick={() => {
                    setEditing(false);
                    setDraft(comment.body);
                  }}
                  className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-subtle"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (draft.trim() && draft.trim() !== comment.body) onEdit(comment.id, draft.trim());
                    setEditing(false);
                  }}
                  className="rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700"
                >
                  Salvar
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-ink">{comment.body}</p>
          )}

          {/* Anexos */}
          {comment.attachments && comment.attachments.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {comment.attachments.map((a, i) => (
                <a key={i} href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-0.5 text-[11px] font-medium text-brand-600 hover:bg-subtle">
                  <Paperclip className="h-3 w-3" /> {a.name}
                </a>
              ))}
            </div>
          )}

          {/* Reações */}
          {reactionEntries.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {reactionEntries.map(([emoji, names]) => {
                const reacted = names.includes(me);
                return (
                  <button
                    key={emoji}
                    onClick={() => onReact(comment.id, emoji)}
                    title={names.join(", ")}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition-colors",
                      reacted
                        ? "border-brand-400 bg-brand-50 text-brand-700"
                        : "border-line bg-surface text-muted hover:bg-subtle",
                    )}
                  >
                    <span>{emoji}</span>
                    <span className="font-medium">{names.length}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Ações (aparecem no hover) */}
          <div className="relative mt-1 flex items-center gap-2.5 text-[11px] text-muted opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <button
              onClick={() => setPickerOpen((o) => !o)}
              className="inline-flex items-center gap-1 hover:text-ink"
            >
              <SmilePlus className="h-3.5 w-3.5" /> Reagir
            </button>
            {depth === 0 && onReply && (
              <button
                onClick={() => setReplying((r) => !r)}
                className="inline-flex items-center gap-1 hover:text-ink"
              >
                <CornerUpLeft className="h-3.5 w-3.5" /> Responder
              </button>
            )}
            {mine && (
              <button
                onClick={() => {
                  setDraft(comment.body);
                  setEditing(true);
                }}
                className="inline-flex items-center gap-1 hover:text-ink"
              >
                <Pencil className="h-3.5 w-3.5" /> Editar
              </button>
            )}
            {mine && (
              <button
                onClick={() => onDelete(comment.id)}
                className="inline-flex items-center gap-1 hover:text-rose-500"
              >
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </button>
            )}

            {pickerOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setPickerOpen(false)} />
                <div className="absolute bottom-full left-0 z-20 mb-1 flex gap-0.5 rounded-xl border border-line bg-surface p-1 shadow-lg">
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      onClick={() => {
                        onReact(comment.id, e);
                        setPickerOpen(false);
                      }}
                      className="rounded-md px-1.5 py-1 text-base hover:bg-subtle"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Composer de resposta */}
          {replying && onReply && (
            <div className="mt-2">
              <textarea
                autoFocus
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && replyText.trim()) {
                    onReply(replyText.trim());
                    setReplyText("");
                    setReplying(false);
                  }
                }}
                rows={2}
                placeholder="Responder…"
                className="w-full resize-none rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
              />
              <div className="mt-1 flex justify-end gap-1.5">
                <button
                  onClick={() => {
                    setReplying(false);
                    setReplyText("");
                  }}
                  className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-subtle"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (replyText.trim()) onReply(replyText.trim());
                    setReplyText("");
                    setReplying(false);
                  }}
                  disabled={!replyText.trim()}
                  className="rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  Responder
                </button>
              </div>
            </div>
          )}

          {/* Respostas */}
          {replies.length > 0 && (
            <div className="mt-3 space-y-3">
              {replies.map((r) => (
                <CommentItem
                  key={r.id}
                  comment={r}
                  me={me}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onReact={onReact}
                  depth={depth + 1}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
