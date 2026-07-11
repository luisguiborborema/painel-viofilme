import type {
  CardFieldSetting,
  Company,
  Contact,
  CrmLead,
  Pipeline,
  PropertyDef,
  Tag,
  TaskFlow,
  CaptureForm,
} from "@/lib/data/crm";
import { CardLayoutManager } from "./card-layout-manager";
import { PropertyManager } from "./property-manager";
import { StageManager } from "./stage-manager";
import { TagManager } from "./tag-manager";
import { CrmImportExport } from "./crm-import-export";
import { FlowManager } from "./flow-manager";
import { CaptureFormsManager } from "./capture-forms-manager";
import { DuplicatesManager } from "./duplicates-manager";
import { CrmSettingsNav, type SettingsSection } from "./crm-settings-nav";

/**
 * Central de personalização do CRM, organizada em categorias (nav lateral):
 * personalização do card, funil, aquisição e dados.
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
  cardLayout = [],
  canEditCardLayout = false,
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
  cardLayout?: CardFieldSetting[];
  canEditCardLayout?: boolean;
}) {
  const sections: SettingsSection[] = [
    {
      key: "layout",
      label: "Layout do card",
      description:
        "Escolha quais itens aparecem no card/modal do negócio e em que ordem — arraste para reordenar e use o interruptor para mostrar/ocultar.",
      node: <CardLayoutManager initial={cardLayout} canEdit={canEditCardLayout} />,
    },
    {
      key: "properties",
      label: "Propriedades customizadas",
      description:
        "Campos extras para Empresas, Contatos e Negócios — como no HubSpot. Aparecem na ficha de cada objeto (e no bloco “Campos” do card).",
      node: <PropertyManager properties={properties} />,
    },
    {
      key: "tags",
      label: "Tags",
      description:
        "Etiquetas coloridas para classificar Empresas, Contatos e Negócios. Aplique na ficha de cada objeto e filtre no pipeline.",
      node: <TagManager tags={tags} />,
    },
    {
      key: "pipelines",
      label: "Pipelines & estágios",
      description:
        "Crie funis (ex.: Novos negócios, Upsell) e edite os estágios de cada um — nome, cor, probabilidade, regras e automações.",
      node: (
        <StageManager
          pipelines={pipelines}
          dealProperties={properties.filter((p) => p.objectType === "deal")}
          flows={flows}
        />
      ),
    },
    {
      key: "flows",
      label: "Fluxos de tarefas",
      description:
        "Playbooks: conjuntos ordenados de tarefas (com prazo relativo) que você aplica de uma vez a um negócio.",
      node: <FlowManager flows={flows} />,
    },
    {
      key: "forms",
      label: "Formulários de captura",
      description:
        "Links públicos que criam leads direto no CRM (site, bio do Instagram, campanhas). Cada envio vira empresa + contato + negócio.",
      node: <CaptureFormsManager forms={captureForms} team={team} />,
    },
    {
      key: "duplicates",
      label: "Duplicados",
      description:
        "Empresas/contatos repetidos (mesmo nome, telefone ou e-mail). Escolha qual manter e mescle — negócios e associações migram para o primário.",
      node: <DuplicatesManager companies={companies} contacts={contacts} />,
    },
    {
      key: "import",
      label: "Importar / Exportar",
      description: "Baixe seus dados em CSV ou importe negócios em massa por planilha.",
      node: <CrmImportExport leads={leads} companies={companies} contacts={contacts} />,
    },
  ];

  return <CrmSettingsNav sections={sections} />;
}
