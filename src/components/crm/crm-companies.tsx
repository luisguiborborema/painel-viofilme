"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus, Search, Users, Briefcase } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import type { Company, Contact, CrmLead, Tag } from "@/lib/data/crm";
import { TagChips } from "./tag-chips";
import { NewCompanyModal } from "./new-company-modal";
import { InlineDelete } from "./delete-button";

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

export function CrmCompanies({
  companies,
  contacts,
  deals,
  tags,
}: {
  companies: Company[];
  contacts: Contact[];
  deals: CrmLead[];
  tags: Tag[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [deleted, setDeleted] = useState<Set<string>>(new Set());

  async function removeCompany(id: string) {
    setDeleted((prev) => new Set(prev).add(id));
    await fetch("/api/crm/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    }).catch(() => {});
    router.refresh();
  }

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return companies
      .map((c) => {
        const cDeals = deals.filter((d) => d.companyId === c.id);
        const open = cDeals.filter((d) => d.stage !== "ganho" && d.stage !== "perdido");
        return {
          company: c,
          contacts: contacts.filter((ct) => ct.companyId === c.id).length,
          deals: cDeals.length,
          openValue: open.reduce((s, d) => s + d.monthlyValue, 0),
        };
      })
      .filter(({ company }) =>
        !term ||
        company.name.toLowerCase().includes(term) ||
        (company.segment ?? "").toLowerCase().includes(term),
      )
      .sort((a, b) => b.openValue - a.openValue);
  }, [companies, contacts, deals, q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {companies.length} empresa{companies.length !== 1 ? "s" : ""}
        </p>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar empresa ou segmento…"
              className="w-64 rounded-xl border border-line bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-brand-400"
            />
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" /> Nova empresa
          </button>
        </div>
      </div>

      {showNew && <NewCompanyModal onClose={() => setShowNew(false)} />}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.filter((r) => !deleted.has(r.company.id)).map(({ company, contacts: nc, deals: nd, openValue }) => (
          <div
            key={company.id}
            role="button"
            tabIndex={0}
            onClick={() => router.push(`/gerencial/crm/empresa/${company.id}`)}
            className="group flex cursor-pointer flex-col rounded-2xl border border-line bg-surface p-4 text-left transition-shadow hover:shadow-md"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-sm font-bold text-brand-600">
                {initials(company.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{company.name}</p>
                <p className="truncate text-xs text-muted">
                  {company.segment ?? "Sem segmento"}
                  {company.owner ? ` · ${company.owner}` : ""}
                </p>
              </div>
              <InlineDelete onConfirm={() => removeCompany(company.id)} />
            </div>
            {company.tags.length > 0 && (
              <div className="mt-2">
                <TagChips ids={company.tags} tags={tags} size="xs" />
              </div>
            )}
            <div className="mt-3 flex items-center gap-4 text-xs text-muted">
              <span className="inline-flex items-center gap-1">
                <Briefcase className="h-3.5 w-3.5" /> {nd} deal{nd !== 1 ? "s" : ""}
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> {nc} contato{nc !== 1 ? "s" : ""}
              </span>
            </div>
            {openValue > 0 && (
              <p className="mt-2 text-sm font-bold text-ink">
                {formatBRL(openValue)}
                <span className="text-xs font-normal text-muted">/mês em aberto</span>
              </p>
            )}
          </div>
        ))}
        {rows.length === 0 && (
          <div className="col-span-full flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line py-12 text-center text-sm text-muted">
            <Building2 className="h-6 w-6" />
            Nenhuma empresa encontrada.
          </div>
        )}
      </div>
    </div>
  );
}
