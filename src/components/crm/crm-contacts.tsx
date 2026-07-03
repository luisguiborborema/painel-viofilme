"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Phone, Search, Star, Users } from "lucide-react";
import type { Company, Contact, Tag } from "@/lib/data/crm";
import { TagChips } from "./tag-chips";

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

export function CrmContacts({
  contacts,
  companies,
  tags,
}: {
  contacts: Contact[];
  companies: Company[];
  tags: Tag[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const companyName = (id?: string) => companies.find((c) => c.id === id)?.name;

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return contacts
      .filter(
        (c) =>
          !term ||
          c.name.toLowerCase().includes(term) ||
          (c.email ?? "").toLowerCase().includes(term) ||
          (companyName(c.companyId) ?? "").toLowerCase().includes(term),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts, companies, q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {contacts.length} contato{contacts.length !== 1 ? "s" : ""}
        </p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar contato, e-mail ou empresa…"
            className="w-64 rounded-xl border border-line bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-brand-400"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        {rows.map((c) => (
          <button
            key={c.id}
            onClick={() =>
              c.companyId && router.push(`/gerencial/crm/empresa/${c.companyId}`)
            }
            className="flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left last:border-b-0 hover:bg-subtle"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">
              {initials(c.name)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-semibold text-ink">{c.name}</p>
                {c.isPrimary && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
              </div>
              <p className="truncate text-xs text-muted">
                {c.title ? `${c.title} · ` : ""}
                {companyName(c.companyId) ?? "Sem empresa"}
              </p>
            </div>
            <div className="hidden items-center gap-3 text-xs text-muted sm:flex">
              {c.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> {c.phone}
                </span>
              )}
              {c.email && (
                <span className="inline-flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" /> {c.email}
                </span>
              )}
            </div>
            <TagChips ids={c.tags} tags={tags} size="xs" />
          </button>
        ))}
        {rows.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted">
            <Users className="h-6 w-6" />
            Nenhum contato encontrado.
          </div>
        )}
      </div>
    </div>
  );
}
