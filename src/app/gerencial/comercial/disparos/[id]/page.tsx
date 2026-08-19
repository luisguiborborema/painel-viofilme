import { notFound } from "next/navigation";
import { getBroadcast } from "@/lib/data/broadcasts-server";
import { BroadcastDetail } from "@/components/gerencial/broadcast-detail";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await getBroadcast(id);
  return { title: b?.title ? `Disparo — ${b.title}` : "Disparo" };
}

export default async function DisparoDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const broadcast = await getBroadcast(id);
  if (!broadcast) notFound();
  return (
    <div className="space-y-4">
      <BroadcastDetail broadcast={broadcast} />
    </div>
  );
}
