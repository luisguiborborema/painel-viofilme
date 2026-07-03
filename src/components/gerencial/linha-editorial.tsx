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
} from "@/lib/data/operacao";

const FORMAT_FILTERS: ("Todos" | EditorialFormat)[] = ["Todos", "Feed", "Reels", "Stories", "Carrossel"];
const FORMAT_COLOR: Record<EditorialFormat, string> = {
  Feed: "bg-sky-500/15 text-sky-500",
  Reels: "bg-rose-500/15 text-rose-500",
  Stories: "bg-violet-500/15 text-violet-500",
  Carrossel: "bg-emerald-500/15 text-emerald-600",
};

const ART_CONSEQUENCE: Record<ArtDirection, string> = {
  "Media Day": "→ entra no checklist do próximo Media Day (VioDay).",
  "Banco do cliente": "→ puxa do Hub de ativos de marca.",
  "Imagem da internet": "→ instrução registrada no briefing do designer.",
  "Motion design": "→ instrução registrada no briefing do designer.",
  Outro: "→ instrução registrada no briefing do designer.",
};

let refSeq = 1000;
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

function PostCard({ post }: { post: EditorialPost }) {
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
      <p className="text-sm font-medium text-ink">{post.title}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", FORMAT_COLOR[post.format])}>{post.format}</span>
        <span className="rounded-full bg-subtle-strong px-2 py-0.5 text-[11px] font-medium text-muted">{post.pillar}</span>
        {art === "Media Day" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
            <Clapperboard className="h-3 w-3" /> VioDay
          </span>
        )}
      </div>
      <p className="mt-2 flex-1 text-xs text-muted">{post.description}</p>

      {/* Adição 2 — direcionamento de arte */}
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

      {/* Adição 1 — moodboard do post */}
      <div className="mt-2">
        <button onClick={() => setOpenMood((o) => !o)} className="text-[11px] font-medium text-brand-500 hover:text-brand-600">
          {openMood ? "Ocultar" : "Referências"} ({refs.length})
        </button>
        {openMood && (
          <div className="mt-2">
            <Moodboard refs={refs} onAdd={(r) => setRefs((p) => [...p, r])} compact />
          </div>
        )}
      </div>
    </Card>
  );
}

export function LinhaEditorial({ data, clientId }: { data: EditorialLine; clientId: string }) {
  const [filter, setFilter] = useState<"Todos" | EditorialFormat>("Todos");
  const [moodGeral, setMoodGeral] = useState<EditorialRef[]>(data.moodboardGeral);
  const [showHistory, setShowHistory] = useState(false);
  const currentStageIdx = EDITORIAL_STAGES.findIndex((s) => s.key === data.stage);
  const posts = filter === "Todos" ? data.posts : data.posts.filter((p) => p.format === filter);

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
          <button className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-subtle">
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

      {/* Stepper */}
      <div className="no-scrollbar flex items-center gap-1 overflow-x-auto">
        {EDITORIAL_STAGES.map((s, i) => {
          const done = i < currentStageIdx;
          const active = i === currentStageIdx;
          return (
            <div key={s.key} className="flex items-center">
              <span className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium", active ? "bg-brand-500 text-white" : done ? "bg-emerald-500/15 text-emerald-600" : "bg-surface text-muted")}>
                {done && <Check className="h-3 w-3" />} {s.label}
              </span>
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
          <h3 className="text-sm font-semibold text-ink">Posts individuais (micro) — {data.posts.length}</h3>
          <div className="flex flex-wrap items-center gap-1.5">
            {FORMAT_FILTERS.map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors", filter === f ? "bg-ink text-surface" : "bg-surface text-muted hover:text-ink")}>{f}</button>
            ))}
            <button className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700"><Plus className="h-3 w-3" /> Post</button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => <PostCard key={p.n} post={p} />)}
        </div>
      </div>
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
