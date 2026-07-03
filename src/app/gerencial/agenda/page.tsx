import Link from "next/link";
import { CalendarDays, ExternalLink, Video } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getGoogleStatus } from "@/lib/google/client";
import { listUpcomingEvents } from "@/lib/google/calendar";
import { isGoogleConfigured } from "@/lib/google/config";
import type { GoogleEvent } from "@/lib/google/types";

const TZ = "America/Sao_Paulo";

function dayKey(iso?: string) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: TZ,
  }).format(new Date(iso));
}

function timeRange(e: GoogleEvent) {
  if (e.allDay || !e.start) return "Dia inteiro";
  const f = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
  return e.end ? `${f.format(new Date(e.start))} – ${f.format(new Date(e.end))}` : f.format(new Date(e.start));
}

export default async function AgendaPage() {
  const status = await getGoogleStatus();
  const events = status.connected ? await listUpcomingEvents(30) : [];

  // Agrupa por dia.
  const groups = new Map<string, GoogleEvent[]>();
  for (const e of events) {
    const k = dayKey(e.start);
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }

  return (
    <div>
      <PageHeader
        title="Agenda"
        subtitle="Próximos compromissos do Google Agenda da agência."
      />

      {!status.connected ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-600">
            <CalendarDays className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">Google Agenda não conectada</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
              {isGoogleConfigured()
                ? "Conecte a conta da agência para ver e criar eventos."
                : "Configure as credenciais do Google (veja Integrações)."}
            </p>
          </div>
          <Link href="/gerencial/integracoes">
            <Button size="sm">Ir para Integrações</Button>
          </Link>
        </Card>
      ) : events.length === 0 ? (
        <Card className="px-6 py-16 text-center text-sm text-muted">
          Nenhum compromisso futuro no Google Agenda.
        </Card>
      ) : (
        <div className="space-y-5">
          {[...groups.entries()].map(([day, list]) => (
            <div key={day}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                {day}
              </p>
              <div className="space-y-2">
                {list.map((e) => (
                  <Card key={e.id} className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{e.summary}</p>
                      <p className="text-xs text-muted">
                        {timeRange(e)}
                        {e.attendees.length > 0 && ` · ${e.attendees.length} convidado(s)`}
                        {e.location && ` · ${e.location}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {e.hangoutLink && (
                        <a
                          href={e.hangoutLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-500/25"
                        >
                          <Video className="h-3.5 w-3.5" /> Meet
                        </a>
                      )}
                      {e.htmlLink && (
                        <a
                          href={e.htmlLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-subtle"
                        >
                          Abrir <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
