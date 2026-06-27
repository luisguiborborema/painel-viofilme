import { Card } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { getClientById, getContent } from "@/lib/data/queries";
import { REFERENCE_DATE } from "@/lib/data/mock";
import { ContentApprovalModule } from "@/components/cliente/content-approval-module";

export default async function ClienteConteudo({
  searchParams,
}: {
  searchParams: Promise<{ post?: string }>;
}) {
  const user = await getSession();
  if (!user?.clientId) {
    return (
      <Card className="p-10 text-center text-sm text-muted">
        Sem cliente vinculado.
      </Card>
    );
  }

  const { post } = await searchParams;
  const posts = await getContent(user.clientId);
  const client = await getClientById(user.clientId);

  return (
    <ContentApprovalModule
      posts={posts}
      periodLabel="Junho 2026"
      refIso={REFERENCE_DATE.toISOString()}
      handle={client?.instagramUsername ?? "cliente"}
      initialPostId={post}
    />
  );
}
