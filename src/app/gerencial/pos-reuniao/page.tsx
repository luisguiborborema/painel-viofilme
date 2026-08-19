import { PageHeader } from "@/components/dashboard/page-header";
import { getAllMeetingSurveysView } from "@/lib/data/queries";
import { meetingSummary } from "@/lib/data/meeting-survey";
import { MeetingOverview } from "@/components/gerencial/meeting-overview";

export default async function GerencialPosReuniao() {
  const entries = await getAllMeetingSurveysView();
  const summary = meetingSummary(entries);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Satisfação pós-reunião"
        subtitle="Avaliações das reuniões (1–5 estrelas) de toda a carteira. Foco na qualidade das reuniões, complementando o NPS."
      />
      <MeetingOverview entries={entries} summary={summary} />
    </div>
  );
}
