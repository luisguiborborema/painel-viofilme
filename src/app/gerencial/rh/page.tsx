import { HeartHandshake } from "lucide-react";
import {
  getAnnouncements,
  getHrAlerts,
  getPdiCycle,
  getReviewCycle,
} from "@/lib/data/rh";
import { getEmployeesView, getHourBankView } from "@/lib/data/queries";
import { RhCultura } from "@/components/gerencial/rh-cultura";
import { RhHeaderActions } from "@/components/gerencial/rh-header-actions";

export default async function GerencialRh() {
  const employees = await getEmployeesView();
  const data = {
    employees,
    alerts: getHrAlerts(employees),
    hourBank: await getHourBankView(),
    pdi: getPdiCycle(),
    review: getReviewCycle(),
    announcements: getAnnouncements(),
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
