import { PageHeader } from "@/components/dashboard/page-header";
import { CrmDocumentos } from "@/components/crm/crm-documentos";
import { getCrmLeads, getCrmCompanies, getCrmDocuments, getDocTemplates, getSalesMaterials, getAttendants } from "@/lib/data/queries";

export const metadata = { title: "Documentos" };


export default async function DocumentosComercialPage() {
  const [leads, companies, documents, templates, materials, team] = await Promise.all([
    getCrmLeads(),
    getCrmCompanies(),
    getCrmDocuments(),
    getDocTemplates(),
    getSalesMaterials(),
    getAttendants(),
  ]);
  const dealPickList = leads.map((l) => ({ id: l.id, name: l.name, owner: l.owner }));

  return (
    <div>
      <PageHeader title="Documentos" subtitle="Propostas, contratos, modelos e materiais de venda." />
      <CrmDocumentos
        documents={documents}
        templates={templates}
        materials={materials}
        deals={dealPickList}
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
        team={team.map((t) => t.name)}
      />
    </div>
  );
}
