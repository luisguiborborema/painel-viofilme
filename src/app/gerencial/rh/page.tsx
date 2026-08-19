import { HeartHandshake } from "lucide-react";
import { getHrAlerts } from "@/lib/data/rh";
import {
  getAnnouncementsView,
  getEmployeesView,
  getHourBankView,
  getPdisView,
  getReviewsView,
} from "@/lib/data/queries";
import { RhCultura } from "@/components/gerencial/rh-cultura";
import { RhHeaderActions } from "@/components/gerencial/rh-header-actions";

export const metadata = { title: "RH & cultura" };


export default async function GerencialRh() {
  const employees = await getEmployeesView();
  const data = {
    employees,
    alerts: getHrAlerts(employees),
    hourBank: await getHourBankView(),
    pdis: await getPdisView(),
    reviews: await getReviewsView(),
    announcements: await getAnnouncementsView(),
  };

  return (
    <div className="space-y-4">
      <div data-tour="page-header" className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 text-brand-300">
            <HeartHandshake className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">
              RH &amp; cultura
            </h1>
            <p className="text-sm text-muted">
              Time, banco de horas, PDIs, avaliações e comunicação interna.
            </p>
          </div>
        </div>
        <RhHeaderActions employees={employees} />
      </div>

      <RhCultura data={data} />
    </div>
  );
}
