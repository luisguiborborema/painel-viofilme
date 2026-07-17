"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Clapperboard,
  FileDown,
  History,
  ImageIcon,
  Camera,
  Link2,
  Plus,
  Presentation,
  Sparkles,
  Rocket,
  Send,
  Flag,
  ListChecks,
  MessageSquare,
  CheckSquare,
  Square,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ART_DIRECTIONS,
  EDITORIAL_STAGES,
  OPS_TEAM,
  TASK_STAGES,
  type ArtDirection,
  type EditorialFormat,
  type EditorialLine,
  type EditorialPost,
  type EditorialRef,
  type EditorialStage,
  type TaskStage,
} from "@/lib/data/operacao";

const FORMAT_FILTERS: ("Todos" | EditorialFormat)[] = ["Todos", "Feed", "Reels", "Stories", "Carrossel"];
const FORMAT_COLOR: Record<EditorialFormat, string> = {
  Feed: "bg-sky-500/15 text-sky-500",
  Reels: "bg-rose-500/15 text-rose-500",
  Stories: "bg-violet-500/15 text-violet-500",
  Carrossel: "bg-emerald-500/15 text-emerald-600",
};
const FORMATS: EditorialFormat[] = ["Feed", "Reels", "Stories", "Carrossel"];

const ART_CONSEQUENCE: Record<ArtDirection, string> = {
  "Media Day": "→ entra no checklist do próximo Media Day (VioDay).",
  "Banco do cliente": "→ puxa do Hub de ativos de marca.",
  "Imagem da internet": "→ instrução registrada no briefing do designer.",
  "Motion design": "→ instrução registrada no briefing do designer.",
  Outro: "→ instrução registrada no briefing do designer.",
};

// Post → task de produção: formato orgânico vira tipo de entrega.
const FORMAT_TO_TYPE: Record<EditorialFormat, string> = {
  Reels: "Vídeo",
  Feed: "Arte",
  Stories: "Arte",
  Carrossel: "Arte",
};

// Estágio real da delivery task (live-sync do Kanban).
const TASK_STAGE_LABEL: Record<string, string> = {
  todo: "Backlog",
  doing: "Em produção",
  review: "Revisão interna",
  approval: "Aguardando cliente",
  done: "Publicado",
};

// Trilha de fases da ficha (Task universal) — display.
const POST_PHASES = [
  "Ideia", "Briefing", "Em produção", "Revisão interna",
  "Aprovação cliente", "Aprovado", "Agendado", "Publicado",
];

let refSeq = 1000;
let postSeq = 900;

function detectKind(url: string): EditorialRef["kind"] {
  if (/instagram\.com/i.test(url)) return "instagram";
  if (/pinterest\./i.test(url)) return "pinterest";
  if (/\.(png|jpe?g|webp|gif)(\?|$)/i.test(url)) return "image";
  return "link";
}

const REF_ICON: Record<EditorialRef["kind"], typeof Link2> = {
  image: ImageIcon,
  instagram: Camera,
  pinterest: Sparkles,
  link: Link2,
};

