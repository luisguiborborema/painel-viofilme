import Link from "next/link";
import { ArrowUpRight, ImageIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PlatformIcon, PLATFORM_LABEL } from "@/components/dashboard/platform";
import type { Platform } from "@/lib/data/types";

export type UpcomingPostItem = {
  id: string;
  title: string;
  platform: Platform;
  whenLabel: string;
  status: "pending" | "approved";
};

export function UpcomingPostsCard({ items }: { items: UpcomingPostItem[] }) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Próximas publicações</h2>
        <Link
          href="/cliente/conteudo"
          className="inline-flex items-center gap-1 text-xs font-medium text-sky-400 hover:text-sky-300"
        >
          Ver calendário <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-3 rounded-xl bg-white/5 p-2.5"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white">
              <ImageIcon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">
                {item.title}
              </p>
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <PlatformIcon platform={item.platform} className="h-3 w-3" />
                {PLATFORM_LABEL[item.platform]} · {item.whenLabel}
              </p>
            </div>
            {item.status === "pending" ? (
              <span className="shrink-0 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300">
                Pendente
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-sky-500/15 px-2.5 py-1 text-xs font-medium text-sky-300">
                Agendado
              </span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
