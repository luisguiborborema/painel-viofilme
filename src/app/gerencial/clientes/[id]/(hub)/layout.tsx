import { notFound } from "next/navigation";
import { ClientHeaderCard } from "@/components/gerencial/client-header-card";
import { ClientHeaderCollapse } from "@/components/gerencial/client-header-collapse";
import { ClientNav } from "@/components/gerencial/client-nav";
import {
  getClientDetailCached,
  getClientOpsCached,
  getClientOpOnly,
  getClientPortalCached,
} from "@/lib/data/client-detail";
import { getAttendants } from "@/lib/data/queries";

// Abas de trabalho pesado onde a ficha do cliente vem recolhida por padrão
// (dá foco ao conteúdo da aba). O usuário expande a ficha quando quiser.
const COLLAPSIBLE_TABS = ["editorial", "vioday", "criativos", "documentos"];

function initialsOf(name: string): string {
  return name
    .replace(/[^A-Za-zÀ-ú ]/g, "")
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

/** Aba do navegador: "Cliente — Nome". A leitura é cacheada (não refaz query). */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getClientDetailCached(id);
  return { title: d?.client?.name ? `Cliente — ${d.client.name}` : "Cliente" };
}

export default async function ClienteLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  const d = await getClientDetailCached(id);
  if (!d) notFound();

  const [ops, portal, opOnly, attendants] = await Promise.all([
    getClientOpsCached(id),
    getClientPortalCached(id),
    getClientOpOnly(),
    getAttendants(),
  ]);
  // Mapa nome → foto dos colaboradores, para os avatares dos responsáveis.
  const avatarByName: Record<string, string> = {};
  for (const a of attendants) if (a.avatarUrl) avatarByName[a.name] = a.avatarUrl;

  const sem = ops?.semaforo;
  const status = sem
    ? sem.state === "atrasado"
      ? { label: `Atrasado · ${sem.late}`, tone: "late" as const }
      : sem.state === "aguardando"
        ? { label: `Aguardando cliente · ${sem.approval}`, tone: "waiting" as const }
        : { label: "Em dia", tone: "ok" as const }
    : undefined;

  return (
    <div className="space-y-4">
      <ClientNav
        opOnly={opOnly}
        header={
          <ClientHeaderCollapse
            name={d.client.name}
            initials={initialsOf(d.client.name)}
            statusLabel={status?.label}
            statusTone={status?.tone}
            collapsibleTabs={COLLAPSIBLE_TABS}
          >
            <ClientHeaderCard id={id} d={d} ops={ops} portal={portal} avatarByName={avatarByName} />
          </ClientHeaderCollapse>
        }
      />
      {children}
    </div>
  );
}
