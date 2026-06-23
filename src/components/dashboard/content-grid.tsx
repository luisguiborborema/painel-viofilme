import { Bookmark, Heart, MessageCircle, Play, Share2 } from "lucide-react";
import type { ContentPost } from "@/lib/data/types";
import { Badge } from "@/components/ui/badge";
import { formatCompact } from "@/lib/utils";
import { MEDIA_LABEL, PlatformIcon, STATUS_LABEL } from "./platform";

const GRADIENTS = [
  "from-brand-500 to-brand-700",
  "from-salmon to-brand-500",
  "from-lime-dark to-brand-600",
  "from-brand-400 to-brand-800",
  "from-cream to-salmon",
];

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ContentGrid({ posts }: { posts: ContentPost[] }) {
  if (posts.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line p-10 text-center text-sm text-muted">
        Nenhum conteúdo por aqui ainda.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {posts.map((post, i) => (
        <article
          key={post.id}
          className="group overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition-shadow hover:shadow-md"
        >
          <div
            className={`relative flex aspect-square items-center justify-center bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]}`}
          >
            <span className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur">
              <PlatformIcon platform={post.platform} />
            </span>
            {(post.mediaType === "reel" || post.mediaType === "video") && (
              <Play className="h-10 w-10 text-white/90" fill="currentColor" />
            )}
            <span className="absolute bottom-3 left-3">
              <Badge variant="lime">{MEDIA_LABEL[post.mediaType]}</Badge>
            </span>
          </div>

          <div className="p-4">
            <p className="line-clamp-2 min-h-[2.5rem] text-sm text-ink">
              {post.caption}
            </p>

            {post.status === "scheduled" ? (
              <p className="mt-3 text-xs font-medium text-amber-600">
                Agendado · {formatDate(post.scheduledAt)}
              </p>
            ) : (
              <>
                <p className="mt-3 text-xs text-muted">
                  {formatDate(post.publishedAt)}
                </p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
                  <span className="inline-flex items-center gap-1">
                    <Heart className="h-3.5 w-3.5" /> {formatCompact(post.likes)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-3.5 w-3.5" />{" "}
                    {formatCompact(post.comments)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Share2 className="h-3.5 w-3.5" />{" "}
                    {formatCompact(post.shares)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Bookmark className="h-3.5 w-3.5" />{" "}
                    {formatCompact(post.saves)}
                  </span>
                </div>
              </>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

export { STATUS_LABEL };
