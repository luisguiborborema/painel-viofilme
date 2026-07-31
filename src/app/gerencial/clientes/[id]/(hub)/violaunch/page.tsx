import { VioLaunchPanel } from "@/components/gerencial/violaunch-panel";
import { getVioLaunchView } from "@/lib/data/queries";
import { getClientOpsCached } from "@/lib/data/client-detail";

export default async function VioLaunchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ops = await getClientOpsCached(id);
  const data = await getVioLaunchView(id, ops?.onboarding?.startDate);
  return <VioLaunchPanel clientId={id} data={data} />;
}
