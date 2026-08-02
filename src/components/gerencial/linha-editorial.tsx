"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  Trash2,
  Send,
  CheckSquare,
  Square,
  MessageSquare,
  Clock,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ART_DIRECTIONS,
  EDITORIAL_STAGES,
  OPS_TEAM,
  TASK_STAGES,
  TASK_TYPE_DURATIONS,
  deliveryDateFor,
  deliveryTaskToPost,
  ddmmFromIso,
  type ArtDirection,
  type EditorialFormat,
  type EditorialLine,
  type EditorialDraft,
  type EditorialPost,
  type EditorialPillar,
  type EditorialRef,
  type EditorialStage,
  type DeliveryTask,
  type TaskStage,
  type TaskType,
  type ClientDeliverable,
} from "@/lib/data/operacao";

const FORMAT_FILTERS: ("Todos" | EditorialFormat)[] = ["Todos", "Feed", "Reels", "Stories", "Carrossel"];
const FORMAT_COLOR: Record<EditorialFormat, string> = {
  Feed: "bg-sky-500/15 text-sky-500",
  Reels: "bg-rose-500/15 text-rose-500",
  Stories: "bg-violet-500/15 text-violet-500",
  Carrossel: "bg-emerald-500/15 text-emerald-600",
};
const FORMATS: EditorialFormat[] = ["Feed", "Reels", "Stories", "Carrossel"];


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

// Item do feed de atividade (C4): comentário ou evento de status.
type ActItem = { ts: number; kind: "comment" | "event"; author?: string; text?: string; from?: string | null; to?: string };

// Ação principal contextual por estágio (C5) — o botão muda conforme a fase.
const NEXT_ACTION: Record<string, { label: string; stage: TaskStage }> = {
  todo: { label: "Mover para produção", stage: "doing" },
  doing: { label: "Enviar para revisão interna", stage: "review" },
  review: { label: "Enviar para aprovação do cliente", stage: "approval" },
  approval: { label: "Marcar como aprovado / publicado", stage: "done" },
};

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

function Moodboard({ refs, onAdd, onRemove, compact }: { refs: EditorialRef[]; onAdd: (r: EditorialRef) => void; onRemove?: (id: string) => void; compact?: boolean }) {
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
          const inner = r.url ? (
            <a href={r.url} target="_blank" rel="noreferrer" title={r.url} className="block hover:opacity-80">{tile}</a>
          ) : tile;
          return (
            <div key={r.id} className="group relative">
              {inner}
              {onRemove && (
                <button
                  onClick={(e) => { e.preventDefault(); onRemove(r.id); }}
                  title="Remover referência"
                  className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-white group-hover:flex"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
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

/** Card resumido (B1): denso e de altura uniforme — o roteiro vive só na ficha. */
function PostCard({ post, onOpen, taskStage, pillarColor }: { post: EditorialPost; onOpen: () => void; taskStage?: string; pillarColor?: string }) {
  const responsavel = post.assignee ? (OPS_TEAM.find((m) => m.id === post.assignee)?.name ?? post.assignee) : null;
  return (
    <button onClick={onOpen} className="flex h-full flex-col rounded-2xl border border-line bg-surface p-3.5 text-left transition-shadow hover:shadow-md">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-subtle text-[11px] font-bold text-ink">
          {String(post.n).padStart(2, "0")}
        </span>
        <span className="text-[11px] text-muted">{post.date}{post.weekday && post.weekday !== "—" ? ` (${post.weekday})` : ""}</span>
      </div>
      <p className="line-clamp-2 min-h-[2.5rem] text-sm font-medium text-ink">{post.title?.trim() || post.tema?.trim() || "Sem título"}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", FORMAT_COLOR[post.format])}>{post.format}</span>
        {post.pillar && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-subtle-strong px-2 py-0.5 text-[11px] font-medium text-muted">
            {pillarColor && <span className="h-2 w-2 rounded-full" style={{ background: pillarColor }} />} {post.pillar}
          </span>
        )}
        {post.commemorativeDate && (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-500">🎉 {post.commemorativeDate}</span>
        )}
        {post.artDirection === "Media Day" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
            <Clapperboard className="h-3 w-3" /> VioDay
          </span>
        )}
        {post.clientStatus === "approved" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
            <Check className="h-3 w-3" /> Cliente aprovou
          </span>
        )}
        {post.clientStatus === "changes" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
            <MessageSquare className="h-3 w-3" /> Ajuste pedido
          </span>
        )}
      </div>
      {post.clientStatus === "changes" && post.clientFeedback && (
        <p className="mt-1.5 line-clamp-2 rounded-lg bg-amber-500/5 px-2 py-1 text-[11px] italic text-amber-700">
          “{post.clientFeedback}”
        </p>
      )}
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-2.5">
        {taskStage ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/15 px-2 py-0.5 text-[10px] font-semibold text-brand-600">
            <Rocket className="h-3 w-3" /> {TASK_STAGE_LABEL[taskStage] ?? "Em produção"}
          </span>
        ) : (
          <span className="text-[10px] text-muted">Rascunho</span>
        )}
        <span className="flex items-center gap-2 truncate text-[11px] text-muted">
          {post.commentsCount ? (
            <span className="inline-flex items-center gap-0.5"><MessageSquare className="h-3 w-3" /> {post.commentsCount}</span>
          ) : null}
          {responsavel ?? "—"}
        </span>
      </div>
    </button>
  );
}

// Mapeia o estágio da delivery task para a fase da trilha da LE.
const DEFAULT_CHECKLIST = ["Briefing lido", "Rascunho / 1ª versão", "Revisão interna", "Aprovado pelo cliente"];
const dtx = "/api/gerencial/delivery-tasks";

