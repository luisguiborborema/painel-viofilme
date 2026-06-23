import { PageHeader } from "@/components/dashboard/page-header";
import { FilterTabs } from "@/components/dashboard/filter-tabs";
import { ContentGrid } from "@/components/dashboard/content-grid";
import { getClients, getContent } from "@/lib/data/queries";

export default async function GerencialConteudo({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  const { cliente } = await searchParams;
  const clients = await getClients();

  const tabs = [
    { label: "Todos", value: "todos" },
    ...clients.map((c) => ({ label: c.name, value: c.id })),
  ];

  const clientId =
    cliente && cliente !== "todos" ? cliente : undefined;
  const posts = await getContent(clientId);

  return (
    <div>
      <PageHeader
        title="Conteúdo"
        subtitle="Publicações e agendamentos de todos os clientes."
        action={<FilterTabs param="cliente" options={tabs} />}
      />
      <ContentGrid posts={posts} />
    </div>
  );
}
