import { PageHeader } from "@/components/dashboard/page-header";
import { CrmDashboard } from "@/components/crm/crm-dashboard";
import { getCommercialDashboard, getCommercialBoard, getDailyQuote } from "@/lib/data/queries";
import { listUpcomingEvents } from "@/lib/google/calendar";
import { getSession } from "@/lib/auth/session";
import { hasFullAccess } from "@/lib/access";
import { CRM_AGENDA } from "@/lib/data/crm";

const TZ = "America/Sao_Paulo";

export default async function DashboardComercialPage() {
  const user = await getSession();
  const currentUser = user?.name ?? "";
  const [commercialDash, board, quote, events] = await Promise.all([
    getCommercialDashboard(currentUser),
    getCommercialBoard(),
    getDailyQuote(),
    listUpcomingEvents(6),
  ]);
  const canEditMural = hasFullAccess(user?.allowedSections ?? null) || (user?.commercialRole ?? "gestor") === "gestor";
  const proximaReuniao = events.length
    ? { title: events[0].summary, iso: events[0].start, meetLink: events[0].hangoutLink }
    : undefined;
  const fmtTime = (iso?: string) =>
    iso ? new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date(iso)) : "—";
  const agenda = events.length
    ? events.map((e) => ({ time: fmtTime(e.start), title: e.summary, meetLink: e.hangoutLink }))
    : CRM_AGENDA.map((a) => ({ time: a.time, title: a.title, meetLink: undefined as string | undefined }));

  return (
    <div>
      <PageHeader title="Dashboard Comercial" subtitle="Foco do dia, mural e próximos passos." />
      <CrmDashboard
        dash={commercialDash}
        agenda={agenda}
        proximaReuniao={proximaReuniao}
        board={board}
        quote={quote}
        currentUser={currentUser}
        commercialRole={user?.commercialRole ?? "gestor"}
        canEditMural={canEditMural}
      />
    </div>
  );
}
