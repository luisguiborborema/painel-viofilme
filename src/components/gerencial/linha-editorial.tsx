"use client";

import { useState } from "react";
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
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ART_DIRECTIONS,
  EDITORIAL_STAGES,
  type ArtDirection,
  type EditorialFormat,
  type EditorialLine,
  type EditorialPost,
  type EditorialRef,
  type EditorialStage,
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
            <Rocket className="h-3 w-3" /> Em produção
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

/** Ficha da Task/Post (Task universal) — abre ao clicar num post ou em "+ Post". */
function PostFicha({
  post,
  clientId,
  clientName,
  mode,
  hasTask,
  onClose,
  onCreated,
  onAdd,
}: {
  post: EditorialPost;
  clientId: string;
  clientName: string;
  mode: "view" | "new";
  hasTask: boolean;
  onClose: () => void;
  onCreated: (n: number, taskId: string) => void;
  onAdd: (p: EditorialPost) => void;
}) {
  const [title, setTitle] = useState(post.title);
  const [format, setFormat] = useState<EditorialFormat>(post.format);
  const [pillar, setPillar] = useState(post.pillar);
  const [roteiro, setRoteiro] = useState(post.description);
  const [legenda, setLegenda] = useState("");
  const [art, setArt] = useState<ArtDirection>(post.artDirection);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(hasTask);
  const [error, setError] = useState<string | null>(null);

  const canonicalTitle = `[${clientName}] ${format.toUpperCase()}: ${title.trim() || "Sem título"}`;

  async function generateTask() {
    setSaving(true);
    setError(null);
    const composed = canonicalTitle;
    try {
      const res = await fetch("/api/gerencial/delivery-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          title: composed,
          clientId,
          type: FORMAT_TO_TYPE[format],
          origin: "Linha editorial",
          stage: "todo",
        }),
      });
      const data = await res.json().catch(() => ({}));
      const id = data?.id && data.id !== "demo" ? String(data.id) : `le-${postSeq++}`;
      if (data?.id && data.id !== "demo") {
        const brief = [
          art === "Media Day" && "Direcionamento: Media Day (VioDay)",
          pillar && `Pilar: ${pillar}`,
          roteiro.trim() && `Roteiro:\n${roteiro.trim()}`,
          legenda.trim() && `Legenda:\n${legenda.trim()}`,
        ].filter(Boolean).join("\n");
        if (brief) {
          await fetch("/api/gerencial/delivery-tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "add-comment", id, comment: { text: brief, author: "Linha editorial" } }),
          });
        }
      }
      setDone(true);
      onCreated(post.n, id);
    } catch {
      setError("Falha ao gerar a task.");
    } finally {
      setSaving(false);
    }
  }

  function addToLine() {
    onAdd({
      ...post,
      title: title.trim() || "Novo post",
      format,
      pillar: pillar.trim() || post.pillar,
      description: roteiro,
      artDirection: art,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8">
      <div className="w-full max-w-3xl rounded-2xl border border-line bg-surface shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
              {mode === "new" ? "Novo post" : "Ficha do post"}
            </p>
            <p className="truncate text-sm font-semibold text-ink">{canonicalTitle}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-subtle hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Trilha de fases */}
        <div className="no-scrollbar flex items-center gap-1 overflow-x-auto border-b border-line px-5 py-2.5">
          {POST_PHASES.map((ph, i) => (
            <span key={ph} className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium", i === 0 ? "bg-brand-500 text-white" : "bg-subtle text-muted")}>{ph}</span>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 px-5 py-4 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Título / gancho</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand-400" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Roteiro / copy</span>
              <textarea value={roteiro} onChange={(e) => setRoteiro(e.target.value)} rows={5} className="w-full resize-none rounded-xl border border-line bg-surface px-3 py-2 font-mono text-xs text-ink outline-none focus:border-brand-400" placeholder="Gancho, desenvolvimento, cenas, CTA…" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Legenda (publicação)</span>
              <textarea value={legenda} onChange={(e) => setLegenda(e.target.value)} rows={2} className="w-full resize-none rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400" />
            </label>
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Formato</span>
              <select value={format} onChange={(e) => setFormat(e.target.value as EditorialFormat)} className="h-10 w-full rounded-xl border border-line bg-surface px-2 text-sm text-ink outline-none focus:border-brand-400">
                {FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Pilar</span>
              <input value={pillar} onChange={(e) => setPillar(e.target.value)} className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand-400" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Direcionamento de arte</span>
              <select value={art} onChange={(e) => setArt(e.target.value as ArtDirection)} className="h-10 w-full rounded-xl border border-line bg-surface px-2 text-sm text-ink outline-none focus:border-brand-400">
                {ART_DIRECTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
          </div>
        </div>

        {error && <p className="px-5 text-xs font-medium text-rose-500">{error}</p>}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3.5">
          <button onClick={onClose} className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-subtle">Fechar</button>
          {mode === "new" && (
            <button onClick={addToLine} className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-subtle">Adicionar à LE</button>
          )}
          <button
            onClick={generateTask}
            disabled={saving || done}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            <Rocket className="h-4 w-4" />
            {done ? "Task gerada ✓" : saving ? "Gerando…" : "Gerar task de produção"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Modal "Criar LE" — ponto de partida (branco / duplicar do mês anterior). */
function NovaLEModal({ data, onClose }: { data: EditorialLine; onClose: () => void }) {
  const [mode, setMode] = useState<"branco" | "duplicar">("duplicar");
  const [month, setMonth] = useState("");
  const [objetivo, setObjetivo] = useState("");

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
            <button onClick={() => setMode("duplicar")} className={cn("rounded-xl border p-3 text-left transition-colors", mode === "duplicar" ? "border-brand-400 bg-brand-500/10" : "border-line bg-subtle hover:border-brand-300")}>
              <p className="text-sm font-medium text-ink">Duplicar {data.month}</p>
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
          <p className="rounded-lg bg-subtle px-3 py-2 text-[11px] text-muted">
            A persistência da LE (salvar a linha e seus posts entre sessões) é o próximo passo estrutural — precisa das tabelas de linha editorial. Por ora este é o ponto de partida da produção.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3.5">
          <button onClick={onClose} className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-subtle">Cancelar</button>
          <button onClick={onClose} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            <Plus className="h-4 w-4" /> Começar
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
  const [filter, setFilter] = useState<"Todos" | EditorialFormat>("Todos");
  const [moodGeral, setMoodGeral] = useState<EditorialRef[]>(data.moodboardGeral);
  const [showHistory, setShowHistory] = useState(false);
  const [stage, setStage] = useState<EditorialStage>(data.stage);
  const [posts, setPosts] = useState<EditorialPost[]>(data.posts);
  const [ficha, setFicha] = useState<{ post: EditorialPost; mode: "view" | "new" } | null>(null);
  const [novaLE, setNovaLE] = useState(false);
  const [taskByPost, setTaskByPost] = useState<Record<number, string>>({});

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
                onClick={() => setStage(s.key)}
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
            <PostCard key={p.n} post={p} taskStage={taskByPost[p.n]} onOpen={() => setFicha({ post: p, mode: "view" })} />
          ))}
        </div>
      </div>

      {ficha && (
        <PostFicha
          post={ficha.post}
          mode={ficha.mode}
          clientId={clientId}
          clientName={data.clientName}
          hasTask={!!taskByPost[ficha.post.n]}
          onClose={() => setFicha(null)}
          onCreated={(n, taskId) => setTaskByPost((prev) => ({ ...prev, [n]: taskId }))}
          onAdd={(p) => setPosts((prev) => [p, ...prev])}
        />
      )}
      {novaLE && <NovaLEModal data={data} onClose={() => setNovaLE(false)} />}
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
