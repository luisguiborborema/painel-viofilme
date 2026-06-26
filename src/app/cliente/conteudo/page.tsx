import { Card } from "@/components/ui/card";
import { FilterTabs } from "@/components/dashboard/filter-tabs";
import { getSession } from "@/lib/auth/session";
import { getContent } from "@/lib/data/queries";
import { REFERENCE_DATE } from "@/lib/data/mock";
import { publicationLabel } from "@/lib/datetime";
import type { ContentPost, MediaType } from "@/lib/data/types";
import { ContentApprovalHeader } from "@/components/cliente/content-approval-header";
import { StatusTabs } from "@/components/cliente/status-tabs";
import {
  ApprovalCard,
  type ApprovalCardData,
  type Bucket,
} from "@/components/cliente/approval-card";

const REDE_TABS = [
  { label: "Todas as redes", value: "todas" },
  { label: "Instagram", value: "instagram" },
  { label: "Facebook", value: "facebook" },
  { label: "Stories / Reels", value: "stories-reels" },
];

function bucketOf(p: ContentPost): Bucket | null {
  if (p.status === "published") return "publicados";
  if (p.status === "scheduled") {
    if (p.approval === "pending") return "para-aprovar";
    if (p.approval === "changes_requested") return "em-ajuste";
    return "agendados";
  }
  return null;
}

function formatLabel(m: MediaType): "Feed" | "Reels" | "Stories" {
  if (m === "reel" || m === "video") return "Reels";
  if (m === "story") return "Stories";
  return "Feed";
}

function waitingLabel(h: number): string {
  if (h >= 24) {
    const d = Math.round(h / 24);
    return `${d} ${d === 1 ? "dia" : "dias"}`;
  }
  return `${h}h`;
}

export default async function ClienteConteudo({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; rede?: string }>;
}) {
  const user = await getSession();
  if (!user?.clientId) {
    return (
      <Card className="p-10 text-center text-sm text-muted">
        Sem cliente vinculado.
      </Card>
    );
  }

  const { tab, rede } = await searchParams;
  const activeTab = (tab as Bucket) || "para-aprovar";
  const all = await getContent(user.clientId);

  const counts = { "para-aprovar": 0, "em-ajuste": 0, agendados: 0, publicados: 0 };
  for (const p of all) {
    const b = bucketOf(p);
    if (b) counts[b] += 1;
  }
  const total = all.length;

  let list = all.filter((p) => bucketOf(p) === activeTab);
  if (rede === "instagram") list = list.filter((p) => p.platform === "instagram");
  else if (rede === "facebook") list = list.filter((p) => p.platform === "facebook");
  else if (rede === "stories-reels")
    list = list.filter((p) => ["reel", "story", "video"].includes(p.mediaType));

  const refIso = REFERENCE_DATE.toISOString();
  const cards: ApprovalCardData[] = list.map((p) => ({
    id: p.id,
    formatLabel: formatLabel(p.mediaType),
    platform: p.platform,
    mediaType: p.mediaType,
    publicationLabel: publicationLabel(
      p.scheduledAt ?? p.publishedAt ?? refIso,
      refIso,
    ),
    caption: p.caption,
    author: p.author,
    waitingLabel: p.waitingHours != null ? waitingLabel(p.waitingHours) : null,
    bucket: activeTab,
  }));

  const tabs = [
    { label: "Para aprovar", value: "para-aprovar", count: counts["para-aprovar"] },
    { label: "Em ajuste", value: "em-ajuste", count: counts["em-ajuste"] },
    { label: "Agendados", value: "agendados", count: counts.agendados },
    { label: "Publicados", value: "publicados", count: counts.publicados },
  ];

  return (
    <div className="space-y-4">
      <ContentApprovalHeader periodLabel="Junho 2026" totalPosts={total} />

      <StatusTabs param="tab" tabs={tabs} />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">Filtrar:</span>
        <FilterTabs param="rede" options={REDE_TABS} />
      </div>

      {cards.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted">
          Nenhum conteúdo nesta aba.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <ApprovalCard key={c.id} post={c} />
          ))}
        </div>
      )}
    </div>
  );
}
