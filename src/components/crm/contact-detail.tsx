import Link from "next/link";
import { ArrowLeft, Briefcase, Building2, Star } from "lucide-react";
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

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

function stageColor(stage: string): string {
  return CRM_STAGES.find((s) => s.key === stage)?.color ?? "#64748b";
}

export function ContactDetail({
  contact,
  company,
  deals,
  tags,
  properties,
}: {
  contact: Contact;
  company: Company | null;
  deals: CrmLead[];
  tags: Tag[];
  properties: PropertyDef[];
}) {
  const contactProps = properties.filter((p) => p.objectType === "contact");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href={company ? `/gerencial/crm/empresa/${company.id}` : "/gerencial/crm?tab=contatos"}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted hover:bg-subtle"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-base font-bold text-brand-600">
          {initials(contact.name)}
        </span>
        <div>
          <h1 className="flex items-center gap-1.5 text-xl font-bold text-ink">
            {contact.name}
            {contact.isPrimary && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
          </h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
            {contact.title && <span>{contact.title}</span>}
            {company && (
              <Link
                href={`/gerencial/crm/empresa/${company.id}`}
                className="inline-flex items-center gap-1 hover:text-ink"
              >
                <Building2 className="h-3.5 w-3.5" /> {company.name}
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="rounded-2xl border border-line bg-surface">
            <div className="border-b border-line px-4 py-3">
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
                    <p className="text-xs text-muted">{stageLabel(d.stage)}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-ink">
                    {formatBRL(d.monthlyValue)}
                  </span>
                </Link>
              ))}
              {deals.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-muted">
                  Nenhum negócio vinculado a este contato.
                </p>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <TagPicker
            objectType="contact"
            id={contact.id}
            allTags={tags}
            initialIds={contact.tags}
          />

          <EditableFields
            objectType="contact"
            id={contact.id}
            title="Dados do contato"
            initial={{
              name: contact.name,
              title: contact.title ?? "",
              phone: contact.phone ?? "",
              email: contact.email ?? "",
              owner: contact.owner ?? "",
            }}
            fields={[
              { key: "name", label: "Nome" },
              { key: "title", label: "Cargo" },
              { key: "phone", label: "Telefone", type: "tel" },
              { key: "email", label: "E-mail", type: "email" },
              { key: "owner", label: "Responsável" },
            ]}
          />

          <ObjectProperties
            objectType="contact"
            id={contact.id}
            defs={contactProps}
            initialValues={contact.properties}
          />
        </div>
      </div>
    </div>
  );
}
