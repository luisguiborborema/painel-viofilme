"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ClipboardList, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ClientFormSubmission } from "@/lib/data/forms-types";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Formulários que o cliente preencheu + respostas + link para o card criado. */
export function ClientFormsCard({ subs }: { subs: ClientFormSubmission[] }) {
  const [open, setOpen] = useState<string | null>(subs[0]?.id ?? null);

  return (
    <Card className="p-5">
      <h2 className="mb-1 inline-flex items-center gap-2 text-sm font-semibold text-ink">
        <ClipboardList className="h-4 w-4 text-brand-500" /> Formulários preenchidos
      </h2>
      <p className="mb-3 text-xs text-muted">
        Briefings e respostas enviados por este cliente. Abra o card criado a partir de cada envio.
      </p>
      <ul className="space-y-2">
        {subs.map((s) => {
          const isOpen = open === s.id;
          const target = s.taskId
            ? { href: `/gerencial/entregas?task=${s.taskId}`, label: "Abrir tarefa" }
            : s.leadId
              ? { href: `/gerencial/crm/${s.leadId}`, label: "Abrir negócio" }
              : null;
          return (
            <li key={s.id} className="rounded-xl border border-line">
              <div className="flex items-center gap-2 px-3 py-2">
                <button
                  onClick={() => setOpen((o) => (o === s.id ? null : s.id))}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", isOpen ? "" : "-rotate-90")} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{s.formName}</span>
                    <span className="text-[11px] text-muted">
                      {fmtDate(s.createdAt)} · {s.entries.length} resposta{s.entries.length === 1 ? "" : "s"}
                    </span>
                  </span>
                </button>
                {target && (
                  <Link
                    href={target.href}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-[11px] font-medium text-brand-600 hover:bg-subtle"
                  >
                    <ExternalLink className="h-3 w-3" /> {target.label}
                  </Link>
                )}
              </div>
              {isOpen && s.entries.length > 0 && (
                <dl className="divide-y divide-line border-t border-line">
                  {s.entries.map((e, i) => (
                    <div key={i} className="px-3 py-2">
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{e.label}</dt>
                      <dd className="mt-0.5 whitespace-pre-wrap break-words text-sm text-ink/90">{e.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
