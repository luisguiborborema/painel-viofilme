import { FolderOpen, HelpCircle, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { FilterTabs } from "@/components/dashboard/filter-tabs";
import { getSession } from "@/lib/auth/session";
import { getBrandHub } from "@/lib/data/queries";
import {
  BrandHubHeader,
  SectionLabel,
} from "@/components/cliente/brand-hub-header";
import { AccessCard } from "@/components/cliente/access-card";
import { AssetCard } from "@/components/cliente/asset-card";
import { TeamCard } from "@/components/cliente/team-card";
import { ActivityLog } from "@/components/cliente/activity-log";

const ATIVOS_TABS = [
  { label: "Todos", value: "todos" },
  { label: "Logos", value: "logos" },
  { label: "Manual", value: "manual" },
  { label: "Fotos", value: "fotos" },
];

export default async function ClienteCentral({
  searchParams,
}: {
  searchParams: Promise<{ ativo?: string }>;
}) {
  const user = await getSession();
  if (!user?.clientId) {
    return (
      <Card className="p-10 text-center text-sm text-muted">
        Sem cliente vinculado.
      </Card>
    );
  }

  const { ativo } = await searchParams;
  const hub = await getBrandHub(user.clientId);
  const assets =
    ativo && ativo !== "todos"
      ? hub.assets.filter((a) => a.category === ativo)
      : hub.assets;

  return (
    <div className="space-y-6">
      <BrandHubHeader />

      {/* Cofre de acessos */}
      <section className="space-y-3">
        <SectionLabel>Cofre de acessos</SectionLabel>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hub.accesses.map((item) => (
            <AccessCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      {/* Ativos de marca */}
      <section className="space-y-3">
        <SectionLabel>Ativos de marca</SectionLabel>
        <Card className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm font-medium text-ink">
              <FolderOpen className="h-4 w-4 text-brand-300" />
              Drive de marca — {hub.driveName}
            </span>
            <FilterTabs param="ativo" options={ATIVOS_TABS} />
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {assets.map((asset) => (
              <AssetCard key={asset.id} asset={asset} />
            ))}
            <button className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line text-sm font-medium text-muted transition-colors hover:border-brand-400 hover:text-ink">
              <Plus className="h-5 w-5" />
              Solicitar novo ativo
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span>
              {hub.assets.length} ativos · atualizado em jun/26 pela equipe de
              design
            </span>
            <button className="inline-flex items-center gap-1 font-medium text-brand-300 hover:text-brand-200">
              <HelpCircle className="h-3.5 w-3.5" /> Como são atualizados?
            </button>
          </div>
        </Card>
      </section>

      {/* Equipe dedicada */}
      <section className="space-y-3">
        <SectionLabel>Equipe dedicada</SectionLabel>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {hub.team.map((member, i) => (
            <TeamCard key={member.id} member={member} accent={i} />
          ))}
        </div>
      </section>

      {/* Log de atividades */}
      <section className="space-y-3">
        <SectionLabel>Log de atividades</SectionLabel>
        <ActivityLog items={hub.activity} />
      </section>
    </div>
  );
}
