import { MessageSquare, Phone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TeamMember } from "@/lib/data/types";

const ACCENTS = [
  "bg-amber-500/20 text-amber-300",
  "bg-teal-500/20 text-teal-300",
  "bg-pink-500/20 text-pink-300",
  "bg-violet-500/20 text-violet-300",
];

export function TeamCard({
  member,
  accent = 0,
}: {
  member: TeamMember;
  accent?: number;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold",
            ACCENTS[accent % ACCENTS.length],
          )}
        >
          {member.initials}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{member.name}</p>
          <p className="truncate text-xs text-muted">
            {member.role} · {member.area}
          </p>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-subtle px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-subtle-strong">
          <MessageSquare className="h-4 w-4" /> Mensagem
        </button>
        <a
          href={member.whatsapp}
          target="_blank"
          rel="noreferrer"
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3 py-2 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/25"
        >
          <Phone className="h-4 w-4" /> WhatsApp
        </a>
      </div>
    </Card>
  );
}
