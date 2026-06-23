import type { Platform } from "@/lib/data/types";
import { FacebookIcon, InstagramIcon } from "@/components/brand/social-icons";

export function PlatformIcon({
  platform,
  className,
}: {
  platform: Platform;
  className?: string;
}) {
  const Icon = platform === "instagram" ? InstagramIcon : FacebookIcon;
  return <Icon className={className} />;
}

export const PLATFORM_LABEL: Record<Platform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
};

export const MEDIA_LABEL: Record<string, string> = {
  image: "Imagem",
  video: "Vídeo",
  carousel: "Carrossel",
  reel: "Reels",
  story: "Story",
};

export const STATUS_LABEL: Record<string, string> = {
  published: "Publicado",
  scheduled: "Agendado",
  draft: "Rascunho",
  active: "Ativa",
  paused: "Pausada",
  ended: "Encerrada",
};
