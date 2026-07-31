import { VioDay } from "@/components/gerencial/vioday";
import { getEditorialLineView, getMediaDayView } from "@/lib/data/queries";

export default async function VioDayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [editorial, mediaDay] = await Promise.all([
    getEditorialLineView(id),
    getMediaDayView(id),
  ]);
  return <VioDay clientId={id} editorial={editorial} initial={mediaDay} />;
}
