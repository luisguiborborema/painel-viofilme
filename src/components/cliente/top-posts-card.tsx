import { ArrowUpRight, Eye, Heart, MessageCircle, Play } from "lucide-react";
import { Card } from "@/components/ui/card";
import { MEDIA_LABEL, PlatformIcon } from "@/components/dashboard/platform";
import { dayMonth } from "@/lib/datetime";
import { formatCompact, formatNumber } from "@/lib/utils";
import type { TopPost } from "@/lib/data/types";

const RANK_STYLE = [
  "bg-amber-400 text-amber-950",
  "bg-zinc-300 text-zinc-800",
  "bg-orange-400/80 text-orange-950",
];

export function TopPostsCard({ posts }: { posts: TopPost[] }) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">
          Top 3 posts do mês — por alcance
        </h2>
        <button className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300">
          O que eles têm em comum? <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <ul className="space-y-2">
        {posts.map((p) => (
          <li
            key={p.rank}
            className="flex items-center gap-3 rounded-xl bg-subtle p-2.5"
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${RANK_STYLE[p.rank - 1] ?? RANK_STYLE[2]}`}
            >
              {p.rank}
            </span>

            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white">
              {p.mediaType === "reel" || p.mediaType === "video" ? (
                <Play className="h-4 w-4" fill="currentColor" />
              ) : (
                <PlatformIcon platform={p.platform} />
              )}
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{p.title}</p>
              <p className="text-xs text-muted">
                {MEDIA_LABEL[p.mediaType]} · publicado {dayMonth(p.publishedAt)}
              </p>
            </div>

            <div className="hidden shrink-0 items-center gap-3 text-xs text-muted sm:flex">
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" /> {formatCompact(p.reach)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Heart className="h-3.5 w-3.5" /> {formatNumber(p.likes)}
              </span>
              <span className="inline-flex items-center gap-1">
                <MessageCircle className="h-3.5 w-3.5" /> {formatNumber(p.comments)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
