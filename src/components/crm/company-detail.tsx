import Link from "next/link";
import { ArrowLeft, Briefcase, Mail, Phone, Star, Users } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import {
  CRM_STAGES,
  stageLabel,
  type Company,
  type Contact,
  type CrmLead,
  type PropertyDef,
  type Tag,
} from "@/lib/data/crm";
import { ObjectProperties } from "./object-properties";
import { TagPicker } from "./tag-picker";
import { EditableFields } from "./editable-fields";
import { DeleteButton } from "./delete-button";

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

function stageColor(stage: string): string {
  return CRM_STAGES.find((s) => s.key === stage)?.color ?? "#64748b";
}

export function CompanyDetail({
  company,
  contacts,
  deals,
  tags,
  properties,
}: {
  company: Company;
  contacts: Contact[];
  deals: CrmLead[];
  tags: Tag[];
  properties: PropertyDef[];
}) {
  const openValue = deals
    .filter((d) => d.stage !== "ganho" && d.stage !== "perdido")
    .reduce((s, d) => s + d.monthlyValue, 0);
  const companyProps = properties.filter((p) => p.objectType === "company");

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/gerencial/comercial/listas"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted hover:bg-subtle"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-base font-bold text-brand-600">
            {initials(company.name)}
          </span>
          <div>
            <h1 className="text-xl font-bold text-ink">{company.name}</h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
              {company.segment && <span>{company.segment}</span>}
              {company.owner && <span>· {company.owner}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {openValue > 0 && (
            <div className="text-right">
              <p className="text-lg font-bold text-ink">{formatBRL(openValue)}</p>
              <p className="text-xs text-muted">em aberto/mês</p>
            </div>
          )}
          <DeleteButton
            endpoint="/api/crm/companies"
            id={company.id}
            redirectTo="/gerencial/comercial/listas"
            confirmLabel={`Excluir “${company.name}”?`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Coluna principal: deals + contatos */}
        <div className="space-y-4 lg:col-span-2">
          <section className="rounded-2xl border border-line bg-surface">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
                <Briefcase className="h-4 w-4" /> Negócios ({deals.length})
              </h2>
            </div>
            <div className="divide-y divide-line">
              {deals.map((d) => (
                <Link
                  key={d.id}
                  href={`/gerencial/crm/${d.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-subtle"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: stageColor(d.stage) }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{d.name}</p>
                    <p className="text-xs text-muted">
                      {stageLabel(d.stage)}
                      {d.plan ? ` · ${d.plan}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-ink">
                    {formatBRL(d.monthlyValue)}
                  </span>
                </Link>
              ))}
              {deals.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-muted">
                  Nenhum negócio para esta empresa ainda.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-surface">
            <div className="border-b border-line px-4 py-3">
              <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
                <Users className="h-4 w-4" /> Contatos ({contacts.length})
              </h2>
            </div>
            <div className="divide-y divide-line">
              {contacts.map((c) => (
                <Link
                  key={c.id}
                  href={`/gerencial/crm/contato/${c.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-subtle"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">
                    {initials(c.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-medium text-ink">{c.name}</p>
                      {c.isPrimary && (
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      )}
                    </div>
                    {c.title && <p className="text-xs text-muted">{c.title}</p>}
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
                </Link>
              ))}
              {contacts.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-muted">
                  Nenhum contato cadastrado.
                </p>
              )}
            </div>
          </section>
        </div>

        {/* Coluna lateral: dados + propriedades */}
        <div className="space-y-4">
          <TagPicker
            objectType="company"
            id={company.id}
            allTags={tags}
            initialIds={company.tags}
          />

          <EditableFields
            objectType="company"
            id={company.id}
            title="Dados da empresa"
            initial={{
              name: company.name,
              segment: company.segment ?? "",
              website: company.website ?? "",
              phone: company.phone ?? "",
              email: company.email ?? "",
              city: company.city ?? "",
              size: company.size ?? "",
              owner: company.owner ?? "",
            }}
            fields={[
              { key: "name", label: "Nome" },
              { key: "segment", label: "Segmento" },
              { key: "website", label: "Website", type: "url" },
              { key: "phone", label: "Telefone", type: "tel" },
              { key: "email", label: "E-mail", type: "email" },
              { key: "city", label: "Cidade" },
              { key: "size", label: "Porte", placeholder: "1-10, 11-50…" },
              { key: "owner", label: "Responsável" },
            ]}
          />

          <ObjectProperties
            objectType="company"
            id={company.id}
            defs={companyProps}
            initialValues={company.properties}
          />
        </div>
      </div>
    </div>
  );
}
