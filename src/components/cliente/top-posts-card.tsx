"use client";

import { useState } from "react";
import { Eye, Heart, MessageCircle, Play, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { MEDIA_LABEL, PlatformIcon } from "@/components/dashboard/platform";
import { AiInsights } from "@/components/dashboard/ai-insights";
import { dayMonth } from "@/lib/datetime";
import { cn, formatCompact, formatNumber } from "@/lib/utils";
import type { TopPost } from "@/lib/data/types";

const RANK_STYLE = [
  "bg-amber-400 text-amber-950",
  "bg-zinc-300 text-zinc-800",
  "bg-orange-400/80 text-orange-950",
];

const THUMB: Record<string, string> = {
  reel: "from-rose-400 to-rose-600",
  video: "from-rose-400 to-rose-600",
  carousel: "from-emerald-400 to-emerald-600",
  image: "from-sky-400 to-sky-600",
  story: "from-violet-400 to-violet-600",
};

function metricsFor(p: TopPost): { label: string; value: string }[] {
  const base = [
    { label: "Alcance", value: formatCompact(p.reach) },
    { label: "Impressões", value: formatCompact(Math.round(p.reach * 1.3)) },
    { label: "Salvamentos", value: formatNumber(Math.round(p.reach * 0.02)) },
    { label: "Compart.", value: formatNumber(Math.round(p.reach * 0.006)) },
    { label: "Taxa engaj.", value: `${((p.likes / p.reach) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` },
  ];
  if (p.mediaType === "reel" || p.mediaType === "video") {
    return [
      ...base,
      { label: "Views totais", value: formatCompact(Math.round(p.reach * 1.6)) },
      { label: "Views completos", value: formatCompact(Math.round(p.reach * 0.7)) },
      { label: "Retenção média", value: `${42 + (p.rank % 3) * 6}%` },
    ];
  }
  if (p.mediaType === "story") {
    return [
      { label: "Visualizações", value: formatCompact(p.reach) },
      { label: "Saídas", value: formatNumber(Math.round(p.reach * 0.12)) },
      { label: "Respostas", value: formatNumber(Math.round(p.reach * 0.01)) },
      { label: "Adesivos", value: formatNumber(Math.round(p.reach * 0.03)) },
    ];
  }
  return [
    ...base,
    { label: "Cliques perfil", value: formatNumber(Math.round(p.reach * 0.015)) },
    { label: "Visitas perfil", value: formatNumber(Math.round(p.reach * 0.02)) },
    { label: "Seguidores novos", value: formatNumber(Math.round(p.reach * 0.004)) },
  ];
}

export function TopPostsCard({
  posts,
  businessType,
  aiFallback,
}: {
  posts: TopPost[];
  businessType: string;
  aiFallback?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [analyze, setAnalyze] = useState(false);

  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">
          Top 3 posts do mês — por alcance
        </h2>
        <button
          onClick={() => setAnalyze((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/25"
        >
          <Sparkles className="h-3.5 w-3.5" /> Analisar: o que eles têm em comum?
        </button>
      </div>

      {analyze && (
        <div className="mb-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4">
          <AiInsights
            mode="common-posts"
            title="Mecanismo IA: o que há em comum?"
            variant="list"
            businessType={businessType}
            data={posts.map((p) => ({
              title: p.title,
              format: p.mediaType,
              reach: p.reach,
              likes: p.likes,
              publishedAt: p.publishedAt,
            }))}
            fallback={aiFallback}
          />
        </div>
      )}

      <ul className="space-y-2">
        {posts.map((p) => {
          const open = expanded === p.rank;
          return (
            <li key={p.rank} className="rounded-xl bg-subtle">
              <button
                onClick={() => setExpanded(open ? null : p.rank)}
                className="flex w-full items-center gap-3 p-2.5 text-left"
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${RANK_STYLE[p.rank - 1] ?? RANK_STYLE[2]}`}
                >
                  {p.rank}
                </span>
                <span
                  className={cn(
                    "relative flex h-[62px] w-[62px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br text-white",
                    THUMB[p.mediaType] ?? THUMB.image,
                  )}
                >
                  {p.mediaType === "reel" || p.mediaType === "video" ? (
                    <Play className="h-5 w-5" fill="currentColor" />
                  ) : (
                    <PlatformIcon platform={p.platform} className="h-5 w-5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-xs text-muted">
                    <PlatformIcon platform={p.platform} className="h-3 w-3" />
                    {MEDIA_LABEL[p.mediaType]}
                  </p>
                  <p className="truncate text-sm font-medium text-ink">{p.title}</p>
                  <p className="text-xs text-muted">
                    publicado {dayMonth(p.publishedAt)}
                  </p>
                </div>
                <div className="hidden shrink-0 grid-cols-3 gap-3 text-center sm:grid">
                  <Stat icon={<Eye className="h-3.5 w-3.5" />} value={formatCompact(p.reach)} label="Alcance" />
                  <Stat icon={<Heart className="h-3.5 w-3.5" />} value={formatNumber(p.likes)} label="Curtidas" />
                  <Stat icon={<MessageCircle className="h-3.5 w-3.5" />} value={formatNumber(p.comments)} label="Coment." />
                </div>
              </button>
              {open && (
                <div className="grid grid-cols-2 gap-3 border-t border-line p-3 sm:grid-cols-4">
                  {metricsFor(p).map((m) => (
                    <div key={m.label}>
                      <p className="text-sm font-semibold text-ink">{m.value}</p>
                      <p className="text-xs text-muted">{m.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div>
      <p className="flex items-center justify-center gap-1 text-xs font-semibold text-ink">
        {icon} {value}
      </p>
      <p className="text-[10px] text-muted">{label}</p>
    </div>
  );
}
