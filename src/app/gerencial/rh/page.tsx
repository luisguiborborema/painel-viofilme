import { Download, HeartHandshake, Plus } from "lucide-react";
import {
  getAnnouncements,
  getEmployees,
  getHourBank,
  getHrAlerts,
  getPdiCycle,
  getReviewCycle,
} from "@/lib/data/rh";
import { RhCultura } from "@/components/gerencial/rh-cultura";

export default function GerencialRh() {
  const data = {
    employees: getEmployees(),
    alerts: getHrAlerts(),
    hourBank: getHourBank(),
    pdi: getPdiCycle(),
    review: getReviewCycle(),
    announcements: getAnnouncements(),
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
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
        <div className="flex flex-wrap items-center gap-2">
          <button className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink hover:bg-subtle">
            <Download className="h-4 w-4" /> Exportar
          </button>
          <button className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-600">
            <Plus className="h-4 w-4" /> Novo colaborador
          </button>
        </div>
      </div>

      <RhCultura data={data} />
    </div>
  );
}
