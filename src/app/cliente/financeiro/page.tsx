import { CreditCard, FileText, Receipt } from "lucide-react";
import { Card } from "@/components/ui/card";
import { FilterTabs } from "@/components/dashboard/filter-tabs";
import { getSession } from "@/lib/auth/session";
import { getFinance } from "@/lib/data/queries";
import { REFERENCE_DATE } from "@/lib/data/mock";
import { fullDate } from "@/lib/datetime";
import { formatBRL } from "@/lib/utils";
import { FinanceHeader } from "@/components/cliente/finance-header";
import { FinanceStatusCard } from "@/components/cliente/finance-status-cards";
import { InvoicesTable } from "@/components/cliente/invoices-table";
import { DocumentsCard } from "@/components/cliente/documents-card";
import { PaymentTimeline } from "@/components/cliente/payment-timeline";

const FATURA_TABS = [
  { label: "Todas", value: "todas" },
  { label: "Em aberto", value: "aberto" },
  { label: "Pagas", value: "pagas" },
];

export default async function ClienteFinanceiro({
  searchParams,
}: {
  searchParams: Promise<{ fatura?: string }>;
}) {
  const user = await getSession();
  if (!user?.clientId) {
    return (
      <Card className="p-10 text-center text-sm text-muted">
        Sem cliente vinculado.
      </Card>
    );
  }

  const { fatura } = await searchParams;
  const fin = await getFinance(user.clientId);
  const refIso = REFERENCE_DATE.toISOString().slice(0, 10);

  const invoices =
    fatura === "aberto"
      ? fin.invoices.filter((i) => i.status === "open")
      : fatura === "pagas"
        ? fin.invoices.filter((i) => i.status === "paid")
        : fin.invoices;

  return (
    <div className="space-y-4">
      <FinanceHeader />

      {/* Status imediato */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {fin.nextDue && (
          <FinanceStatusCard
            accent="gold"
            label="Próximo vencimento"
            value={formatBRL(fin.nextDue.amount)}
            sub={`Vence em ${fin.nextDue.daysUntil} dias · ${fullDate(fin.nextDue.dueDate)}`}
            actionLabel="Pagar agora"
            actionIcon={CreditCard}
          />
        )}
        {fin.lastPayment && (
          <FinanceStatusCard
            accent="green"
            label="Último pagamento"
            value={formatBRL(fin.lastPayment.amount)}
            sub={`Pago em ${fullDate(fin.lastPayment.paidDate)} via ${fin.lastPayment.method}`}
            actionLabel="Ver comprovante"
            actionIcon={Receipt}
          />
        )}
        <FinanceStatusCard
          accent="neutral"
          label="Plano contratado"
          value={fin.plan.name}
          sub={`Contrato ativo desde ${fullDate(fin.plan.activeSince)}`}
          actionLabel="Ver contrato"
          actionIcon={FileText}
        />
      </div>

      {/* Histórico de faturas */}
      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">Histórico de faturas</h2>
          <FilterTabs param="fatura" options={FATURA_TABS} />
        </div>
        <InvoicesTable
          invoices={invoices}
          totalPaid={fin.totalPaidYear}
          year={fin.year}
          refIso={refIso}
        />
      </Card>

      {/* Documentos + linha do tempo */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DocumentsCard documents={fin.documents} />
        </div>
        <PaymentTimeline
          invoices={fin.invoices}
          year={fin.year}
          refIso={refIso}
        />
      </div>
    </div>
  );
}
