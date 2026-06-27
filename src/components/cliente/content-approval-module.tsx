"use client";

import { useEffect, useState } from "react";
import { CalendarDays, ClipboardList, List, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ApprovalCard, type ApprovalCardData, type Bucket } from "./approval-card";
import { CalendarView } from "./calendar-view";
import { ContentRequestForm } from "./content-request-form";
import { PostPreview, type PreviewPost } from "./post-preview";
import { publicationLabel } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import type { ContentPost, MediaType } from "@/lib/data/types";

function bucketOf(p: ContentPost): Bucket | null {
  if (p.status === "published") return "publicados";
  if (p.status === "scheduled") {
    if (p.approval === "pending") return "para-aprovar";
    if (p.approval === "changes_requested") return "em-ajuste";
    return "agendados";
  }
  return null;
}

function formatLabel(m: MediaType): "Feed" | "Reels" | "Stories" {
  if (m === "reel" || m === "video") return "Reels";
  if (m === "story") return "Stories";
  return "Feed";
}

function waitingLabel(h: number): string {
  if (h >= 24) {
    const d = Math.round(h / 24);
    return `${d} ${d === 1 ? "dia" : "dias"}`;
  }
  return `${h}h`;
}

const REDES = [
  { label: "Todas as redes", value: "todas" },
  { label: "Instagram", value: "instagram" },
  { label: "Facebook", value: "facebook" },
  { label: "Stories / Reels", value: "stories-reels" },
];

export function ContentApprovalModule({
  posts,
  periodLabel,
  refIso,
  handle,
  initialPostId,
}: {
  posts: ContentPost[];
  periodLabel: string;
  refIso: string;
  handle: string;
  initialPostId?: string;
}) {
  const [tab, setTab] = useState<Bucket>("para-aprovar");
  const [rede, setRede] = useState("todas");
  const [view, setView] = useState<"grid" | "calendar">("grid");
  const [preview, setPreview] = useState<PreviewPost | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestDate, setRequestDate] = useState<string | undefined>();

  const counts = { "para-aprovar": 0, "em-ajuste": 0, agendados: 0, publicados: 0 };
  for (const p of posts) {
    const b = bucketOf(p);
    if (b) counts[b] += 1;
  }

  function openPreviewById(id: string) {
    const p = posts.find((x) => x.id === id);
    if (!p) return;
    setPreview({
      caption: p.caption,
      format: formatLabel(p.mediaType),
      isVideo: p.mediaType === "reel" || p.mediaType === "video",
      handle,
      whenLabel: "agora",
    });
  }

  // Deep-link ?post= abre a pré-visualização ao montar.
  useEffect(() => {
    if (initialPostId) openPreviewById(initialPostId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPostId]);

  let list = posts.filter((p) => bucketOf(p) === tab);
  if (rede === "instagram") list = list.filter((p) => p.platform === "instagram");
  else if (rede === "facebook") list = list.filter((p) => p.platform === "facebook");
  else if (rede === "stories-reels")
    list = list.filter((p) => ["reel", "story", "video"].includes(p.mediaType));

  const cards: ApprovalCardData[] = list.map((p) => ({
    id: p.id,
    formatLabel: formatLabel(p.mediaType),
    platform: p.platform,
    mediaType: p.mediaType,
    publicationLabel: publicationLabel(
      p.scheduledAt ?? p.publishedAt ?? refIso,
      refIso,
    ),
    caption: p.caption,
    author: p.author,
    waitingLabel: p.waitingHours != null ? waitingLabel(p.waitingHours) : null,
    bucket: tab,
  }));

  const tabs = [
    { label: "Para aprovar", value: "para-aprovar" as Bucket, count: counts["para-aprovar"] },
    { label: "Em ajuste", value: "em-ajuste" as Bucket, count: counts["em-ajuste"] },
    { label: "Agendados", value: "agendados" as Bucket, count: counts.agendados },
    { label: "Publicados", value: "publicados" as Bucket, count: counts.publicados },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 text-brand-300">
            <ClipboardList className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">
              Conteúdo &amp; aprovação
            </h1>
            <p className="text-sm text-muted">
              {periodLabel} · {posts.length} posts no mês
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setView((v) => (v === "grid" ? "calendar" : "grid"))}
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:bg-subtle"
          >
            {view === "grid" ? (
              <>
                <CalendarDays className="h-4 w-4" /> Ver calendário
              </>
            ) : (
              <>
                <List className="h-4 w-4" /> Ver lista
              </>
            )}
          </button>
          <button
            onClick={() => {
              setRequestDate(undefined);
              setRequestOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
          >
            <Plus className="h-4 w-4" /> Solicitar conteúdo
          </button>
        </div>
      </div>

      {view === "grid" ? (
        <>
          {/* Abas de status */}
          <div className="flex flex-wrap gap-2">
            {tabs.map((t) => {
              const active = tab === t.value;
              const alert = t.value === "para-aprovar";
              return (
                <button
                  key={t.value}
                  onClick={() => setTab(t.value)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-sm font-medium transition-colors",
                    active ? "bg-brand-500 text-white" : "bg-subtle text-muted hover:text-ink",
                  )}
                >
                  {t.label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-xs font-semibold",
                      active
                        ? "bg-white/25 text-white"
                        : alert && t.count > 0
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-subtle-strong",
                    )}
                  >
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Filtro de rede */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted">Filtrar:</span>
            <div className="inline-flex flex-wrap rounded-xl border border-line bg-surface p-1">
              {REDES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setRede(r.value)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    rede === r.value ? "bg-brand-500 text-white" : "text-muted hover:text-ink",
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {cards.length === 0 ? (
            <Card className="p-10 text-center text-sm text-muted">
              Nenhum conteúdo nesta aba.
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((c) => (
                <ApprovalCard
                  key={c.id}
                  post={c}
                  onPreview={() => openPreviewById(c.id)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <CalendarView
          posts={posts}
          refIso={refIso}
          network={rede === "instagram" || rede === "facebook" ? rede : "todas"}
          onSelectPost={openPreviewById}
          onRequestDate={(date) => {
            setRequestDate(date);
            setRequestOpen(true);
          }}
        />
      )}

      <PostPreview open={preview !== null} onClose={() => setPreview(null)} post={preview} />
      <ContentRequestForm
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        initialDate={requestDate}
      />
    </div>
  );
}
