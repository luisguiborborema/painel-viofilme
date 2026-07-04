"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, GitMerge, Loader2 } from "lucide-react";
import {
  findDuplicateCompanies,
  findDuplicateContacts,
  type Company,
  type Contact,
} from "@/lib/data/crm";

type Kind = "company" | "contact";

export function DuplicatesManager({
  companies,
  contacts,
}: {
  companies: Company[];
  contacts: Contact[];
}) {
  const companyGroups = useMemo(() => findDuplicateCompanies(companies), [companies]);
  const contactGroups = useMemo(() => findDuplicateContacts(contacts), [contacts]);

  const none = companyGroups.length === 0 && contactGroups.length === 0;

  return (
    <div className="space-y-5">
      {none && (
        <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          Nenhum duplicado encontrado. 🎉
        </div>
      )}

      {companyGroups.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Empresas ({companyGroups.length} grupo{companyGroups.length !== 1 ? "s" : ""})
          </p>
          <div className="space-y-2">
            {companyGroups.map((g, i) => (
              <Group
                key={`co-${i}`}
                kind="company"
                items={g.map((c) => ({ id: c.id, label: c.name, sub: c.segment ?? c.phone ?? c.email ?? "" }))}
              />
            ))}
          </div>
        </div>
      )}

      {contactGroups.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Contatos ({contactGroups.length} grupo{contactGroups.length !== 1 ? "s" : ""})
          </p>
          <div className="space-y-2">
            {contactGroups.map((g, i) => (
              <Group
                key={`ct-${i}`}
                kind="contact"
                items={g.map((c) => ({ id: c.id, label: c.name, sub: c.phone ?? c.email ?? "" }))}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Group({
  kind,
  items,
}: {
  kind: Kind;
  items: { id: string; label: string; sub: string }[];
}) {
  const router = useRouter();
  const [primary, setPrimary] = useState(items[0].id);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function merge() {
    setBusy(true);
    await fetch("/api/crm/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: kind,
        primaryId: primary,
        mergeIds: items.filter((it) => it.id !== primary).map((it) => it.id),
      }),
    }).catch(() => {});
    setBusy(false);
    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-700">
        Mesclado ✅
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <p className="mb-2 text-[11px] text-muted">Manter (primário):</p>
      <div className="space-y-1.5">
        {items.map((it) => (
          <label key={it.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-subtle">
            <input
              type="radio"
              checked={primary === it.id}
              onChange={() => setPrimary(it.id)}
              className="h-4 w-4 accent-brand-600"
            />
            <span className="min-w-0 flex-1">
              <span className="text-sm font-medium text-ink">{it.label}</span>
              {it.sub && <span className="ml-2 text-xs text-muted">{it.sub}</span>}
            </span>
          </label>
        ))}
      </div>
      <div className="mt-2 flex justify-end">
        <button
          onClick={merge}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitMerge className="h-3.5 w-3.5" />}
          Mesclar {items.length} em 1
        </button>
      </div>
    </div>
  );
}
