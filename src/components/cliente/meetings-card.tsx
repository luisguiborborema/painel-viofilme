import { Plus, Video } from "lucide-react";
import { Card } from "@/components/ui/card";

export type MeetingItem = {
  id: string;
  title: string;
  whenLabel: string;
  joinUrl: string;
};

export function MeetingsCard({ items }: { items: MeetingItem[] }) {
  return (
    <Card className="flex flex-col p-5">
      <h2 className="mb-3 text-sm font-semibold text-ink">Próximas reuniões</h2>

      <ul className="space-y-2">
        {items.map((m) => (
          <li key={m.id} className="rounded-xl bg-subtle p-3">
            <p className="text-xs font-medium text-emerald-300">{m.whenLabel}</p>
            <p className="mt-0.5 text-sm font-medium text-ink">{m.title}</p>
            <a
              href={m.joinUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-sky-400 hover:text-sky-300"
            >
              <Video className="h-3.5 w-3.5" /> Google Meet
            </a>
          </li>
        ))}
      </ul>

      <div className="mt-4 border-t border-line pt-4">
        <p className="text-xs text-muted">Solicitar reunião</p>
        <button className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-subtle px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-subtle-strong">
          <Plus className="h-4 w-4" /> Solicitar horário
        </button>
      </div>
    </Card>
  );
}
