"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, Circle, Clock, CornerDownRight, History, Link2, Maximize2, MessageSquare, PanelRight, Paperclip, Plus, Send, SmilePlus, Square, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DELIVERY_PRIORITIES,
  OPS_TEAM,
  REACTION_EMOJIS,
  TASK_STAGES,
  TASK_TYPE_DURATIONS,
  type DeliveryFormField,
  type DeliveryPriority,
  type DeliveryTask,
  type TaskComment,
  type TaskStage,
} from "@/lib/data/operacao";

const stageLabel = (k: string) => TASK_STAGES.find((s) => s.key === k)?.label ?? k;

const memberName = (id: string) => OPS_TEAM.find((m) => m.id === id)?.name ?? id;

type CheckItem = { label: string; done: boolean };
let tmpSeq = 0;

function defaultChecklist(stage: TaskStage): CheckItem[] {
  return [
    { label: "Briefing lido", done: stage !== "todo" },
    { label: "Rascunho / primeira versão", done: stage !== "todo" },
    { label: "Revisão interna", done: ["review", "approval", "done"].includes(stage) },
    { label: "Aprovado pelo cliente", done: stage === "done" },
  ];
}

async function postDelivery(body: unknown): Promise<boolean> {
  const res = await fetch("/api/gerencial/delivery-tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  return Boolean(res?.ok);
}

/**
 * HUB14 — Task universal: detalhes + checklist + time tracking + comentários +
 * mover estágio + reatribuir responsável. No Painel real tudo é persistido.
 */
export function TaskUniversal({
  task,
  onClose,
  onStage,
  meName,
  onChanged,
}: {
  task: DeliveryTask;
  onClose: () => void;
  onStage?: (id: string, stage: TaskStage) => void;
  /** @deprecated multi-responsável agora usa OPS_TEAM direto. */
  team?: string[];
  meName?: string;
  onChanged?: () => void;
}) {
  const [stage, setStage] = useState<TaskStage>(task.stage);
  const [assignees, setAssignees] = useState<string[]>(
    task.assignees?.length ? task.assignees : task.assignee ? [task.assignee] : [],
  );
  const [priority, setPriority] = useState<DeliveryPriority>(task.priority ?? "media");
  const [requester, setRequester] = useState<string>(task.requester ?? "");
  const [logged, setLogged] = useState<number>(task.loggedH);
  const [addH, setAddH] = useState("");
  const [checklist, setChecklist] = useState<CheckItem[]>(() =>
    task.checklist?.length ? task.checklist : defaultChecklist(task.stage),
  );
  const [newItem, setNewItem] = useState("");
  const [comments, setComments] = useState<TaskComment[]>(() => task.comments ?? []);
  const [comment, setComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [pendingAtts, setPendingAtts] = useState<{ name: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [history, setHistory] = useState<{ from_status: string | null; to_status: string; changed_at: string }[]>([]);
  const [fields, setFields] = useState<DeliveryFormField[]>([]);
  const [custom, setCustom] = useState<Record<string, unknown>>(() => task.customFields ?? {});
  const [layout, setLayout] = useState<"modal" | "full" | "side">(() => {
    if (typeof window === "undefined") return "modal";
    const s = localStorage.getItem("delivery-task-layout");
    return s === "modal" || s === "full" || s === "side" ? s : "modal";
  });
  const [tab, setTab] = useState<"historico" | "comentarios">("comentarios");
  const [linkCopied, setLinkCopied] = useState(false);

  function pickLayout(l: "modal" | "full" | "side") {
    setLayout(l);
    try { localStorage.setItem("delivery-task-layout", l); } catch { /* ignore */ }
  }
  function copyLink() {
    if (typeof window !== "undefined") {
      void navigator.clipboard?.writeText(`${window.location.origin}/gerencial/entregas?task=${task.id}`);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 1500);
    }
  }

  useEffect(() => {
    let alive = true;
    void fetch(`/api/gerencial/delivery-tasks?history=${task.id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (alive) setHistory(j.history ?? []); })
      .catch(() => {});
    void fetch("/api/gerencial/delivery-fields", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (alive) setFields(j.fields ?? []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [task.id]);

  function saveCustom(next: Record<string, unknown>) {
    setCustom(next);
    void postDelivery({ action: "set-custom", id: task.id, customFields: next });
  }
  const setField = (key: string, value: unknown) => saveCustom({ ...custom, [key]: value });

  const author = meName || "Você";
  const primary = assignees[0] ?? "";

  function changeStage(s: TaskStage) {
    setStage(s);
    onStage?.(task.id, s);
  }

  function toggleAssignee(id: string) {
    const next = assignees.includes(id) ? assignees.filter((x) => x !== id) : [...assignees, id];
    setAssignees(next);
    void postDelivery({ action: "set-assignees", id: task.id, assignees: next }).then(() => onChanged?.());
  }
  function changePriority(p: DeliveryPriority) {
    setPriority(p);
    void postDelivery({ action: "set-priority", id: task.id, priority: p });
  }
  function changeRequester(r: string) {
    setRequester(r);
    void postDelivery({ action: "set-requester", id: task.id, requester: r });
  }

  function persistChecklist(next: CheckItem[]) {
    setChecklist(next);
    void postDelivery({ action: "set-checklist", id: task.id, checklist: next });
  }
  function toggleItem(i: number) {
    persistChecklist(checklist.map((x, j) => (j === i ? { ...x, done: !x.done } : x)));
  }
  function addItem() {
    const label = newItem.trim();
    if (!label) return;
    persistChecklist([...checklist, { label, done: false }]);
    setNewItem("");
  }

  function addComment() {
    const text = comment.trim();
    if (!text && pendingAtts.length === 0) return;
    const entry: TaskComment = {
      id: `tmp-${tmpSeq++}`,
      author,
      text,
      parentId: replyTo ?? undefined,
      reactions: {},
      attachments: pendingAtts,
      createdAt: new Date().toISOString(),
    };
    setComments((p) => [...p, entry]);
    void postDelivery({
      action: "add-comment",
      id: task.id,
      comment: { author, text, parentId: replyTo ?? undefined, attachments: pendingAtts },
    });
    setComment("");
    setReplyTo(null);
    setPendingAtts([]);
  }

  function toggleReact(commentId: string, emoji: string) {
    setPickerFor(null);
    setComments((prev) =>
      prev.map((c) => {
        if (c.id !== commentId) return c;
        const reactions = { ...(c.reactions ?? {}) };
        const set = new Set(reactions[emoji] ?? []);
        if (set.has(author)) set.delete(author);
        else set.add(author);
        if (set.size) reactions[emoji] = [...set];
        else delete reactions[emoji];
        return { ...c, reactions };
      }),
    );
    void postDelivery({ action: "react-comment", id: task.id, commentId, emoji, comment: { author } });
  }

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

  async function logHours() {
    const h = Number(addH.replace(",", "."));
    if (!Number.isFinite(h) || h === 0) return;
    setLogged((v) => Math.max(0, v + h));
    setAddH("");
    await postDelivery({ action: "log-hours", id: task.id, hours: h });
  }

  const doneCount = checklist.filter((c) => c.done).length;
  const prioMeta = DELIVERY_PRIORITIES.find((p) => p.key === priority);

  const outer =
    layout === "modal" ? "items-center justify-center p-2 sm:p-4" : layout === "side" ? "justify-end" : "";
  const panelCls = {
    modal: "h-[94vh] max-h-[1000px] w-full max-w-[1180px] rounded-2xl border",
    full: "h-full w-full",
    side: "h-full w-full max-w-[880px] border-l",
  }[layout];

  const commentsPane = (
    <>
      <div className="space-y-2">
        {comments.filter((c) => !c.parentId).length === 0 && (
          <p className="rounded-lg bg-canvas px-3 py-2 text-xs text-muted">Sem interações ainda. Registre a primeira abaixo.</p>
        )}
        {comments
          .filter((c) => !c.parentId)
          .map((c) => (
            <div key={c.id}>
              <CommentItem c={c} author={author} onReact={toggleReact} onReply={() => setReplyTo(c.id ?? null)} pickerFor={pickerFor} setPickerFor={setPickerFor} />
              {comments
                .filter((r) => r.parentId === c.id)
                .map((r) => (
                  <div key={r.id} className="ml-5 mt-1.5 border-l-2 border-line pl-2">
                    <CommentItem c={r} author={author} onReact={toggleReact} pickerFor={pickerFor} setPickerFor={setPickerFor} />
                  </div>
                ))}
            </div>
          ))}
      </div>
    </>
  );

  const composer = (
    <div className="border-t border-line p-3">
      {replyTo && (
        <p className="mb-1.5 flex items-center gap-1 text-[11px] text-muted">
          <CornerDownRight className="h-3 w-3" /> Respondendo…
          <button onClick={() => setReplyTo(null)} className="text-brand-500 hover:underline">cancelar</button>
        </p>
      )}
      {pendingAtts.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {pendingAtts.map((a, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-lg bg-subtle px-2 py-1 text-[11px] text-ink">
              <Paperclip className="h-3 w-3" /> {a.name}
              <button onClick={() => setPendingAtts((p) => p.filter((_, j) => j !== i))} className="text-muted hover:text-rose-500"><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addComment()}
          placeholder={replyTo ? "Responder…" : "Adicione uma nota…"}
          className="flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
        />
        <button onClick={() => fileRef.current?.click()} disabled={uploading} title="Anexar arquivo" className="rounded-lg border border-line px-2.5 py-1.5 text-muted hover:bg-subtle disabled:opacity-60">
          <Paperclip className="h-4 w-4" />
        </button>
        <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onPickFile(f); e.target.value = ""; }} />
        <button onClick={addComment} className="rounded-lg bg-ink px-2.5 py-1.5 text-surface"><Send className="h-4 w-4" /></button>
      </div>
    </div>
  );

  return (
    <div className={cn("fixed inset-0 z-50 flex", outer)}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={cn("relative z-10 flex flex-col overflow-hidden bg-surface shadow-2xl", panelCls, layout !== "full" && "border-line")}>
        {/* Barra superior */}
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm">
            <span className={cn("h-2 w-2 rounded-full", prioMeta?.dot ?? "bg-brand-500")} />
            <span className="font-medium text-muted">Tarefa</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="mr-1 flex items-center gap-0.5 rounded-lg border border-line p-0.5">
              {([["modal", Square], ["full", Maximize2], ["side", PanelRight]] as const).map(([k, Icon]) => (
                <button
                  key={k}
                  onClick={() => pickLayout(k)}
                  title={k === "modal" ? "Central" : k === "full" ? "Tela cheia" : "Barra lateral"}
                  className={cn("rounded-md p-1.5", layout === k ? "bg-brand-500/15 text-brand-600" : "text-muted hover:bg-subtle")}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
            <button onClick={copyLink} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-subtle hover:text-ink">
              <Link2 className="h-3.5 w-3.5" /> {linkCopied ? "Copiado!" : "Copiar link"}
            </button>
            <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-subtle"><X className="h-5 w-5" /></button>
          </div>
        </div>

        {/* Corpo: 2 colunas */}
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_380px]">
          {/* Coluna principal */}
          <div className="min-w-0 space-y-5 overflow-y-auto border-b border-line p-5 lg:border-b-0 lg:border-r">
            <div>
              <p className="text-xs text-muted">{task.client}</p>
              <h2 className="text-xl font-bold text-ink">{task.title}</h2>
            </div>

            {/* Responsáveis */}
            <Row label="Responsáveis">
              <div className="flex flex-wrap gap-1.5">
                {OPS_TEAM.map((m) => {
                  const on = assignees.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggleAssignee(m.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                        on ? "border-brand-400 bg-brand-500/10 text-ink" : "border-line text-muted hover:text-ink",
                      )}
                    >
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-subtle-strong text-[8px] font-bold text-ink">{m.initials}</span>
                      {m.name}
                    </button>
                  );
                })}
              </div>
            </Row>

            {/* Estágio */}
            <Row label="Status">
              <div className="flex flex-wrap gap-1.5">
                {TASK_STAGES.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => changeStage(s.key)}
                    className={cn("rounded-lg px-2.5 py-1 text-xs font-medium", stage === s.key ? "bg-brand-600 text-white" : "border border-line text-ink hover:bg-subtle")}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </Row>

            {/* Prioridade + solicitante + metadados */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Row label="Prioridade">
                <div className="flex flex-wrap gap-1">
                  {DELIVERY_PRIORITIES.map((p) => (
                    <button
                      key={p.key}
                      onClick={() => changePriority(p.key)}
                      className={cn("inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold", priority === p.key ? p.chip : "text-muted hover:text-ink")}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", p.dot)} /> {p.label}
                    </button>
                  ))}
                </div>
              </Row>
              <Row label="Solicitante">
                <select
                  value={requester}
                  onChange={(e) => changeRequester(e.target.value)}
                  className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
                >
                  <option value="">—</option>
                  {OPS_TEAM.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
                </select>
              </Row>
              <D label="Prazo" value={task.dueLabel} tone={task.late ? "text-rose-500" : undefined} />
              <D label="Origem" value={task.origin} />
              <D label="Tipo" value={`${task.type} · ${TASK_TYPE_DURATIONS[task.type]}min`} />
            </div>

            {/* Campos personalizados */}
            {fields.length > 0 && (
              <div className="grid grid-cols-1 gap-3 border-t border-line pt-4 sm:grid-cols-2">
                {fields.map((f) => {
                  const v = custom[f.fieldKey];
                  const inputCls = "mt-0.5 w-full rounded-lg border border-line bg-surface px-2 py-1 text-sm text-ink outline-none focus:border-brand-400";
                  return (
                    <div key={f.id} className={f.fieldType === "textarea" ? "sm:col-span-2" : ""}>
                      <p className="text-xs text-muted">{f.label}{f.required && " *"}</p>
                      {f.fieldType === "textarea" ? (
                        <textarea value={String(v ?? "")} onChange={(e) => setField(f.fieldKey, e.target.value)} rows={2} className={cn(inputCls, "resize-y")} />
                      ) : f.fieldType === "select" ? (
                        <select value={String(v ?? "")} onChange={(e) => setField(f.fieldKey, e.target.value)} className={inputCls}>
                          <option value="">—</option>
                          {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      ) : f.fieldType === "checkbox" ? (
                        <button onClick={() => setField(f.fieldKey, !v)} className={cn("mt-1 flex items-center gap-1.5 text-sm", v ? "text-emerald-600" : "text-muted")}>
                          {v ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />} {v ? "Sim" : "Não"}
                        </button>
                      ) : (
                        <input type={f.fieldType === "number" ? "number" : f.fieldType === "date" ? "date" : "text"} value={String(v ?? "")} onChange={(e) => setField(f.fieldKey, e.target.value)} className={inputCls} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Checklist */}
            <div className="border-t border-line pt-4">
              <p className="mb-1.5 text-xs font-medium text-muted">Checklist de entrega · {doneCount}/{checklist.length}</p>
              <div className="space-y-1">
                {checklist.map((c, i) => (
                  <button key={i} onClick={() => toggleItem(i)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-subtle">
                    {c.done ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4 text-muted" />}
                    <span className={cn(c.done ? "text-muted line-through" : "text-ink")}>{c.label}</span>
                  </button>
                ))}
              </div>
              <div className="mt-1.5 flex gap-1.5">
                <input value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addItem()} placeholder="Novo item…" className="flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-brand-400" />
              </div>
            </div>

            {/* Time tracking */}
            <div className="rounded-xl bg-subtle p-3">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink">
                <Clock className="h-3.5 w-3.5" /> Time tracking
              </div>
              <p className="text-xs text-muted">{memberName(primary)}: {logged}h registradas de {task.estimateH}h estimadas.</p>
              <div className="mt-2 flex gap-1.5">
                <input value={addH} onChange={(e) => setAddH(e.target.value)} onKeyDown={(e) => e.key === "Enter" && logHours()} inputMode="decimal" placeholder="+ horas (ex.: 1,5)" className="w-32 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-brand-400" />
                <button onClick={logHours} className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-subtle">
                  <Plus className="h-3.5 w-3.5" /> Apontar
                </button>
              </div>
            </div>
          </div>

          {/* Coluna lateral: Histórico / Comentários */}
          <div className="flex min-h-0 min-w-0 flex-col">
            <div className="flex shrink-0 gap-1 border-b border-line px-3 pt-2">
              {([["historico", "Histórico", History], ["comentarios", "Comentários", MessageSquare]] as const).map(([k, label, Icon]) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={cn("inline-flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-sm font-medium", tab === k ? "border-b-2 border-brand-500 text-ink" : "text-muted hover:text-ink")}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {tab === "historico" ? (
                history.length === 0 ? (
                  <p className="rounded-lg bg-canvas px-3 py-2 text-xs text-muted">Sem mudanças de etapa ainda.</p>
                ) : (
                  <ol className="relative ml-1 space-y-2 border-l border-line pl-4">
                    {history.map((h, i) => (
                      <li key={i} className="relative text-xs">
                        <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-brand-500/40" />
                        <span className="text-ink/90">
                          {h.from_status ? `${stageLabel(h.from_status)} → ` : ""}
                          <span className="font-medium">{stageLabel(h.to_status)}</span>
                        </span>
                        <span className="ml-1.5 text-muted">
                          {new Date(h.changed_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}{" "}
                          {new Date(h.changed_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </li>
                    ))}
                  </ol>
                )
              ) : (
                commentsPane
              )}
            </div>
            {tab === "comentarios" && composer}
          </div>
        </div>

        {/* Barra de ações */}
        <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-3">
          <button
            onClick={() => { if (confirm("Excluir esta tarefa?")) { void postDelivery({ action: "delete", id: task.id }).then(() => { onChanged?.(); onClose(); }); } }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-medium text-muted hover:bg-rose-500/10 hover:text-rose-500"
          >
            <Trash2 className="h-4 w-4" /> Excluir
          </button>
          <div className="flex items-center gap-2">
            {stage !== "done" && (
              <button onClick={() => changeStage("done")} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> Concluir
              </button>
            )}
            <button onClick={onClose} className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-subtle">Fechar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CommentItem({
  c,
  author,
  onReact,
  onReply,
  pickerFor,
  setPickerFor,
}: {
  c: TaskComment;
  author: string;
  onReact: (commentId: string, emoji: string) => void;
  onReply?: () => void;
  pickerFor: string | null;
  setPickerFor: (v: string | null) => void;
}) {
  const id = c.id ?? "";
  const reactionEntries = Object.entries(c.reactions ?? {}).filter(([, arr]) => arr.length);
  return (
    <div className="rounded-lg bg-canvas px-3 py-2">
      <p className="text-[11px] font-semibold text-ink">{c.author}</p>
      {c.text && <p className="whitespace-pre-wrap text-sm text-ink/90">{c.text}</p>}
      {c.attachments && c.attachments.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {c.attachments.map((a, i) => (
            <a key={i} href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-0.5 text-[11px] font-medium text-brand-600 hover:bg-subtle">
              <Paperclip className="h-3 w-3" /> {a.name}
            </a>
          ))}
        </div>
      )}
      <div className="mt-1 flex flex-wrap items-center gap-1">
        {reactionEntries.map(([emoji, arr]) => (
          <button
            key={emoji}
            onClick={() => onReact(id, emoji)}
            title={arr.join(", ")}
            className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px]", arr.includes(author) ? "bg-brand-500/15 text-brand-600" : "bg-subtle text-muted hover:text-ink")}
          >
            {emoji} {arr.length}
          </button>
        ))}
        <div className="relative">
          <button onClick={() => setPickerFor(pickerFor === id ? null : id)} className="rounded-full p-0.5 text-muted hover:text-ink">
            <SmilePlus className="h-3.5 w-3.5" />
          </button>
          {pickerFor === id && (
            <div className="absolute z-10 mt-1 flex gap-0.5 rounded-lg border border-line bg-surface p-1 shadow-lg">
              {REACTION_EMOJIS.map((e) => (
                <button key={e} onClick={() => onReact(id, e)} className="rounded px-1 text-sm hover:bg-subtle">{e}</button>
              ))}
            </div>
          )}
        </div>
        {onReply && <button onClick={onReply} className="ml-1 text-[11px] font-medium text-muted hover:text-ink">Responder</button>}
      </div>
    </div>
  );
}

function D({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className={cn("text-sm font-medium text-ink", tone)}>{value}</p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs text-muted">{label}</p>
      {children}
    </div>
  );
}
