"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Star, Users, X } from "lucide-react";
import type { Contact } from "@/lib/data/crm";

async function post(body: unknown) {
  await fetch("/api/crm/deal-contacts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

/** Contatos associados a um negócio (N:N), com add/remover. */
export function DealContacts({
  dealId,
  initial,
  candidates,
  primaryContactId,
}: {
  dealId: string;
  initial: Contact[];
  candidates: Contact[];
  primaryContactId?: string;
}) {
  const router = useRouter();
  const [list, setList] = useState<Contact[]>(initial);
  const [open, setOpen] = useState(false);

  const available = candidates.filter((c) => !list.some((x) => x.id === c.id));

  async function add(c: Contact) {
    setList((prev) => [...prev, c]);
    setOpen(false);
    await post({ action: "add", dealId, contactId: c.id });
    router.refresh();
  }

  async function remove(id: string) {
    setList((prev) => prev.filter((c) => c.id !== id));
    await post({ action: "remove", dealId, contactId: id });
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
          <Users className="h-4 w-4" /> Contatos ({list.length})
        </h2>
        <div className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            disabled={available.length === 0}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-2 py-0.5 text-[11px] font-medium text-muted hover:bg-subtle disabled:opacity-40"
          >
            <Plus className="h-3 w-3" /> adicionar
          </button>
          {open && available.length > 0 && (
            <div className="absolute right-0 top-full z-10 mt-1 max-h-56 w-52 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-lg">
              {available.map((c) => (
                <button
                  key={c.id}
                  onClick={() => add(c)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-subtle"
                >
                  <span className="truncate">{c.name}</span>
                  {c.title && <span className="ml-auto truncate text-xs text-muted">{c.title}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {list.length === 0 ? (
        <p className="py-3 text-center text-xs text-muted">
          Nenhum contato associado a este negócio.
        </p>
      ) : (
        <div className="space-y-1.5">
          {list.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2 rounded-lg bg-canvas px-2.5 py-2"
            >
              <Link href={`/gerencial/crm/contato/${c.id}`} className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-medium text-ink hover:underline">
                    {c.name}
                  </p>
                  {(c.isPrimary || c.id === primaryContactId) && (
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  )}
                </div>
                <p className="truncate text-[11px] text-muted">
                  {c.title ?? c.phone ?? c.email ?? "—"}
                </p>
              </Link>
              <button
                onClick={() => remove(c.id)}
                className="rounded-full p-1 text-muted hover:bg-rose-500/10 hover:text-rose-500"
                title="Remover do negócio"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
