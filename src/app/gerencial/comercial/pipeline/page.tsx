import { CrmPipeline } from "@/components/crm/crm-pipeline";
import {
  getCrmLeads,
  getCrmCompanies,
  getCrmContacts,
  getCrmTags,
  getCrmPipelines,
  getAttendants,
  getCrmLostReasons,
  crmNowIso,
} from "@/lib/data/queries";
import { toCard } from "@/lib/data/crm";
import { getSavedViews } from "@/lib/data/listas-server";
import { getSession } from "@/lib/auth/session";

export const metadata = { title: "Pipeline" };


export default async function PipelinePage() {
  const [leads, companies, contacts, tags, pipelines, team, user, lostReasons] = await Promise.all([
    getCrmLeads(),
    getCrmCompanies(),
    getCrmContacts(),
    getCrmTags(),
    getCrmPipelines(),
    getAttendants(),
    getSession(),
    getCrmLostReasons(),
  ]);
  const nowIso = crmNowIso();
  const cards = leads.map((l) => toCard(l, nowIso));
  const savedViews = (await getSavedViews(user?.id ?? "")).filter((v) => v.scope === "negocios");

  return (
    <div>
      <CrmPipeline
        cards={cards}
        pipelines={pipelines}
        tags={tags}
        companies={companies}
        contacts={contacts}
        team={team.map((t) => t.name)}
        teamMembers={team}
        currentUser={user?.name ?? ""}
        lostReasons={lostReasons.map((r) => r.label)}
        savedViews={savedViews}
      />
    </div>
  );
}
