import { PageHeader } from "@/components/dashboard/page-header";
import { FilterTabs } from "@/components/dashboard/filter-tabs";
import { ContentGrid } from "@/components/dashboard/content-grid";
import { Card } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { getContent } from "@/lib/data/queries";
import type { PostStatus } from "@/lib/data/types";

const TABS = [
  { label: "Todos", value: "todos" },
  { label: "Publicados", value: "published" },
  { label: "Agendados", value: "scheduled" },
];

export default async function ClienteConteudo({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await getSession();
  const { status } = await searchParams;

  if (!user?.clientId) {
    return <Card className="p-10 text-center text-sm text-muted">Sem cliente vinculado.</Card>;
  }

  const filter = (status as PostStatus) || undefined;
  const posts = await getContent(
    user.clientId,
    filter === "published" || filter === "scheduled" ? filter : undefined,
  );

  return (
    <div>
      <PageHeader
        title="Conteúdo"
        subtitle="Tudo o que foi publicado e o que está agendado no seu Instagram e Facebook."
        action={<FilterTabs param="status" options={TABS} />}
      />
      <ContentGrid posts={posts} />
    </div>
  );
}