function Moodboard({ refs, onAdd, compact }: { refs: EditorialRef[]; onAdd: (r: EditorialRef) => void; compact?: boolean }) {
  const [url, setUrl] = useState("");
  function add() {
    const v = url.trim();
    if (!v) return;
    onAdd({ id: `ref-${refSeq++}`, kind: detectKind(v), url: v, label: v.replace(/^https?:\/\//, "").slice(0, 24) });
    setUrl("");
  }
  return (
    <div>
      <div className={cn("grid gap-2", compact ? "grid-cols-3" : "grid-cols-4 sm:grid-cols-6")}>
        {refs.map((r) => {
          const Icon = REF_ICON[r.kind];
          const tile = (
            <div className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-line bg-canvas p-1 text-center">
              <Icon className="h-4 w-4 text-brand-500" />
              <span className="line-clamp-2 text-[9px] text-muted">{r.label ?? r.kind}</span>
            </div>
          );
          return r.url ? (
            <a key={r.id} href={r.url} target="_blank" rel="noreferrer" title={r.url} className="hover:opacity-80">{tile}</a>
          ) : (
            <div key={r.id}>{tile}</div>
          );
        })}
        <button
          onClick={() => onAdd({ id: `ref-${refSeq++}`, kind: "image", label: "Imagem anexada" })}
          title="Anexar imagem (simulado)"
          className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-line text-muted hover:border-brand-400 hover:text-brand-500"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2 flex gap-1.5">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Colar link (Instagram, Pinterest, imagem…)"
          className="flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-brand-400"
        />
        <button onClick={add} className="rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">Add</button>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-right text-sm font-medium text-ink">{value}</span>
    </div>
  );
}

function PostCard({ post, onOpen, taskStage }: { post: EditorialPost; onOpen: () => void; taskStage?: string }) {
  const [art, setArt] = useState<ArtDirection>(post.artDirection);
  const [refs, setRefs] = useState<EditorialRef[]>(post.references);
  const [openMood, setOpenMood] = useState(false);

  return (
    <Card className="flex flex-col p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-subtle text-xs font-bold text-ink">
          {String(post.n).padStart(2, "0")}
        </span>
        <span className="text-xs text-muted">{post.date} ({post.weekday})</span>
      </div>
      <button onClick={onOpen} className="text-left text-sm font-medium text-ink hover:text-brand-600">
        {post.title}
      </button>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", FORMAT_COLOR[post.format])}>{post.format}</span>
        <span className="rounded-full bg-subtle-strong px-2 py-0.5 text-[11px] font-medium text-muted">{post.pillar}</span>
        {art === "Media Day" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
            <Clapperboard className="h-3 w-3" /> VioDay
          </span>
        )}
        {taskStage && (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/15 px-2 py-0.5 text-[10px] font-semibold text-brand-600">
            <Rocket className="h-3 w-3" /> {TASK_STAGE_LABEL[taskStage] ?? "Em produção"}
          </span>
        )}
      </div>
      <p className="mt-2 flex-1 text-xs text-muted">{post.description}</p>

      {/* Direcionamento de arte */}
      <div className="mt-3 border-t border-line pt-2.5">
        <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted">Direcionamento de arte</label>
        <select
          value={art}
          onChange={(e) => setArt(e.target.value as ArtDirection)}
          className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-ink outline-none focus:border-brand-400"
        >
          {ART_DIRECTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <p className="mt-1 text-[10px] text-muted">{ART_CONSEQUENCE[art]}</p>
      </div>

      {/* Moodboard do post */}
      <div className="mt-2 flex items-center justify-between">
        <button onClick={() => setOpenMood((o) => !o)} className="text-[11px] font-medium text-brand-500 hover:text-brand-600">
          {openMood ? "Ocultar" : "Referências"} ({refs.length})
        </button>
        <button onClick={onOpen} className="text-[11px] font-medium text-muted hover:text-ink">Abrir ficha →</button>
      </div>
      {openMood && (
        <div className="mt-2">
          <Moodboard refs={refs} onAdd={(r) => setRefs((p) => [...p, r])} compact />
        </div>
      )}
    </Card>
  );
}

// Mapeia o estágio da delivery task para a fase da trilha da LE.
const PHASE_FOR_STAGE: Record<TaskStage, number> = { todo: 2, doing: 2, review: 3, approval: 4, done: 7 };
const DEFAULT_CHECKLIST = ["Briefing lido", "Rascunho / 1ª versão", "Revisão interna", "Aprovado pelo cliente"];
const dtx = "/api/gerencial/delivery-tasks";

/** Ficha da Task/Post (Task universal) — 2 colunas + trilha de fases. */
function PostFicha({
  post,
  clientId,
  clientName,
  lineId,
  narrativa,
  mode,
  onClose,
  onCreated,
  onAdd,
  onSaved,
}: {
  post: EditorialPost;
  clientId: string;
  clientName: string;
  lineId?: string;
  narrativa: string;
  mode: "view" | "new";
  onClose: () => void;
  onCreated: (n: number, taskId: string) => void;
  onAdd: (p: EditorialPost) => void;
  onSaved: (p: EditorialPost) => void;
}) {
  const [title, setTitle] = useState(post.title);
  const [tema, setTema] = useState(post.tema ?? "");
  const [format, setFormat] = useState<EditorialFormat>(post.format);
  const [pillar, setPillar] = useState(post.pillar);
  const [roteiro, setRoteiro] = useState(post.description);
  const [legenda, setLegenda] = useState(post.legenda ?? "");
  const [art, setArt] = useState<ArtDirection>(post.artDirection);
  const [assignee, setAssignee] = useState(post.assignee ?? "");
  const [secondary, setSecondary] = useState(post.assigneeSecondary ?? "");
  const [priority, setPriority] = useState<"normal" | "urgente">(post.priority ?? "normal");
  const [prazo, setPrazo] = useState(post.date !== "—" ? post.date : "");
  const [stage, setStage] = useState<TaskStage | null>(post.taskStage ?? null);
  const [taskId, setTaskId] = useState<string | undefined>(post.taskId);
  const [tab, setTab] = useState<"conteudo" | "checklist" | "comentarios">("conteudo");
  const [checks, setChecks] = useState<boolean[]>(DEFAULT_CHECKLIST.map(() => false));
  const [comments, setComments] = useState<{ author: string; text: string }[]>([]);
  const [newComment, setNewComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canonicalTitle = `[${clientName}] ${format.toUpperCase()}: ${title.trim() || "Sem título"}`;
  const activePhase = taskId && stage ? PHASE_FOR_STAGE[stage] : mode === "new" ? 0 : 1;
  const jsonHeaders = { "Content-Type": "application/json" };

  function currentPost(extraTaskId?: string): EditorialPost {
    return {
      ...post,
      title: title.trim() || "Novo post",
      tema,
      format,
      pillar: pillar.trim() || post.pillar,
      description: roteiro,
      legenda,
      artDirection: art,
      assignee,
      assigneeSecondary: secondary,
      priority,
      date: prazo || post.date,
      taskId: extraTaskId ?? taskId,
      taskStage: stage ?? post.taskStage,
    };
  }

  async function persistPost(extraTaskId?: string) {
    if (!lineId) return;
    await fetch("/api/gerencial/editorial", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        action: "upsert-post",
        lineId,
        post: {
          id: post.id,
          n: post.n,
          title: title.trim(),
          format,
          pillar,
          description: roteiro,
          legenda,
          artDirection: art,
          tema,
          assignee,
          assigneeSecondary: secondary,
          priority,
          postDate: prazo || undefined,
          weekday: post.weekday !== "—" ? post.weekday : undefined,
          taskId: extraTaskId ?? taskId,
        },
      }),
    });
  }

  async function saveFicha() {
    setSaving(true);
    setError(null);
    try {
      await persistPost();
      if (taskId && assignee) {
        await fetch(dtx, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ action: "set-assignee", id: taskId, assignee }) });
      }
      setSavedTick(true);
      window.setTimeout(() => setSavedTick(false), 1800);
      onSaved(currentPost());
    } catch {
      setError("Falha ao salvar a ficha.");
    } finally {
      setSaving(false);
    }
  }

  async function generateTask(targetStage: TaskStage = "todo"): Promise<string | undefined> {
    const res = await fetch(dtx, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ action: "create", title: canonicalTitle, clientId, type: FORMAT_TO_TYPE[format], origin: "Linha editorial", stage: targetStage, assignee: assignee || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    const realId = data?.id && data.id !== "demo" ? String(data.id) : undefined;
    const id = realId ?? `le-${postSeq++}`;
    if (realId) {
      const brief = [
        art === "Media Day" && "Direcionamento: Media Day (VioDay)",
        pillar && `Pilar: ${pillar}`,
        tema.trim() && `Tema: ${tema.trim()}`,
        roteiro.trim() && `Roteiro:\n${roteiro.trim()}`,
        legenda.trim() && `Legenda:\n${legenda.trim()}`,
      ].filter(Boolean).join("\n");
      if (brief) {
        await fetch(dtx, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ action: "add-comment", id: realId, comment: { text: brief, author: "Linha editorial" } }) });
      }
    }
    setTaskId(realId ?? id);
    setStage(targetStage);
    await persistPost(realId ?? id);
    onCreated(post.n, id);
    return realId;
  }

  async function onGenerate() {
    setSaving(true);
    setError(null);
    try {
      await generateTask("todo");
    } catch {
      setError("Falha ao gerar a task.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStage(s: TaskStage) {
    setStage(s);
    if (taskId) {
      await fetch(dtx, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ action: "set-stage", id: taskId, stage: s }) });
      onSaved({ ...currentPost(), taskStage: s });
    }
  }

  async function enviarAprovacao() {
    setSaving(true);
    setError(null);
    try {
      if (!taskId) await generateTask("approval");
      else await changeStage("approval");
      setStage("approval");
    } catch {
      setError("Falha ao enviar para aprovação.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleCheck(i: number) {
    const next = checks.map((v, idx) => (idx === i ? !v : v));
    setChecks(next);
    if (taskId) {
      await fetch(dtx, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ action: "set-checklist", id: taskId, checklist: DEFAULT_CHECKLIST.map((label, idx) => ({ label, done: next[idx] })) }),
      });
    }
  }

  async function addComment() {
    const text = newComment.trim();
    if (!text) return;
    setComments((prev) => [...prev, { author: "Equipe", text }]);
    setNewComment("");
    if (taskId) {
      await fetch(dtx, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ action: "add-comment", id: taskId, comment: { text, author: "Equipe" } }) });
    }
  }

  function addToLine() {
    void persistPost();
    onAdd(currentPost());
    onClose();
  }

  const field = "h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand-400";
  const checkDone = checks.filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8">
      <div className="w-full max-w-4xl rounded-2xl border border-line bg-surface shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
              {mode === "new" ? "Novo post · sugestão editável" : "Ficha do post · sugestão editável"}
            </p>
            <p className="truncate text-sm font-semibold text-ink">{canonicalTitle}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-subtle hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Trilha de fases (reflete o estágio real da task) */}
        <div className="no-scrollbar flex items-center gap-1 overflow-x-auto border-b border-line px-5 py-2.5">
          {POST_PHASES.map((ph, i) => (
            <span
              key={ph}
              className={cn(
                "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium",
                i === activePhase ? "bg-brand-500 text-white" : i < activePhase ? "bg-emerald-500/15 text-emerald-600" : "bg-subtle text-muted",
              )}
            >
              {i < activePhase && <Check className="h-2.5 w-2.5" />} {ph}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 px-5 py-4 lg:grid-cols-3">
          {/* Coluna de conteúdo */}
          <div className="space-y-3 lg:col-span-2">
            <div className="flex gap-1 border-b border-line">
              {([["conteudo", "Conteúdo", ListChecks], ["checklist", `Checklist ${checkDone}/${DEFAULT_CHECKLIST.length}`, CheckSquare], ["comentarios", "Comentários", MessageSquare]] as const).map(([k, label, Icon]) => (
                <button key={k} onClick={() => setTab(k)} className={cn("inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium", tab === k ? "border-brand-500 text-ink" : "border-transparent text-muted hover:text-ink")}>
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>

            {tab === "conteudo" && (
              <div className="space-y-3">
                {narrativa && narrativa !== "—" && (
                  <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-600">Narrativa herdada</p>
                    <p className="mt-0.5 text-xs text-ink/90">{narrativa}</p>
                  </div>
                )}
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">Título / gancho</span>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">Tema</span>
                  <input value={tema} onChange={(e) => setTema(e.target.value)} placeholder='Ex.: Trabalho sem carteira. Formato: "Dúvida de Seguidor"' className={field} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">Roteiro / copy</span>
                  <textarea value={roteiro} onChange={(e) => setRoteiro(e.target.value)} rows={6} className="w-full resize-none rounded-xl border border-line bg-surface px-3 py-2 font-mono text-xs text-ink outline-none focus:border-brand-400" placeholder="Gancho, desenvolvimento, cenas, CTA — do jeito que a equipe escreve." />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">Legenda (vai na publicação)</span>
                  <textarea value={legenda} onChange={(e) => setLegenda(e.target.value)} rows={2} className="w-full resize-none rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400" />
                </label>
              </div>
            )}

            {tab === "checklist" && (
              <ul className="space-y-1.5">
                {DEFAULT_CHECKLIST.map((label, i) => (
                  <li key={label}>
                    <button onClick={() => toggleCheck(i)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-subtle">
                      {checks[i] ? <CheckSquare className="h-4 w-4 text-emerald-500" /> : <Square className="h-4 w-4 text-muted" />}
                      <span className={checks[i] ? "text-muted line-through" : "text-ink"}>{label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {tab === "comentarios" && (
              <div className="space-y-2">
                {comments.length === 0 ? (
                  <p className="rounded-lg bg-subtle px-3 py-3 text-xs text-muted">Sem comentários. Histórico interno + status da aprovação no portal.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {comments.map((c, i) => (
                      <li key={i} className="rounded-lg bg-subtle px-3 py-2 text-sm">
                        <span className="text-[10px] font-semibold text-muted">{c.author}</span>
                        <p className="text-ink/90">{c.text}</p>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-1.5">
                  <input value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addComment()} placeholder="Comentar…" className="flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-brand-400" />
                  <button onClick={addComment} className="rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">Add</button>
                </div>
              </div>
            )}
          </div>

          {/* Coluna de execução */}
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Status</span>
              <select
                value={stage ?? ""}
                onChange={(e) => changeStage(e.target.value as TaskStage)}
                disabled={!taskId}
                className={cn(field, "px-2 disabled:opacity-60")}
              >
                {!taskId && <option value="">Sem task — gere a produção</option>}
                {TASK_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Responsável principal</span>
              <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={cn(field, "px-2")}>
                <option value="">—</option>
                {OPS_TEAM.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Secundário (opcional)</span>
              <select value={secondary} onChange={(e) => setSecondary(e.target.value)} className={cn(field, "px-2")}>
                <option value="">—</option>
                {OPS_TEAM.filter((m) => m.id !== assignee).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Prazo</span>
                <input value={prazo} onChange={(e) => setPrazo(e.target.value)} placeholder="11/05" className={field} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Formato</span>
                <select value={format} onChange={(e) => setFormat(e.target.value as EditorialFormat)} className={cn(field, "px-2")}>
                  {FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Pilar</span>
              <input value={pillar} onChange={(e) => setPillar(e.target.value)} placeholder="Sem pilar" className={field} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Direcionamento de arte</span>
              <select value={art} onChange={(e) => setArt(e.target.value as ArtDirection)} className={cn(field, "px-2")}>
                {ART_DIRECTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              {art === "Media Day" && <p className="mt-1 text-[10px] text-amber-600">→ entra no checklist do próximo VioDay.</p>}
            </label>
            <div>
              <span className="mb-1 block text-xs font-medium text-muted">Prioridade</span>
              <div className="flex gap-1.5">
                {(["normal", "urgente"] as const).map((p) => (
                  <button key={p} onClick={() => setPriority(p)} className={cn("inline-flex flex-1 items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium", priority === p ? (p === "urgente" ? "border-rose-400 bg-rose-500/10 text-rose-500" : "border-brand-400 bg-brand-500/10 text-ink") : "border-line text-muted hover:text-ink")}>
                    <Flag className="h-3 w-3" /> {p === "urgente" ? "Urgente" : "Normal"}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={enviarAprovacao}
              disabled={saving}
              className="mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-ink px-3 py-2 text-sm font-semibold text-surface hover:opacity-90 disabled:opacity-60"
            >
              <Send className="h-4 w-4" /> Enviar para aprovação do cliente
            </button>
          </div>
        </div>

        {error && <p className="px-5 text-xs font-medium text-rose-500">{error}</p>}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3.5">
          {savedTick && <span className="mr-auto inline-flex items-center gap-1 text-xs font-medium text-emerald-600"><Check className="h-3.5 w-3.5" /> Salvo</span>}
          <button onClick={onClose} className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-subtle">Fechar</button>
          {mode === "new" && (
            <button onClick={addToLine} className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-subtle">Adicionar à LE</button>
          )}
          <button onClick={saveFicha} disabled={saving} className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-subtle disabled:opacity-60">
            {saving ? "Salvando…" : "Salvar ficha"}
          </button>
          <button
            onClick={onGenerate}
            disabled={saving || !!taskId}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            <Rocket className="h-4 w-4" />
            {taskId ? "Em produção ✓" : saving ? "Gerando…" : "Gerar task de produção"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Modal "Criar LE" — ponto de partida (branco / duplicar do mês anterior). */
function NovaLEModal({
  data,
  clientId,
  onClose,
  onDone,
}: {
  data: EditorialLine;
  clientId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"branco" | "duplicar">(data.id ? "duplicar" : "branco");
  const [month, setMonth] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!month.trim()) {
      setError("Informe o mês da nova LE.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/gerencial/editorial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-line",
          clientId,
          month: month.trim(),
          objetivo: objetivo.trim() || undefined,
          duplicateFromId: mode === "duplicar" ? data.id : undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j?.error ?? "Falha ao criar a LE.");
        return;
      }
      onDone();
    } catch {
      setError("Falha de rede ao criar a LE.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-ink">Criar nova linha editorial</h2>
            <p className="text-xs text-muted">Escolha o ponto de partida — nada trava, dá para alternar depois.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-subtle hover:text-ink"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button onClick={() => setMode("branco")} className={cn("rounded-xl border p-3 text-left transition-colors", mode === "branco" ? "border-brand-400 bg-brand-500/10" : "border-line bg-subtle hover:border-brand-300")}>
              <p className="text-sm font-medium text-ink">Começar em branco</p>
              <p className="text-[11px] text-muted">Folha limpa.</p>
            </button>
            <button
              onClick={() => data.id && setMode("duplicar")}
              disabled={!data.id}
              className={cn("rounded-xl border p-3 text-left transition-colors disabled:opacity-50", mode === "duplicar" ? "border-brand-400 bg-brand-500/10" : "border-line bg-subtle hover:border-brand-300")}
            >
              <p className="text-sm font-medium text-ink">Duplicar {data.id ? data.month : "(sem LE prévia)"}</p>
              <p className="text-[11px] text-muted">Traz pilares e estrutura do mês anterior.</p>
            </button>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Mês da nova LE</span>
            <input value={month} onChange={(e) => setMonth(e.target.value)} placeholder="Ex.: Agosto/2026" className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand-400" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Objetivo / foco do mês</span>
            <textarea value={objetivo} onChange={(e) => setObjetivo(e.target.value)} rows={2} placeholder="Ex.: encher reservas de ter–qui" className="w-full resize-none rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400" />
          </label>
          {error && <p className="text-xs font-medium text-rose-500">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3.5">
          <button onClick={onClose} className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-subtle">Cancelar</button>
          <button onClick={create} disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            <Plus className="h-4 w-4" /> {saving ? "Criando…" : "Criar LE"}
          </button>
        </div>
      </div>
    </div>
  );
}

function emptyPost(): EditorialPost {
  return {
    n: postSeq++,
    date: "—",
    weekday: "—",
    title: "",
    format: "Feed",
    pillar: "",
    description: "",
    assetNote: "",
    artDirection: "Banco do cliente",
    references: [],
  };
}

export function LinhaEditorial({ data, clientId }: { data: EditorialLine; clientId: string }) {
  const router = useRouter();
  const lineId = data.id;
  const [filter, setFilter] = useState<"Todos" | EditorialFormat>("Todos");
  const [moodGeral, setMoodGeral] = useState<EditorialRef[]>(data.moodboardGeral);
  const [showHistory, setShowHistory] = useState(false);
  const [stage, setStage] = useState<EditorialStage>(data.stage);
  const [posts, setPosts] = useState<EditorialPost[]>(data.posts);
  const [ficha, setFicha] = useState<{ post: EditorialPost; mode: "view" | "new" } | null>(null);
  const [novaLE, setNovaLE] = useState(false);
  const [taskByPost, setTaskByPost] = useState<Record<number, string>>({});

  function changeStage(s: EditorialStage) {
    setStage(s);
    if (lineId) {
      void fetch("/api/gerencial/editorial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-stage", id: lineId, stage: s }),
      });
    }
  }

  const currentStageIdx = EDITORIAL_STAGES.findIndex((s) => s.key === stage);
  const shown = filter === "Todos" ? posts : posts.filter((p) => p.format === filter);

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink">Linha editorial — {data.month}</h2>
          <p className="text-sm text-muted">{data.clientName} · criada por {data.createdBy}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <button onClick={() => setShowHistory((s) => !s)} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-subtle">
              <History className="h-4 w-4" /> Histórico
            </button>
            {showHistory && (
              <div className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-line bg-surface p-1 shadow-lg">
                {data.history.map((h) => (
                  <button key={h.id} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-subtle">{h.month}</button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => setNovaLE(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-subtle">
            <Plus className="h-4 w-4" /> Nova LE
          </button>
          <a href={`/api/le/pdf?clientId=${clientId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-subtle">
            <FileDown className="h-4 w-4" /> Exportar PDF
          </a>
          <button
            onClick={() => alert("Doc A (apresentação visual) — template em construção. O botão já entrega os dados da LE quando o template ficar pronto.")}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            <Presentation className="h-4 w-4" /> Apresentar ao cliente
          </button>
        </div>
      </div>

      {/* Stepper — clicável (muda o estágio da LE) */}
      <div className="no-scrollbar flex items-center gap-1 overflow-x-auto">
        {EDITORIAL_STAGES.map((s, i) => {
          const isDone = i < currentStageIdx;
          const active = i === currentStageIdx;
          return (
            <div key={s.key} className="flex items-center">
              <button
                onClick={() => changeStage(s.key)}
                title="Definir estágio da LE"
                className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors", active ? "bg-brand-500 text-white" : isDone ? "bg-emerald-500/15 text-emerald-600" : "bg-surface text-muted hover:text-ink")}
              >
                {isDone && <Check className="h-3 w-3" />} {s.label}
              </button>
              {i < EDITORIAL_STAGES.length - 1 && <span className="mx-0.5 h-px w-4 bg-line" />}
            </div>
          );
        })}
      </div>

      {/* ── Nível 1: Cabeçalho estratégico (macro) ── */}
      <div className="rounded-2xl border border-brand-200 bg-brand-50/30 p-1">
        <p className="px-4 pt-2 text-[11px] font-semibold uppercase tracking-wide text-brand-600">Cabeçalho estratégico (macro)</p>
        <div className="grid grid-cols-1 gap-3 p-3 lg:grid-cols-3">
          <Card className="p-4 lg:col-span-2">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <StratField label="Datas comemorativas" value={data.datasComemorativas} />
              <StratField label="Reunião de aprovação" value={data.approvalMeeting} />
              <StratField label="Narrativa central" value={data.narrativaCentral} />
              <StratField label="Tensão narrativa" value={data.tensaoNarrativa} />
            </div>
            <div className="mt-3 border-t border-line pt-3">
              <p className="mb-2 text-xs font-semibold text-ink">Pilares de conteúdo</p>
              <div className="flex flex-wrap gap-2">
                {data.pillars.map((p) => (
                  <span key={p.name} className="inline-flex items-center gap-1.5 rounded-full bg-subtle px-2.5 py-1 text-xs text-ink">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} /> {p.name} · {p.posts}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-3 border-t border-line pt-3 text-xs text-muted">
              <Field label="Frequência" value={data.frequency} />
              <Field label="Redes" value={data.networks} />
              <Field label="Responsáveis" value={data.responsibles} />
            </div>
          </Card>

          <Card className="p-4">
            <p className="mb-2 text-xs font-semibold text-ink">Moodboard geral</p>
            <Moodboard refs={moodGeral} onAdd={(r) => setMoodGeral((p) => [...p, r])} />
          </Card>
        </div>
      </div>

      {/* ── Nível 2: Posts individuais (micro) ── */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">Posts individuais (micro) — {posts.length}</h3>
          <div className="flex flex-wrap items-center gap-1.5">
            {FORMAT_FILTERS.map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors", filter === f ? "bg-ink text-surface" : "bg-surface text-muted hover:text-ink")}>{f}</button>
            ))}
            <button onClick={() => setFicha({ post: emptyPost(), mode: "new" })} className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700"><Plus className="h-3 w-3" /> Post</button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => (
            <PostCard
              key={p.n}
              post={p}
              taskStage={p.taskStage ?? (taskByPost[p.n] ? "todo" : undefined)}
              onOpen={() => setFicha({ post: p, mode: "view" })}
            />
          ))}
        </div>
      </div>

      {ficha && (
        <PostFicha
          post={ficha.post}
          mode={ficha.mode}
          clientId={clientId}
          clientName={data.clientName}
          lineId={lineId}
          narrativa={data.narrativaCentral}
          onClose={() => setFicha(null)}
          onCreated={(n, taskId) => setTaskByPost((prev) => ({ ...prev, [n]: taskId }))}
          onAdd={(p) => setPosts((prev) => [p, ...prev])}
          onSaved={(p) => setPosts((prev) => prev.map((x) => (x.n === p.n ? p : x)))}
        />
      )}
      {novaLE && (
        <NovaLEModal
          data={data}
          clientId={clientId}
          onClose={() => setNovaLE(false)}
          onDone={() => {
            setNovaLE(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function StratField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="text-sm text-ink">{value}</p>
    </div>
  );
}
