"use client";

import { useState } from "react";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  MessageSquare,
  MessageSquarePlus,
  Play,
} from "lucide-react";
import { PlatformIcon } from "@/components/dashboard/platform";
import { AdjustModal } from "./adjust-modal";
import { cn } from "@/lib/utils";
import type { Platform, MediaType } from "@/lib/data/types";

export type Bucket = "para-aprovar" | "em-ajuste" | "agendados" | "publicados";

export type ApprovalCardData = {
  id: string;
  formatLabel: "Feed" | "Reels" | "Stories";
  platform: Platform;
  mediaType: MediaType;
  publicationLabel: string;
  caption: string;
  author: string | null;
  waitingLabel: string | null;
  bucket: Bucket;
};

const FORMAT_STYLE: Record<string, string> = {
  Feed: "bg-amber-500/20 text-amber-300",
  Reels: "bg-rose-500/20 text-rose-300",
  Stories: "bg-violet-500/20 text-violet-300",
};

export function ApprovalCard({ post }: { post: ApprovalCardData }) {
  const [state, setState] = useState<"idle" | "approved" | "adjustment">(
    post.bucket === "em-ajuste" ? "adjustment" : "idle",
  );
  const [modalOpen, setModalOpen] = useState(false);

  const isVideo = post.mediaType === "reel" || post.mediaType === "video";
  const canAct = post.bucket === "para-aprovar" && state === "idle";

  const status = (() => {
    if (state === "approved")
      return { label: "Aprovado!", cls: "text-emerald-300", Icon: CheckCircle2 };
    if (state === "adjustment")
      return { label: "Ajuste solicitado", cls: "text-amber-300", Icon: MessageSquare };
    if (post.bucket === "agendados")
      return { label: "Aprovado · agendado", cls: "text-emerald-300", Icon: CheckCircle2 };
    if (post.bucket === "publicados")
      return { label: "Publicado", cls: "text-sky-300", Icon: CheckCircle2 };
    return { label: "Aguardando aprovação", cls: "text-amber-300", Icon: Clock };
  })();

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      {/* Mídia */}
      <div className="relative flex aspect-[16/10] items-center justify-center bg-gradient-to-br from-brand-600/40 to-brand-900/40">
        <span
          className={cn(
            "absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
            FORMAT_STYLE[post.formatLabel],
          )}
        >
          {isVideo ? <Play className="h-3 w-3" /> : null}
          {post.formatLabel}
        </span>
        {post.waitingLabel && post.bucket === "para-aprovar" && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-0.5 text-xs font-medium text-white/90 backdrop-blur">
            <Clock className="h-3 w-3" /> {post.waitingLabel}
          </span>
        )}
        <span className="text-white/40">
          {isVideo ? <Play className="h-9 w-9" /> : <PlatformIcon platform={post.platform} className="h-9 w-9" />}
        </span>
      </div>

      {/* Corpo */}
      <div className="p-4">
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <CalendarDays className="h-3.5 w-3.5" />
          Publicação: {post.publicationLabel}
        </p>
        <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm font-medium text-ink">
          {post.caption}
        </p>

        <div className="mt-3 flex items-center justify-between">
          <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", status.cls)}>
            <status.Icon className="h-3.5 w-3.5" />
            {status.label}
          </span>
          {post.author && (
            <span className="text-xs text-muted">por {post.author}</span>
          )}
        </div>

        {/* Ações */}
        {canAct ? (
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => setState("approved")}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-400"
            >
              <Check className="h-4 w-4" /> Aprovar
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-white/5 px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-white/10"
            >
              <MessageSquarePlus className="h-4 w-4" /> Pedir ajuste
            </button>
            <button
              className="inline-flex items-center justify-center rounded-xl border border-line bg-white/5 p-2 text-muted transition-colors hover:text-ink"
              aria-label="Pré-visualizar"
            >
              <Eye className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-2">
            <button
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-line bg-white/5 px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-white/10"
            >
              <Eye className="h-4 w-4" /> Pré-visualizar
            </button>
          </div>
        )}
      </div>

      {modalOpen && (
        <AdjustModal
          postTitle={post.caption}
          onClose={() => setModalOpen(false)}
          onSubmit={() => {
            setState("adjustment");
            setModalOpen(false);
          }}
        />
      )}
    </article>
  );
}
