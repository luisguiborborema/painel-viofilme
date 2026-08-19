import { Card } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { getClientById, getContent, getVioFluxForClient } from "@/lib/data/queries";
import { REFERENCE_DATE } from "@/lib/data/mock";
import { ContentApprovalModule } from "@/components/cliente/content-approval-module";
import { VioFluxApproval } from "@/components/cliente/vioflux-approval";

export const metadata = { title: "Conteúdo" };


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
  const [posts, client, fluxPosts] = await Promise.all([
    getContent(user.clientId),
    getClientById(user.clientId),
    getVioFluxForClient(user.clientId),
  ]);

  return (
    <>
      <VioFluxApproval posts={fluxPosts} />
      <ContentApprovalModule
        posts={posts}
        periodLabel="Junho 2026"
        refIso={REFERENCE_DATE.toISOString()}
        handle={client?.instagramUsername ?? "cliente"}
        initialPostId={post}
      />
    </>
  );
}
