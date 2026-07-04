import type {
  Company,
  Contact,
  CrmLead,
  Pipeline,
  PropertyDef,
  Tag,
  TaskFlow,
  CaptureForm,
} from "@/lib/data/crm";
import { PropertyManager } from "./property-manager";
import { StageManager } from "./stage-manager";
import { TagManager } from "./tag-manager";
import { CrmImportExport } from "./crm-import-export";
import { FlowManager } from "./flow-manager";
import { CaptureFormsManager } from "./capture-forms-manager";
import { DuplicatesManager } from "./duplicates-manager";

/**
 * Central de personalização do CRM: estágios do pipeline, propriedades
 * customizadas e tags (com cor).
 */
export function CrmSettings({
  properties,
  pipelines,
  tags,
  leads,
  companies,
  contacts,
  flows,
  captureForms,
  team = [],
}: {
  properties: PropertyDef[];
  pipelines: Pipeline[];
  tags: Tag[];
  leads: CrmLead[];
  companies: Company[];
  contacts: Contact[];
  flows: TaskFlow[];
  captureForms: CaptureForm[];
  team?: string[];
}) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold text-ink">Pipelines & estágios</h2>
        <p className="mb-3 text-xs text-muted">
          Crie funis (ex.: Novos negócios, Upsell) e edite os estágios de cada um —
          nome, cor, probabilidade, regras e automações.
        </p>
        <StageManager
          pipelines={pipelines}
          dealProperties={properties.filter((p) => p.objectType === "deal")}
          flows={flows}
        />
      </section>

      <section>
        <h2 className="text-sm font-semibold text-ink">Tags</h2>
        <p className="mb-3 text-xs text-muted">
          Etiquetas coloridas para classificar Empresas, Contatos e Negócios. Aplique
          na ficha de cada objeto e filtre no pipeline.
        </p>
        <TagManager tags={tags} />
      </section>

      <section>
        <h2 className="text-sm font-semibold text-ink">Propriedades customizadas</h2>
        <p className="mb-3 text-xs text-muted">
          Campos extras para Empresas, Contatos e Negócios — como no HubSpot. Aparecem
          na ficha de cada objeto para preenchimento.
        </p>
        <PropertyManager properties={properties} />
      </section>

      <section>
        <h2 className="text-sm font-semibold text-ink">Fluxos de tarefas</h2>
        <p className="mb-3 text-xs text-muted">
          Playbooks: conjuntos ordenados de tarefas (com prazo relativo) que você
          aplica de uma vez a um negócio.
        </p>
        <FlowManager flows={flows} />
      </section>

      <section>
        <h2 className="text-sm font-semibold text-ink">Formulários de captura</h2>
        <p className="mb-3 text-xs text-muted">
          Links públicos que criam leads direto no CRM (site, bio do Instagram,
          campanhas). Cada envio vira empresa + contato + negócio.
        </p>
        <CaptureFormsManager forms={captureForms} team={team} />
      </section>

      <section>
        <h2 className="text-sm font-semibold text-ink">Duplicados</h2>
        <p className="mb-3 text-xs text-muted">
          Empresas/contatos repetidos (mesmo nome, telefone ou e-mail). Escolha qual
          manter e mescle — negócios e associações migram para o registro primário.
        </p>
        <DuplicatesManager companies={companies} contacts={contacts} />
      </section>

      <section>
        <h2 className="text-sm font-semibold text-ink">Importar / Exportar</h2>
        <p className="mb-3 text-xs text-muted">
          Baixe seus dados em CSV ou importe negócios em massa por planilha.
        </p>
        <CrmImportExport leads={leads} companies={companies} contacts={contacts} />
      </section>
    </div>
  );
}
