"use client";

import { useState } from "react";
import {
  Bookmark,
  Heart,
  ImageIcon,
  MessageCircle,
  MoreHorizontal,
  Music2,
  Play,
  Send,
  X,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

export type PreviewPost = {
  caption: string;
  format: "Feed" | "Reels" | "Stories";
  creativeUrl?: string | null;
  isVideo?: boolean;
  handle?: string;
  whenLabel?: string;
};

type Fmt = "Feed" | "Reels" | "Stories";

export function PostPreview({
  open,
  onClose,
  post,
}: {
  open: boolean;
  onClose: () => void;
  post: PreviewPost | null;
}) {
  const [fmt, setFmt] = useState<Fmt>(post?.format ?? "Feed");
  const [lastPost, setLastPost] = useState(post);
  if (post !== lastPost) {
    setLastPost(post);
    if (post) setFmt(post.format);
  }
  if (!post) return null;
  const handle = post.handle ?? "sabordomar";

  return (
    <Modal open={open} onClose={onClose} title="Pré-visualização" size="md">
      <div className="mb-4 inline-flex rounded-xl border border-line bg-subtle p-1">
        {(["Feed", "Reels", "Stories"] as Fmt[]).map((f) => (
          <button
            key={f}
            onClick={() => setFmt(f)}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
              fmt === f ? "bg-brand-500 text-white" : "text-muted hover:text-ink",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="flex justify-center">
        {fmt === "Feed" && <FeedMock post={post} handle={handle} />}
        {fmt === "Reels" && <ReelsMock post={post} handle={handle} />}
        {fmt === "Stories" && <StoriesMock post={post} handle={handle} />}
      </div>

      <div className="mt-4">
        <p className="mb-1 text-xs font-medium text-muted">Legenda</p>
        <p className="rounded-xl border border-line bg-canvas p-3 text-sm text-ink/90">
          {post.caption}
        </p>
      </div>
    </Modal>
  );
}

function Media({
  post,
  className,
}: {
  post: PreviewPost;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-gradient-to-br from-brand-500 to-brand-700 text-white/50",
        className,
      )}
    >
      {post.creativeUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.creativeUrl} alt="" className="h-full w-full object-cover" />
      ) : post.isVideo ? (
        <Play className="h-10 w-10" />
      ) : (
        <ImageIcon className="h-10 w-10" />
      )}
    </div>
  );
}

function Avatar({ handle }: { handle: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-7 w-7 rounded-full bg-gradient-to-br from-salmon to-brand-500" />
      <span className="text-sm font-semibold text-ink">@{handle}</span>
    </div>
  );
}

function FeedMock({ post, handle }: { post: PreviewPost; handle: string }) {
  return (
    <div className="w-[320px] overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex items-center justify-between p-3">
        <Avatar handle={handle} />
        <MoreHorizontal className="h-5 w-5 text-muted" />
      </div>
      <Media post={post} className="aspect-square w-full" />
      <div className="flex items-center gap-4 p-3 text-ink">
        <Heart className="h-6 w-6" />
        <MessageCircle className="h-6 w-6" />
        <Send className="h-6 w-6" />
        <Bookmark className="ml-auto h-6 w-6" />
      </div>
      <p className="line-clamp-2 px-3 pb-3 text-sm text-ink">
        <span className="font-semibold">@{handle}</span> {post.caption}
      </p>
    </div>
  );
}

function ReelsMock({ post, handle }: { post: PreviewPost; handle: string }) {
  return (
    <div className="relative w-[260px] overflow-hidden rounded-xl border border-line">
      <Media post={post} className="aspect-[9/16] w-full" />
      <div className="absolute right-2 bottom-16 flex flex-col items-center gap-4 text-white">
        <div className="flex flex-col items-center">
          <Heart className="h-6 w-6" />
          <span className="text-[11px]">1.2k</span>
        </div>
        <MessageCircle className="h-6 w-6" />
        <Send className="h-6 w-6" />
        <MoreHorizontal className="h-6 w-6" />
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pr-12 text-white">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-sm font-semibold">@{handle}</span>
          <span className="rounded border border-white/60 px-1.5 text-[11px]">
            Seguir
          </span>
        </div>
        <p className="line-clamp-2 text-xs">{post.caption}</p>
        <p className="mt-1 flex items-center gap-1 text-[11px]">
          <Music2 className="h-3 w-3" /> áudio original
        </p>
      </div>
    </div>
  );
}

function StoriesMock({ post, handle }: { post: PreviewPost; handle: string }) {
  return (
    <div className="relative w-[260px] overflow-hidden rounded-xl border border-line">
      <Media post={post} className="aspect-[9/16] w-full" />
      <div className="absolute inset-x-0 top-0 p-2">
        <div className="mb-2 h-0.5 w-full rounded-full bg-white/40">
          <div className="h-full w-1/3 rounded-full bg-white" />
        </div>
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <span className="h-6 w-6 rounded-full bg-gradient-to-br from-salmon to-brand-500" />
            <span className="text-xs font-semibold">@{handle}</span>
            <span className="text-[11px] text-white/70">
              {post.whenLabel ?? "agora"}
            </span>
          </div>
          <X className="h-5 w-5" />
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 p-3">
        <div className="rounded-full border border-white/60 px-3 py-2 text-xs text-white/80">
          Enviar mensagem
        </div>
      </div>
    </div>
  );
}