/** Ficha da Task/Post — a ficha ÚNICA/canônica (C1.1), renderizada por todas as telas. */
export function PostFicha({
  post,
  clientId,
  clientName,
  lineId,
  narrativa,
  pillars,
  dates = [],
  leLabel,
  mode,
  variant = "editorial",
  onClose,
  onCreated,
  onAdd,
  onSaved,
  extraProps,
}: {
  post: EditorialPost;
  clientId: string;
  clientName: string;
  lineId?: string;
  narrativa: string;
  pillars: EditorialPillar[];
  dates?: string[];
  leLabel: string;
  mode: "view" | "new";
  /** editorial = post da LE (salva em editorial_posts). delivery = task pura (salva em delivery_tasks). */
  variant?: "editorial" | "delivery";
  onClose: () => void;
  onCreated: (n: number, taskId: string) => void;
  onAdd: (p: EditorialPost) => void;
  onSaved: (p: EditorialPost) => void;
  /** Propriedades vindas do formulário/briefing (read-only), rotuladas. */
  extraProps?: { label: string; value: string }[];
}) {
  const isDelivery = variant === "delivery";
  const router = useRouter();
  const [title, setTitle] = useState(post.title);
  const [tema, setTema] = useState(post.tema ?? "");
  const [format, setFormat] = useState<EditorialFormat>(post.format);
  const [pillar, setPillar] = useState(post.pillar);
  const [roteiro, setRoteiro] = useState(post.description);
  const [legenda, setLegenda] = useState(post.legenda ?? "");
  const [notes, setNotes] = useState(post.notes ?? "");
  const [art, setArt] = useState<ArtDirection>(post.artDirection);
  const [assignee, setAssignee] = useState(post.assignee ?? "");
  const [secondary, setSecondary] = useState(post.assigneeSecondary ?? "");
  const [priority, setPriority] = useState<"normal" | "urgente">(post.priority ?? "normal");
  const prazo = post.date !== "—" ? post.date : "";
  // Duas datas (C3): postagem manda, entrega calcula (quarta da semana anterior).
  const [postDateIso, setPostDateIso] = useState(post.postDateIso ?? "");
  const [deliveryOverridden, setDeliveryOverridden] = useState(!!post.deliveryOverridden);
  const [deliveryManual, setDeliveryManual] = useState(post.deliveryDate ?? "");
  const [commemorative, setCommemorative] = useState(post.commemorativeDate ?? "");
  const deliveryAuto = postDateIso ? deliveryDateFor(postDateIso) : "";
  const deliveryIso = deliveryOverridden ? deliveryManual : deliveryAuto;
  const [stage, setStage] = useState<TaskStage | null>(post.taskStage ?? null);
  const [taskId, setTaskId] = useState<string | undefined>(post.taskId);
  // Painel de atividade (C4): feed único de comentários + eventos de status.
  const [activityOpen, setActivityOpen] = useState(false);
  const [feed, setFeed] = useState<ActItem[]>([]);
  const [commentText, setCommentText] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- limpa/recarrega o feed ao trocar de task
    if (!taskId) { setFeed([]); return; }
    let alive = true;
    void fetch(`/api/gerencial/delivery-tasks?activity=${taskId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        const events: ActItem[] = (j.history ?? []).map((h: { from_status: string | null; to_status: string; changed_at: string }) => ({
          ts: Date.parse(h.changed_at) || 0, kind: "event", from: h.from_status, to: h.to_status,
        }));
        const comments: ActItem[] = (j.comments ?? []).map((c: { author?: string; text?: string; createdAt?: string }) => ({
          ts: c.createdAt ? Date.parse(c.createdAt) : 0, kind: "comment", author: c.author, text: c.text,
        }));
        setFeed([...events, ...comments].sort((a, b) => a.ts - b.ts));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [taskId, activityOpen]);

  async function addComment() {
    const text = commentText.trim();
    if (!text || !taskId) return;
    setFeed((p) => [...p, { ts: Date.now(), kind: "comment", author: "Você", text }]);
    setCommentText("");
    await fetch("/api/gerencial/delivery-tasks", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ action: "add-comment", id: taskId, comment: { author: "Você", text } }),
    }).catch(() => {});
  }

  // @menção com autocomplete (C4): sugere pessoas ao digitar "@nome".
  const mentionQ = (() => { const m = commentText.match(/@(\p{L}*)$/u); return m ? m[1] : null; })();
  const mentionOpts = mentionQ !== null ? OPS_TEAM.filter((mm) => mm.name.toLowerCase().includes(mentionQ.toLowerCase())).slice(0, 5) : [];
  function pickMention(mname: string) { setCommentText((t) => t.replace(/@\p{L}*$/u, `@${mname} `)); }

  // C2b: campos absorvidos do Painel de Entregas (persistem na task vinculada).
  const [requesterC, setRequesterC] = useState("");
  const [taskType, setTaskType] = useState<TaskType | "">("");
  const [collabs, setCollabs] = useState<string[]>([]);
  const [loggedH, setLoggedH] = useState(0);
  const [addH, setAddH] = useState("");

  useEffect(() => {
    if (!taskId) return;
    let alive = true;
    void fetch(`/api/gerencial/delivery-tasks?activity=${taskId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!alive || !j.task) return;
        setRequesterC(j.task.requester ?? "");
        setTaskType((j.task.type as TaskType) || "");
        setCollabs((Array.isArray(j.task.assignees) ? j.task.assignees : []).filter((a: string) => a && a !== assignee));
        setLoggedH(Number(j.task.loggedH ?? 0));
      })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao (re)carregar a task
  }, [taskId]);

  function postTask(body: Record<string, unknown>) {
    if (!taskId) return;
    void fetch("/api/gerencial/delivery-tasks", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ ...body, id: taskId }) }).catch(() => {});
  }
  function changeRequesterC(v: string) { setRequesterC(v); postTask({ action: "set-requester", requester: v }); }
  function changeType(v: TaskType) { setTaskType(v); postTask({ action: "set-type", type: v }); }
  function toggleCollab(id: string) {
    const next = collabs.includes(id) ? collabs.filter((x) => x !== id) : [...collabs, id];
    setCollabs(next);
    postTask({ action: "set-assignees", assignees: [...new Set([assignee, ...next].filter(Boolean))] });
  }
  function logHours() {
    const h = Number(addH.replace(",", "."));
    if (!Number.isFinite(h) || h === 0) return;
    setLoggedH((v) => Math.max(0, v + h));
    setAddH("");
    postTask({ action: "log-hours", hours: h });
  }
  const [checks, setChecks] = useState<boolean[]>(
    DEFAULT_CHECKLIST.map((label) => post.checklist?.find((c) => c.label === label)?.done ?? false),
  );
  const [nomeEditavel, setNomeEditavel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientFirst = clientName.split(" ")[0];
  const clientInitials = clientName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const canonicalTitle = `[${clientFirst}] ${format.toUpperCase()}: ${title.trim() || tema.trim() || "Sem título"}`;
  const pillarColor = pillars.find((p) => p.name === pillar)?.color ?? "#1b4188";
  const jsonHeaders = { "Content-Type": "application/json" };

  function currentPost(extraTaskId?: string): EditorialPost {
    return {
      ...post,
      title: title.trim() || tema.trim() || "Novo post",
      tema,
      format,
      pillar: pillar.trim() || post.pillar,
      description: roteiro,
      legenda,
      notes,
      artDirection: art,
      assignee,
      assigneeSecondary: secondary,
      priority,
      date: (postDateIso ? ddmmFromIso(postDateIso) : prazo) || post.date,
      taskId: extraTaskId ?? taskId,
      taskStage: stage ?? post.taskStage,
      postDateIso: postDateIso || undefined,
      deliveryDate: deliveryIso || undefined,
      deliveryOverridden,
      commemorativeDate: commemorative || undefined,
    };
  }

  async function persistPost(extraTaskId?: string) {
    // Variante delivery (ficha única, C1.1): conteúdo salva na própria task.
    if (isDelivery) {
      const id = extraTaskId ?? taskId;
      if (!id) return;
      await fetch(dtx, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          action: "upsert-content",
          id,
          title: title.trim(),
          tema,
          roteiro,
          legenda,
          refs: post.references,
          postDateIso: postDateIso || undefined,
          deliveryDate: deliveryIso || undefined,
          deliveryOverridden,
          commemorativeDate: commemorative || undefined,
        }),
      });
      return;
    }
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
          notes,
          artDirection: art,
          tema,
          assignee,
          assigneeSecondary: secondary,
          priority,
          postDate: (postDateIso ? ddmmFromIso(postDateIso) : prazo) || undefined,
          postDateIso: postDateIso || undefined,
          deliveryDate: deliveryIso || undefined,
          deliveryOverridden,
          commemorativeDate: commemorative || undefined,
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
    router.refresh(); // reflete a nova task no Painel de Entregas / Tarefas / Resumo
    return realId;
  }

  async function deleteTask() {
    if (!taskId) return;
    if (!window.confirm("Excluir esta tarefa? Esta ação não pode ser desfeita.")) return;
    setSaving(true);
    await fetch(dtx, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ action: "delete", id: taskId }) }).catch(() => {});
    setSaving(false);
    router.refresh();
    onClose();
  }

  async function deletePost() {
    if (!post.id) return;
    if (!window.confirm("Excluir este post da linha editorial? Esta ação não pode ser desfeita.")) return;
    setSaving(true);
    await fetch("/api/gerencial/editorial", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ action: "delete-post", id: post.id }) }).catch(() => {});
    setSaving(false);
    router.refresh();
    onClose();
  }

  const canDelete = isDelivery ? !!taskId : mode === "view" && !!post.id;

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

  const nextAct = NEXT_ACTION[stage ?? "todo"];
  async function mainAction() {
    if (!nextAct) return;
    setSaving(true);
    setError(null);
    try {
      if (!taskId) await generateTask(nextAct.stage);
      else await changeStage(nextAct.stage);
      setStage(nextAct.stage);
    } catch {
      setError("Falha ao mover a task.");
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

  function addToLine() {
    void persistPost();
    onAdd(currentPost());
    onClose();
  }

  const field = "h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand-400";
  const metaSelect = "rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-brand-400";
  const checkDone = checks.filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8">
      <div className={cn("w-full overflow-hidden rounded-2xl border border-line bg-surface shadow-xl transition-[max-width]", activityOpen ? "max-w-6xl" : "max-w-4xl")}>
        {/* Cabeçalho */}
        <div className="border-b border-line px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-violet-600 to-violet-800 text-[10px] font-bold text-white">{clientInitials}</span>
              <span className="text-ink/80">{clientName}</span>
              <span>›</span>
              <span>{leLabel}</span>
              {pillar && (
                <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${pillarColor}22`, color: pillarColor }}>
                  <span className="h-1.5 w-1.5 rounded-sm" style={{ background: pillarColor }} /> {pillar}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActivityOpen((v) => !v)}
                className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium", activityOpen ? "border-brand-400 bg-brand-500/10 text-brand-600" : "border-line text-muted hover:text-ink")}
              >
                <MessageSquare className="h-3.5 w-3.5" /> Atividade
                {feed.filter((i) => i.kind === "comment").length > 0 && <span className="rounded-full bg-brand-500/15 px-1.5 text-[10px] font-bold text-brand-600">{feed.filter((i) => i.kind === "comment").length}</span>}
              </button>
              <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-subtle hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          {nomeEditavel ? (
            <input
              value={title}
              autoFocus
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => setNomeEditavel(false)}
              onKeyDown={(e) => e.key === "Enter" && setNomeEditavel(false)}
              className="mt-2 w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xl font-extrabold text-ink outline-none focus:border-brand-400"
            />
          ) : (
            <h1
              onClick={() => setNomeEditavel(true)}
              title="Clique para editar — o sistema sugere o padrão"
              className="mt-2 cursor-text text-xl font-extrabold tracking-tight text-ink"
            >
              {canonicalTitle}
            </h1>
          )}
          {!isDelivery && (
            <p className="mt-1 text-[11px] font-semibold text-violet-500">
              ✨ Nome sugerido pelo padrão [Cliente] FORMATO: Título — editável
            </p>
          )}
        </div>

        {/* Corpo em 2 colunas (+ atividade deslizável) */}
        <div className={cn("grid grid-cols-1", activityOpen ? "lg:grid-cols-[minmax(0,1fr)_300px_320px]" : "lg:grid-cols-[minmax(0,1fr)_300px]")}>
          {/* Esquerda · conteúdo */}
          <div className="min-w-0 space-y-5 px-6 py-5">
            {narrativa && narrativa !== "—" && (
              <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-600">Narrativa herdada</p>
                <p className="mt-0.5 text-xs text-ink/90">{narrativa}</p>
              </div>
            )}
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted">Tema</p>
              <input value={tema} onChange={(e) => setTema(e.target.value)} placeholder='Ex.: Trabalho sem carteira — "Dúvida de Seguidor"' className={field} />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Roteiro / copy</p>
                <button
                  onClick={() => alert("Ajudar a escrever (IA) — em breve. Vai usar o contexto real do cliente + LEs anteriores via Edge Function.")}
                  className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-600 hover:bg-violet-100"
                >
                  ✨ Ajudar a escrever
                </button>
              </div>
              <textarea
                value={roteiro}
                onChange={(e) => setRoteiro(e.target.value)}
                rows={10}
                className="w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 font-mono text-xs leading-relaxed text-ink outline-none focus:border-brand-400"
                placeholder="Gancho, cenas, desenvolvimento e CTA — escreva livre, como sempre."
              />
              <p className="mt-1 text-[11px] text-muted">Gancho, cenas, desenvolvimento e CTA — escreva livre. É o que a equipe recebe.</p>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Legenda da publicação</p>
                <span className="text-[11px] font-semibold text-cyan-600">→ usada no agendamento</span>
              </div>
              <textarea
                value={legenda}
                onChange={(e) => setLegenda(e.target.value)}
                rows={3}
                className="w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 text-sm leading-relaxed text-ink outline-none focus:border-brand-400"
              />
            </div>
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted">Referências & observações</p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Links de referência, moodboard do post, observações livres para a equipe…"
                className="w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
              />
            </div>

            {extraProps && extraProps.length > 0 && (
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted">
                  Propriedades do briefing
                </p>
                <dl className="divide-y divide-line rounded-xl border border-line">
                  {extraProps.map((p) => (
                    <div key={p.label} className="px-3 py-2">
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{p.label}</dt>
                      <dd className="mt-0.5 whitespace-pre-wrap break-words text-sm text-ink/90">{p.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>

          {/* Direita · execução */}
          <div className="min-w-0 space-y-5 border-t border-line bg-subtle/40 px-5 py-5 lg:border-l lg:border-t-0">
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted">Estágio</p>
              <select value={stage ?? ""} onChange={(e) => changeStage(e.target.value as TaskStage)} disabled={!taskId} className={cn(field, "px-2 disabled:opacity-60")}>
                {!taskId && <option value="">Ideia — gere a produção</option>}
                {TASK_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <p className="mt-1 text-[11px] text-muted">Muda aqui = muda no Kanban (mesmo objeto).</p>
            </div>

            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted">Responsável</p>
              <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={cn(field, "px-2")}>
                <option value="">—</option>
                {OPS_TEAM.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <select value={secondary} onChange={(e) => setSecondary(e.target.value)} className={cn(field, "mt-1.5 px-2 text-xs text-muted")}>
                <option value="">+ responsável secundário</option>
                {OPS_TEAM.filter((m) => m.id !== assignee).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>

            <div className="space-y-2.5">
              {!isDelivery && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted">Formato</span>
                  <select value={format} onChange={(e) => setFormat(e.target.value as EditorialFormat)} className={metaSelect}>
                    {FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              )}
              {/* Box de datas (C3): postagem manda, entrega calcula (só editorial) */}
              <div className="rounded-lg border border-line bg-surface p-2.5">
                {!isDelivery && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-ink">Data de postagem</span>
                    <input
                      type="date"
                      value={postDateIso}
                      onChange={(e) => setPostDateIso(e.target.value)}
                      className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-brand-400"
                    />
                  </div>
                )}
                <div className={cn("flex items-center justify-between gap-2", !isDelivery && "mt-2")}>
                  <span className="text-xs text-muted">Prazo de entrega</span>
                  <div className="flex items-center gap-1.5">
                    {deliveryOverridden ? (
                      <input
                        type="date"
                        value={deliveryManual}
                        onChange={(e) => setDeliveryManual(e.target.value)}
                        className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-brand-400"
                      />
                    ) : (
                      <span className="text-xs font-medium text-ink">{deliveryAuto ? ddmmFromIso(deliveryAuto) : "—"}</span>
                    )}
                    <button
                      onClick={() => {
                        if (!deliveryOverridden) setDeliveryManual(deliveryAuto);
                        setDeliveryOverridden((v) => !v);
                      }}
                      className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-semibold", deliveryOverridden ? "bg-amber-500/15 text-amber-600" : "bg-brand-500/15 text-brand-600")}
                    >
                      {deliveryOverridden ? "manual" : "auto"}
                    </button>
                  </div>
                </div>
                {!isDelivery && !deliveryOverridden && <p className="mt-1 text-[10px] text-muted">Quarta da semana anterior à postagem.</p>}
              </div>
              {!isDelivery && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted">Data comemorativa</span>
                  <select
                    value={commemorative}
                    onChange={(e) => setCommemorative(e.target.value)}
                    disabled={dates.length === 0}
                    title={dates.length === 0 ? "Adicione datas no cabeçalho da LE (Editar)" : undefined}
                    className={cn(metaSelect, "disabled:opacity-60")}
                  >
                    <option value="">Sem data comemorativa</option>
                    {dates.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted">Prioridade</span>
                <div className="flex gap-1">
                  {(["normal", "urgente"] as const).map((p) => (
                    <button key={p} onClick={() => setPriority(p)} className={cn("rounded-md px-2 py-1 text-[11px] font-medium", priority === p ? (p === "urgente" ? "bg-rose-500/15 text-rose-500" : "bg-brand-500/15 text-brand-600") : "text-muted hover:text-ink")}>
                      {p === "urgente" ? "Urgente" : "Normal"}
                    </button>
                  ))}
                </div>
              </div>
              {!isDelivery && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted">Pilar</span>
                  <input value={pillar} onChange={(e) => setPillar(e.target.value)} placeholder="Sem pilar" className="w-40 rounded-lg border border-line bg-surface px-2 py-1 text-right text-xs text-ink outline-none focus:border-brand-400" />
                </div>
              )}
              {!isDelivery && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted">Direção de arte</span>
                  <select value={art} onChange={(e) => setArt(e.target.value as ArtDirection)} className={metaSelect}>
                    {ART_DIRECTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              )}
              {!isDelivery && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted">Origem</span>
                  <span className="text-xs font-medium text-ink/80">Linha editorial</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted">Tipo</span>
                <select value={taskType} onChange={(e) => changeType(e.target.value as TaskType)} disabled={!taskId} title={!taskId ? "Gere a task de produção" : undefined} className={cn(metaSelect, "disabled:opacity-50")}>
                  <option value="">—</option>
                  {(["Arte", "Vídeo", "Copy", "Tráfego"] as TaskType[]).map((t) => <option key={t} value={t}>{t} · {TASK_TYPE_DURATIONS[t]}min</option>)}
                </select>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted">Solicitante</span>
                <select value={requesterC} onChange={(e) => changeRequesterC(e.target.value)} disabled={!taskId} title={!taskId ? "Gere a task de produção" : undefined} className={cn(metaSelect, "disabled:opacity-50")}>
                  <option value="">—</option>
                  {OPS_TEAM.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
                </select>
              </div>
            </div>

            {/* Colaboradores (C2b) — além do responsável principal */}
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">Colaboradores</p>
              {!taskId ? (
                <p className="text-[11px] text-muted">Gere a task de produção para adicionar colaboradores.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {OPS_TEAM.filter((m) => m.id !== assignee).map((m) => {
                    const on = collabs.includes(m.id);
                    return (
                      <button key={m.id} onClick={() => toggleCollab(m.id)} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", on ? "border-brand-400 bg-brand-500/10 text-ink" : "border-line text-muted hover:text-ink")}>
                        {m.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Time tracking (C2b) — secundário/opcional; nenhuma métrica depende disso */}
            <div className="rounded-xl bg-subtle p-2.5">
              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-ink"><Clock className="h-3.5 w-3.5" /> Time tracking <span className="text-[10px] font-normal text-muted">(opcional)</span></div>
              <p className="text-[11px] text-muted">{loggedH}h registradas.</p>
              <div className="mt-1.5 flex gap-1.5">
                <input value={addH} onChange={(e) => setAddH(e.target.value)} onKeyDown={(e) => e.key === "Enter" && logHours()} disabled={!taskId} inputMode="decimal" placeholder="+ horas" className="w-24 rounded-lg border border-line bg-surface px-2 py-1 text-[11px] text-ink outline-none focus:border-brand-400 disabled:opacity-50" />
                <button onClick={logHours} disabled={!taskId} className="rounded-lg border border-line bg-surface px-2 py-1 text-[11px] font-medium text-ink hover:bg-subtle disabled:opacity-50">Apontar</button>
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Checklist de entrega</p>
                <span className="text-[11px] font-semibold text-muted">{checkDone}/{DEFAULT_CHECKLIST.length}</span>
              </div>
              <div className="space-y-0.5">
                {DEFAULT_CHECKLIST.map((label, i) => (
                  <button key={label} onClick={() => toggleCheck(i)} className="flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left text-sm hover:bg-subtle">
                    {checks[i] ? <CheckSquare className="h-4 w-4 text-emerald-500" /> : <Square className="h-4 w-4 text-muted" />}
                    <span className={checks[i] ? "text-muted line-through" : "text-ink/90"}>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {nextAct ? (
              <button
                onClick={mainAction}
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-ink px-3 py-2.5 text-sm font-semibold text-surface hover:opacity-90 disabled:opacity-60"
              >
                <Send className="h-4 w-4" /> {saving ? "Movendo…" : nextAct.label}
              </button>
            ) : (
              <p className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500/10 px-3 py-2.5 text-sm font-medium text-emerald-600">
                <Check className="h-4 w-4" /> Aprovado / publicado
              </p>
            )}
          </div>

          {/* Terceira coluna · Painel de atividade (C4) */}
          {activityOpen && (
            <div className="flex max-h-[80vh] min-h-0 flex-col border-t border-line lg:border-l lg:border-t-0">
              <div className="flex items-center gap-1.5 border-b border-line px-4 py-2.5 text-xs font-semibold text-ink">
                <MessageSquare className="h-3.5 w-3.5 text-muted" /> Atividade
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                {!taskId ? (
                  <p className="rounded-lg bg-canvas px-3 py-2 text-xs text-muted">Gere a task de produção para começar a registrar atividade.</p>
                ) : feed.length === 0 ? (
                  <p className="rounded-lg bg-canvas px-3 py-2 text-xs text-muted">Sem interações ainda. Registre a primeira abaixo.</p>
                ) : (
                  feed.map((it, i) =>
                    it.kind === "event" ? (
                      <div key={i} className="flex items-center gap-2 text-[11px] text-muted">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500/40" />
                        <span>
                          {it.from ? `${TASK_STAGE_LABEL[it.from] ?? it.from} → ` : ""}
                          <span className="font-medium text-ink/80">{TASK_STAGE_LABEL[it.to ?? ""] ?? it.to}</span>
                          {it.ts ? <span className="ml-1">· {new Date(it.ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span> : null}
                        </span>
                      </div>
                    ) : (
                      <div key={i} className="rounded-lg bg-canvas px-3 py-2">
                        <p className="text-[11px] font-semibold text-ink">{it.author ?? "—"}{it.ts ? <span className="ml-1.5 font-normal text-muted">{new Date(it.ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span> : null}</p>
                        {it.text && <p className="whitespace-pre-wrap text-sm text-ink/90">{it.text}</p>}
                      </div>
                    ),
                  )
                )}
              </div>
              <div className="relative border-t border-line p-2.5">
                {mentionOpts.length > 0 && (
                  <div className="absolute bottom-full left-2.5 right-2.5 mb-1 overflow-hidden rounded-lg border border-line bg-surface shadow-lg">
                    {mentionOpts.map((mm) => (
                      <button key={mm.id} onClick={() => pickMention(mm.name)} className="block w-full px-3 py-1.5 text-left text-sm text-ink hover:bg-subtle">
                        <span className="font-medium">@{mm.name}</span> <span className="text-[11px] text-muted">{mm.role}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex gap-1.5">
                  <input
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && mentionOpts.length === 0) addComment(); }}
                    disabled={!taskId}
                    placeholder={taskId ? "Comentar… use @ para marcar" : "Gere a task primeiro"}
                    className="flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400 disabled:opacity-60"
                  />
                  <button onClick={addComment} disabled={!taskId || !commentText.trim()} className="rounded-lg bg-ink px-2.5 py-1.5 text-surface disabled:opacity-60"><Send className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          )}
        </div>

        {error && <p className="px-6 pb-1 text-xs font-medium text-rose-500">{error}</p>}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-6 py-3.5">
          {canDelete && (
            <button onClick={isDelivery ? deleteTask : deletePost} disabled={saving} className="mr-auto inline-flex items-center gap-1.5 rounded-xl border border-rose-300 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-60">
              <Trash2 className="h-4 w-4" /> Excluir
            </button>
          )}
          {savedTick && <span className={cn("inline-flex items-center gap-1 text-xs font-medium text-emerald-600", !canDelete && "mr-auto")}><Check className="h-3.5 w-3.5" /> Salvo</span>}
          <button onClick={onClose} className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-subtle">Fechar</button>
          {mode === "new" && !isDelivery && (
            <button onClick={addToLine} className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-subtle">Adicionar à LE</button>
          )}
          <button onClick={saveFicha} disabled={saving} className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-subtle disabled:opacity-60">
            {saving ? "Salvando…" : "Salvar ficha"}
          </button>
          {!isDelivery && (
            <button
              onClick={onGenerate}
              disabled={saving || !!taskId}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              <Rocket className="h-4 w-4" />
              {taskId ? "Em produção ✓" : saving ? "Gerando…" : "Gerar task de produção"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Ficha ÚNICA para uma delivery task (C1.1). Ponto de entrada canônico usado pelo
 * Painel de Entregas, Criativos e Tarefas do cliente — todas renderizam a MESMA ficha.
 */
export function TaskFicha({
  task,
  clientId = "",
  onClose,
  onStage,
}: {
  task: DeliveryTask;
  clientId?: string;
  onClose: () => void;
  onStage?: (id: string, stage: TaskStage) => void;
}) {
  // Rótulos das propriedades custom (delivery_form_fields) para exibir os
  // valores gravados em custom_fields (ex.: respostas de um formulário).
  const [labels, setLabels] = useState<Record<string, string>>({});
  useEffect(() => {
    const cf = task.customFields;
    if (!cf || Object.keys(cf).length === 0) return;
    let alive = true;
    fetch("/api/gerencial/delivery-fields", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive || !j?.fields) return;
        const map: Record<string, string> = {};
        for (const f of j.fields as { fieldKey: string; label: string }[]) map[f.fieldKey] = f.label;
        setLabels(map);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [task.customFields]);

  const extraProps = Object.entries(task.customFields ?? {})
    .map(([k, v]) => ({ label: labels[k] ?? k, value: v == null ? "" : String(v) }))
    .filter((p) => p.value.trim());

  return (
    <PostFicha
      post={deliveryTaskToPost(task)}
      clientId={clientId}
      clientName={task.client}
      narrativa=""
      pillars={[]}
      dates={[]}
      leLabel={task.client}
      mode="view"
      variant="delivery"
      extraProps={extraProps}
      onClose={onClose}
      onCreated={() => {}}
      onAdd={() => {}}
      onSaved={(p) => { if (p.taskStage && p.id) onStage?.(p.id, p.taskStage); }}
    />
  );
}

/** Modal "Criar LE" — ponto de partida (branco / duplicar do mês anterior). */
function NovaLEModal({
  data,
  clientId,
  drafts = [],
  onResume,
  onClose,
  onDone,
}: {
  data: EditorialLine;
  clientId: string;
  drafts?: EditorialDraft[];
  onResume: (draftId: string) => void;
  onClose: () => void;
  onDone: (newLineId?: string) => void;
}) {
  const [mode, setMode] = useState<"branco" | "duplicar">(data.id ? "duplicar" : "branco");
  const [monthNum, setMonthNum] = useState("");
  const [yearNum, setYearNum] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const referenceMonth = monthNum && yearNum ? `${yearNum}-${monthNum}` : "";
  const monthLabel = referenceMonth ? `${MESES_LE[Number(monthNum) - 1]} ${yearNum}` : "";

  async function create() {
    if (!referenceMonth) {
      setError("Selecione o mês e o ano da nova LE.");
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
          month: monthLabel,
          referenceMonth,
          objetivo: objetivo.trim() || undefined,
          duplicateFromId: mode === "duplicar" ? data.id : undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j?.error ?? "Falha ao criar a LE.");
        return;
      }
      onDone(j?.id ? String(j.id) : undefined);
    } catch {
      setError("Falha de rede ao criar a LE.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-ink">Criar nova linha editorial</h2>
            <p className="text-xs text-muted">Escolha o ponto de partida — nada trava, dá para alternar depois.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-subtle hover:text-ink"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 px-5 py-4">
          {/* Rascunhos em aberto (A3) — retomar em vez de duplicar */}
          {drafts.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Rascunhos em aberto</p>
              <div className="space-y-1.5">
                {drafts.map((dr) => (
                  <button key={dr.id} onClick={() => onResume(dr.id)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-subtle/50 px-3 py-2 text-left hover:border-brand-300">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{dr.month}</p>
                      {dr.objetivo && <p className="truncate text-[11px] text-muted">{dr.objetivo}</p>}
                    </div>
                    <span className="shrink-0 text-[11px] font-medium text-brand-600">Retomar →</span>
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2 text-[11px] text-muted"><span className="h-px flex-1 bg-line" /> ou comece uma nova <span className="h-px flex-1 bg-line" /></div>
            </div>
          )}
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
          <div>
            <span className="mb-1 block text-xs font-medium text-muted">Mês da nova LE</span>
            <div className="flex items-center gap-2">
              <select value={monthNum} onChange={(e) => setMonthNum(e.target.value)} className="h-10 flex-1 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand-400">
                <option value="">Mês…</option>
                {MESES_LE.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
              </select>
              <select value={yearNum} onChange={(e) => setYearNum(e.target.value)} className="h-10 w-28 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand-400">
                <option value="">Ano…</option>
                {LE_YEARS.map((y) => <option key={y} value={String(y)}>{y}</option>)}
              </select>
            </div>
            {referenceMonth && <p className="mt-1 text-[11px] text-muted">Gravado como <span className="font-mono font-semibold text-ink">{referenceMonth}</span> · {monthLabel}</p>}
          </div>
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

const PILLAR_COLORS = ["#f59e0b", "#34d399", "#38bdf8", "#a855f7", "#fb7185", "#22d3ee"];
const und = (s?: string) => (s && s !== "—" ? s : "");

// Seletor de mês/ano da LE (A2). Ano calculado uma vez no carregamento do módulo.
const MESES_LE = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const LE_BASE_YEAR = new Date().getUTCFullYear();
const LE_YEARS = [LE_BASE_YEAR - 1, LE_BASE_YEAR, LE_BASE_YEAR + 1, LE_BASE_YEAR + 2];

function ReadField({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
      {und(value) ? (
        <p className="whitespace-pre-wrap text-sm text-ink/90">{value}</p>
      ) : (
        <p className="text-sm italic text-muted">— não definido</p>
      )}
    </div>
  );
}

/** Cabeçalho estratégico READ-ONLY (A1/A5): a tela principal é documento, não formulário.
 *  Exceção: o Moodboard & referências fica sempre editável (colar links/imagens
 *  a qualquer momento, sem entrar em modo de edição). */
function StrategicHeaderView({ data, lineId }: { data: EditorialLine; lineId?: string }) {
  const datas = und(data.datasComemorativas) ? data.datasComemorativas.split(" · ").filter(Boolean) : [];
  const [moodboard, setMoodboard] = useState<EditorialRef[]>(data.moodboardGeral);
  async function persistMoodboard(next: EditorialRef[]) {
    setMoodboard(next);
    if (!lineId) return;
    await fetch("/api/gerencial/editorial", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set-header", id: lineId, moodboard: next }),
    }).catch(() => {});
  }
  return (
    <div className="rounded-2xl border border-brand-200 bg-brand-50/30">
      <div className="border-b border-brand-100 px-4 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-600">Cabeçalho estratégico · a tese do mês</p>
      </div>
      <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <ReadField label="Objetivo / foco do mês" value={data.objetivo} />
          <ReadField label="Narrativa central" value={data.narrativaCentral} />
          <ReadField label="Tensão narrativa" value={data.tensaoNarrativa} />
          <div className="border-t border-line pt-3">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">Datas comemorativas</p>
            {datas.length ? (
              <div className="flex flex-wrap gap-1.5">
                {datas.map((d, i) => <span key={i} className="rounded-full bg-subtle px-2.5 py-1 text-xs text-ink">{d}</span>)}
              </div>
            ) : <p className="text-sm italic text-muted">— não definido</p>}
          </div>
          <div className="border-t border-line pt-3">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">Pilares de conteúdo</p>
            {data.pillars.length ? (
              <div className="flex flex-wrap gap-1.5">
                {data.pillars.map((p) => (
                  <span key={p.name} className="inline-flex items-center gap-1.5 rounded-full bg-subtle px-2.5 py-1 text-xs text-ink">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} /> {p.name}{p.posts ? ` · ${p.posts}` : ""}
                  </span>
                ))}
              </div>
            ) : <p className="text-sm italic text-muted">— não definido</p>}
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-line pt-3 text-xs">
            <div><span className="text-muted">Frequência: </span><span className="font-medium text-ink">{data.frequency}</span></div>
            <div><span className="text-muted">Redes: </span><span className="font-medium text-ink">{data.networks}</span></div>
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-semibold text-ink">Moodboard & referências</p>
          <Moodboard refs={moodboard} onAdd={(r) => persistMoodboard([...moodboard, r])} onRemove={(id) => persistMoodboard(moodboard.filter((x) => x.id !== id))} compact />
          <p className="mt-1.5 text-[11px] text-muted">Cole links ou anexe imagens a qualquer momento — salva sozinho.</p>
        </div>
      </div>
    </div>
  );
}

/** Cabeçalho estratégico editável (Criar LE — Tela 1). Persiste via set-header. */
function StrategicHeader({ data, lineId, clientId }: { data: EditorialLine; lineId?: string; clientId: string }) {
  const [objetivo, setObjetivo] = useState(und(data.objetivo));
  const [narrativa, setNarrativa] = useState(und(data.narrativaCentral));
  const [tensao, setTensao] = useState(und(data.tensaoNarrativa));
  const [datas, setDatas] = useState<string[]>(
    und(data.datasComemorativas) ? data.datasComemorativas.split(" · ").filter(Boolean) : [],
  );
  const [pillars, setPillars] = useState<EditorialPillar[]>(data.pillars);
  const [moodboard, setMoodboard] = useState<EditorialRef[]>(data.moodboardGeral);
  const [newDate, setNewDate] = useState("");
  const [newPillar, setNewPillar] = useState("");
  const [savedTick, setSavedTick] = useState(false);
  const [iaBusy, setIaBusy] = useState<string | null>(null);

  async function save(patch: Record<string, unknown>) {
    if (!lineId) return;
    await fetch("/api/gerencial/editorial", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set-header", id: lineId, ...patch }),
    });
    setSavedTick(true);
    window.setTimeout(() => setSavedTick(false), 1500);
  }

  /** Chama a IA (OpenAI, via /api/gerencial/le-ai) e aplica a sugestão. */
  async function askIA(kind: "objetivo" | "narrativa" | "tensao" | "pilares" | "temas" | "datas", apply: (text: string) => void) {
    setIaBusy(kind);
    try {
      const res = await fetch("/api/gerencial/le-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, clientId }),
      });
      const j = await res.json().catch(() => ({}));
      if (j.ok && j.suggestion) {
        apply(String(j.suggestion).trim());
      } else {
        alert(j.reason ?? "IA da Linha Editorial ainda não configurada (defina OPENAI_API_KEY).");
      }
    } finally {
      setIaBusy(null);
    }
  }

  function suggestObjetivo() { void askIA("objetivo", (t) => { setObjetivo(t); void save({ objetivo: t }); }); }
  function suggestNarrativa() { void askIA("narrativa", (t) => { setNarrativa(t); void save({ narrativaCentral: t }); }); }
  function suggestTensao() { void askIA("tensao", (t) => { setTensao(t); void save({ tensaoNarrativa: t }); }); }
  function suggestPilares() {
    void askIA("pilares", (t) => {
      const names = t.split("\n").map((l) => l.replace(/^[-*\d.\s]+/, "").trim()).filter(Boolean).slice(0, 6);
      const next = [...pillars];
      for (const name of names) {
        if (!next.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
          next.push({ name, posts: 0, color: PILLAR_COLORS[next.length % PILLAR_COLORS.length] });
        }
      }
      setPillars(next);
      void save({ pillars: next });
    });
  }
  function suggestDatas() {
    void askIA("datas", (t) => {
      // Só remove marcadores de lista (- * •); NÃO os dígitos, senão come o dia (01/11).
      const found = t.split("\n").map((l) => l.replace(/^[-*•\s]+/, "").trim()).filter(Boolean);
      const next = [...datas];
      for (const d of found) if (!next.includes(d)) next.push(d);
      setDatas(next);
      void save({ datasComemorativas: next.join(" · ") });
    });
  }
  async function suggestMoodboard() {
    setIaBusy("moodboard");
    try {
      const res = await fetch("/api/gerencial/le-moodboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const j = await res.json().catch(() => ({}));
      if (j.ok && j.url) {
        const ref: EditorialRef = { id: `ai-${Date.now()}`, kind: "image", url: j.url, label: "Moodboard IA" };
        const next = [...moodboard, ref];
        setMoodboard(next);
        void save({ moodboard: next });
      } else {
        alert(j.reason ?? "Geração de moodboard indisponível.");
      }
    } finally {
      setIaBusy(null);
    }
  }

  function addDate() {
    const v = newDate.trim();
    if (!v) return;
    const next = [...datas, v];
    setDatas(next);
    setNewDate("");
    void save({ datasComemorativas: next.join(" · ") });
  }
  function removeDate(i: number) {
    const removed = datas[i];
    const next = datas.filter((_, idx) => idx !== i);
    setDatas(next);
    void save({ datasComemorativas: next.join(" · ") });
    // F5: limpa o vínculo dessa data nos posts que a referenciavam.
    if (lineId && removed) {
      void fetch("/api/gerencial/editorial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear-commemorative", lineId, label: removed }),
      });
    }
  }
  function addPillar() {
    const v = newPillar.trim();
    if (!v) return;
    const p: EditorialPillar = { name: v, posts: 0, color: PILLAR_COLORS[pillars.length % PILLAR_COLORS.length] };
    const next = [...pillars, p];
    setPillars(next);
    setNewPillar("");
    void save({ pillars: next });
  }
  function removePillar(name: string) {
    const next = pillars.filter((p) => p.name !== name);
    setPillars(next);
    void save({ pillars: next });
  }

  const iaBtn = "inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-600 hover:bg-violet-100";
  const ta = "w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400";

  return (
    <div className="rounded-2xl border border-brand-200 bg-brand-50/30 p-1">
      <div className="flex items-center justify-between px-4 pt-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-600">Cabeçalho estratégico · a tese do mês</p>
        {savedTick && <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600"><Check className="h-3 w-3" /> salvo</span>}
      </div>
      <div className="grid grid-cols-1 gap-3 p-3 lg:grid-cols-3">
        <Card className="space-y-3 p-4 lg:col-span-2">
          {/* Objetivo / foco do mês */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted">Objetivo / foco do mês</span>
              <button onClick={suggestObjetivo} disabled={iaBusy === "objetivo"} className={iaBtn}>{iaBusy === "objetivo" ? "✨ Gerando…" : "✨ Sugerir"}</button>
            </div>
            <textarea value={objetivo} onChange={(e) => setObjetivo(e.target.value)} onBlur={() => save({ objetivo })} rows={2} placeholder="Ex.: encher reservas de ter–qui · lançar o novo cardápio" className={ta} />
          </div>
          {/* Narrativa central */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted">Narrativa central</span>
              <button onClick={suggestNarrativa} disabled={iaBusy === "narrativa"} className={iaBtn}>{iaBusy === "narrativa" ? "✨ Gerando…" : "✨ Sugerir narrativa"}</button>
            </div>
            <textarea value={narrativa} onChange={(e) => setNarrativa(e.target.value)} onBlur={() => save({ narrativaCentral: narrativa })} rows={2} placeholder="A mensagem-mãe do mês." className={ta} />
          </div>
          {/* Tensão narrativa */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted">Tensão narrativa</span>
              <button onClick={suggestTensao} disabled={iaBusy === "tensao"} className={iaBtn}>{iaBusy === "tensao" ? "✨ Gerando…" : "✨ Sugerir tensão"}</button>
            </div>
            <textarea value={tensao} onChange={(e) => setTensao(e.target.value)} onBlur={() => save({ tensaoNarrativa: tensao })} rows={2} placeholder="O conflito/ângulo que sustenta a narrativa." className={ta} />
          </div>
          {/* Datas comemorativas — chips */}
          <div className="border-t border-line pt-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted">Datas comemorativas</span>
              <button onClick={suggestDatas} disabled={iaBusy === "datas"} className={iaBtn}>{iaBusy === "datas" ? "✨ Buscando…" : "✨ Buscar datas"}</button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {datas.map((d, i) => (
                <span key={`${d}-${i}`} className="inline-flex items-center gap-1 rounded-full bg-subtle px-2.5 py-1 text-xs text-ink">
                  {d}
                  <button onClick={() => removeDate(i)} className="text-muted hover:text-rose-500"><X className="h-3 w-3" /></button>
                </span>
              ))}
              <input value={newDate} onChange={(e) => setNewDate(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addDate()} placeholder="+ data" className="w-28 rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-ink outline-none focus:border-brand-400" />
            </div>
          </div>
          {/* Pilares — chips */}
          <div className="border-t border-line pt-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted">Pilares de conteúdo</span>
              <button onClick={suggestPilares} disabled={iaBusy === "pilares"} className={iaBtn}>{iaBusy === "pilares" ? "✨ Gerando…" : "✨ Sugerir pilares"}</button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {pillars.map((p) => (
                <span key={p.name} className="inline-flex items-center gap-1.5 rounded-full bg-subtle px-2.5 py-1 text-xs text-ink">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} /> {p.name}{p.posts ? ` · ${p.posts}` : ""}
                  <button onClick={() => removePillar(p.name)} className="text-muted hover:text-rose-500"><X className="h-3 w-3" /></button>
                </span>
              ))}
              <input value={newPillar} onChange={(e) => setNewPillar(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPillar()} placeholder="+ pilar" className="w-28 rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-ink outline-none focus:border-brand-400" />
            </div>
          </div>
          <div className="border-t border-line pt-3 text-xs text-muted">
            <Field label="Frequência" value={data.frequency} />
            <Field label="Redes" value={data.networks} />
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-ink">Moodboard & referências</p>
            <button onClick={suggestMoodboard} disabled={iaBusy === "moodboard"} className={iaBtn}>{iaBusy === "moodboard" ? "✨ Gerando…" : "✨ Gerar"}</button>
          </div>
          <Moodboard refs={moodboard} onAdd={(r) => { const next = [...moodboard, r]; setMoodboard(next); void save({ moodboard: next }); }} />
        </Card>
      </div>
    </div>
  );
}

const SLOT_FORMATS: EditorialFormat[] = ["Reels", "Feed", "Stories", "Carrossel"];

/** Slots do contrato (Criar LE 1.5): progresso por formato · desvio sinaliza, não bloqueia. */
function ContractSlots({
  clientId,
  deliverables,
  posts,
}: {
  clientId: string;
  deliverables: ClientDeliverable[];
  posts: EditorialPost[];
}) {
  const [qty, setQty] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const d of deliverables) m[d.format] = d.monthlyQty;
    return m;
  });
  const [editing, setEditing] = useState(false);

  async function save(format: EditorialFormat, value: number) {
    setQty((p) => ({ ...p, [format]: value }));
    await fetch("/api/gerencial/client-deliverables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, format, monthlyQty: value }),
    });
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-600">Slots do contrato</p>
        <button onClick={() => setEditing((v) => !v)} className="text-[11px] font-medium text-muted hover:text-ink">
          {editing ? "Concluir" : "Editar entregáveis"}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SLOT_FORMATS.map((f) => {
          const done = posts.filter((p) => p.format === f).length;
          const contract = qty[f] ?? 0;
          const pct = contract > 0 ? Math.min(100, (done / contract) * 100) : done > 0 ? 100 : 0;
          const over = contract > 0 && done > contract;
          const complete = contract > 0 && done >= contract && !over;
          const bar = over ? "bg-amber-500" : complete ? "bg-emerald-500" : "bg-subtle-strong";
          const desvio = contract === 0 ? "sem contrato" : over ? `${done - contract} além` : done < contract ? `faltam ${contract - done}` : "completo";
          return (
            <div key={f}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-ink">{f}</span>
                {editing ? (
                  <input
                    type="number"
                    min={0}
                    value={contract}
                    onChange={(e) => save(f, Math.max(0, Number(e.target.value) || 0))}
                    className="h-6 w-12 rounded border border-line bg-surface px-1 text-right text-xs text-ink outline-none focus:border-brand-400"
                  />
                ) : (
                  <span className="text-muted">{done}/{contract || "—"}</span>
                )}
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-subtle-strong">
                <div className={cn("h-full rounded-full", bar)} style={{ width: `${pct}%` }} />
              </div>
              <p className={cn("mt-0.5 text-[10px]", over ? "text-amber-600" : complete ? "text-emerald-600" : "text-muted")}>{desvio}</p>
            </div>
          );
        })}
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

export function LinhaEditorial({
  data,
  clientId,
  deliverables = [],
  drafts = [],
}: {
  data: EditorialLine;
  clientId: string;
  deliverables?: ClientDeliverable[];
  drafts?: EditorialDraft[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lineId = data.id;
  const [filter, setFilter] = useState<"Todos" | EditorialFormat>("Todos");
  const [showHistory, setShowHistory] = useState(false);
  const [stage, setStage] = useState<EditorialStage>(data.stage);
  const [posts, setPosts] = useState<EditorialPost[]>(data.posts);
  const [ficha, setFicha] = useState<{ post: EditorialPost; mode: "view" | "new" } | null>(null);
  const [novaLE, setNovaLE] = useState(false);
  const [editing, setEditing] = useState(false);
  const [taskByPost, setTaskByPost] = useState<Record<number, string>>({});
  const [copiedApproval, setCopiedApproval] = useState(false);

  // Fluxo unificado: ao criar uma LE (navegação com ?edit=1), abre o editor do
  // cabeçalho automaticamente (uma vez), sem exigir o clique em "Editar".
  const openedFromParam = useRef(false);
  useEffect(() => {
    if (!openedFromParam.current && searchParams.get("edit") === "1" && lineId) {
      openedFromParam.current = true;
      setEditing(true);
    }
  }, [searchParams, lineId]);

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
    <div className="space-y-4 pb-20">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink">Linha editorial — {data.month}</h2>
          <p className="text-sm text-muted">
            {data.clientName}
            {data.builtBy && <> · montada por {data.builtBy}</>}
          </p>
          {data.internallyApprovedBy ? (
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
              <Check className="h-3 w-3" /> Aprovada internamente por {data.internallyApprovedBy}
            </p>
          ) : lineId ? (
            <button
              onClick={async () => {
                await fetch("/api/gerencial/editorial", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "internal-approve", id: lineId }),
                });
                router.refresh();
              }}
              className="mt-1 inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              <Check className="h-3.5 w-3.5" /> Aprovar internamente
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setEditing(true)} disabled={!lineId} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-subtle disabled:opacity-50">
            <Sparkles className="h-4 w-4" /> Editar
          </button>
          <div className="relative">
            <button onClick={() => setShowHistory((s) => !s)} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-subtle">
              <History className="h-4 w-4" /> Histórico
            </button>
            {showHistory && (
              <div className="absolute right-0 z-20 mt-1 max-h-72 w-52 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-lg">
                {lineId && (
                  <button
                    onClick={() => { setShowHistory(false); router.push(`/gerencial/clientes/${clientId}/editorial?le=${lineId}`); }}
                    className="block w-full rounded-lg bg-subtle px-3 py-2 text-left text-sm font-medium text-ink"
                  >
                    {data.month} <span className="text-[11px] text-muted">(atual)</span>
                  </button>
                )}
                {data.history.length === 0 && !lineId && (
                  <p className="px-3 py-2 text-center text-xs text-muted">Sem meses anteriores.</p>
                )}
                {data.history.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => { setShowHistory(false); router.push(`/gerencial/clientes/${clientId}/editorial?le=${h.id}`); }}
                    className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-subtle"
                  >
                    {h.month}
                  </button>
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
          <a
            href={`/gerencial/clientes/${clientId}/le/apresentar`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            <Presentation className="h-4 w-4" /> Apresentar ao cliente
          </a>
          {data.approvalToken && (
            <button
              onClick={() => {
                const origin = typeof window !== "undefined" ? window.location.origin : "";
                navigator.clipboard
                  ?.writeText(`${origin}/aprovar/${data.approvalToken}`)
                  .then(() => {
                    setCopiedApproval(true);
                    setTimeout(() => setCopiedApproval(false), 1500);
                  });
              }}
              title="Copia o link público para o cliente aprovar/pedir ajustes nos posts"
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-subtle"
            >
              {copiedApproval ? (
                <><Check className="h-4 w-4 text-emerald-500" /> Link copiado</>
              ) : (
                <><Link2 className="h-4 w-4" /> Enviar p/ aprovação</>
              )}
            </button>
          )}
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

      {/* ── Nível 1: Cabeçalho estratégico (documento read-only; edita no modal) ── */}
      <StrategicHeaderView data={data} lineId={lineId} />

      {/* ── Nível 1.5: Slots do contrato ── */}
      <ContractSlots clientId={clientId} deliverables={deliverables} posts={posts} />

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
              pillarColor={data.pillars.find((pl) => pl.name === p.pillar)?.color}
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
          pillars={data.pillars}
          dates={und(data.datasComemorativas) ? data.datasComemorativas.split(" · ").filter(Boolean) : []}
          leLabel={`Linha editorial · ${data.month}`}
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
          drafts={drafts}
          onResume={(draftId) => { setNovaLE(false); router.push(`/gerencial/clientes/${clientId}/editorial?le=${draftId}`); }}
          onClose={() => setNovaLE(false)}
          onDone={(newId) => {
            setNovaLE(false);
            // Fluxo unificado: já abre a nova LE com o editor do cabeçalho aberto.
            if (newId) router.push(`/gerencial/clientes/${clientId}/editorial?le=${newId}&edit=1`);
            else router.refresh();
          }}
        />
      )}

      {/* Modal de edição do cabeçalho estratégico (A1/A4) */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8" onClick={() => { setEditing(false); router.refresh(); }}>
          <div className="w-full max-w-4xl rounded-2xl border border-line bg-surface shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <h2 className="text-sm font-semibold text-ink">Editar cabeçalho estratégico — {data.month}</h2>
              <button onClick={() => { setEditing(false); router.refresh(); }} className="rounded-lg p-1 text-muted hover:bg-subtle"><X className="h-5 w-5" /></button>
            </div>
            <div className="max-h-[75vh] overflow-y-auto p-2">
              <StrategicHeader data={data} lineId={lineId} clientId={clientId} />
            </div>
            <div className="flex justify-end border-t border-line px-5 py-3">
              <button onClick={() => { setEditing(false); router.refresh(); }} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">Concluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

