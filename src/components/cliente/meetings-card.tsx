"use client";

import { useState } from "react";
import { Plus, Users, Video } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { MeetingRequestModal } from "./meeting-request-modal";

export type MeetingItem = {
  id: string;
  title: string;
  whenLabel: string;
  joinUrl: string;
  agenda: string;
  participants: string[];
  nextSteps: string;
};

export function MeetingsCard({ items }: { items: MeetingItem[] }) {
  const [agenda, setAgenda] = useState<MeetingItem | null>(null);
  const [requesting, setRequesting] = useState(false);

  return (
    <Card className="flex flex-col p-5">
      <h2 className="mb-3 text-sm font-semibold text-ink">Próximas reuniões</h2>

      <ul className="space-y-2">
        {items.map((m) => (
          <li key={m.id}>
            <button
              onClick={() => setAgenda(m)}
              className="w-full rounded-xl bg-subtle p-3 text-left transition-colors hover:bg-subtle-strong"
            >
              <p className="text-xs font-medium text-emerald-300">{m.whenLabel}</p>
              <p className="mt-0.5 text-sm font-medium text-ink">{m.title}</p>
              <a
                href={m.joinUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-sky-400 hover:text-sky-300"
              >
                <Video className="h-3.5 w-3.5" /> Google Meet
              </a>
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-4 border-t border-line pt-4">
        <p className="text-xs text-muted">Solicitar reunião</p>
        <button
          onClick={() => setRequesting(true)}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-subtle px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-subtle-strong"
        >
          <Plus className="h-4 w-4" /> Solicitar horário
        </button>
      </div>

      <Modal
        open={agenda !== null}
        onClose={() => setAgenda(null)}
        title={agenda?.title}
        description={agenda?.whenLabel}
        size="md"
      >
        {agenda && (
          <div className="space-y-4 text-sm">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                Pauta
              </p>
              <p className="text-ink/90">{agenda.agenda}</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                Participantes
              </p>
              <p className="flex flex-wrap items-center gap-2 text-ink/90">
                <Users className="h-4 w-4 text-muted" />
                {agenda.participants.join(" · ")}
              </p>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                Próximos passos (da última reunião)
              </p>
              <p className="text-ink/90">{agenda.nextSteps}</p>
            </div>
            <a
              href={agenda.joinUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
            >
              <Video className="h-4 w-4" /> Entrar no Google Meet
            </a>
          </div>
        )}
      </Modal>

      <MeetingRequestModal open={requesting} onClose={() => setRequesting(false)} />
    </Card>
  );
}
