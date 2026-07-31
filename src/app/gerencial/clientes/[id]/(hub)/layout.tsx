import { notFound } from "next/navigation";
import { ClientHeaderCard } from "@/components/gerencial/client-header-card";
import { ClientNav, type ClientNavItem } from "@/components/gerencial/client-nav";
import {
  getClientDetailCached,
  getClientOpsCached,
  getClientPortalCached,
  getClientTasksCached,
  getClientOpOnly,
} from "@/lib/data/client-detail";

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

  const [ops, portal, tasks, opOnly] = await Promise.all([
    getClientOpsCached(id),
    getClientPortalCached(id),
    getClientTasksCached(d.client.name),
    getClientOpOnly(),
  ]);
  const openTaskCount = tasks.filter((t) => t.stage !== "done").length;

  const items: ClientNavItem[] = [
    { key: "resumo", label: "Resumo" },
    ...(opOnly ? [] : [{ key: "metas", label: "Metas" } as ClientNavItem]),
    {
      key: "tarefas",
      label: "Tarefas",
      badge: openTaskCount > 0 ? openTaskCount : undefined,
    },
    { key: "editorial", label: "Linha editorial" },
    { key: "criativos", label: "Criativos de performance" },
    { key: "violaunch", label: "VioLaunch" },
    { key: "vioday", label: "VioDay" },
    { key: "agenda", label: "Agenda" },
    { key: "documentos", label: "Documentos" },
  ];

  return (
    <div className="space-y-4">
      <ClientNav
        clientId={id}
        items={items}
        header={<ClientHeaderCard id={id} d={d} ops={ops} portal={portal} />}
      />
      {children}
    </div>
  );
}
