import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  Clock,
  ListChecks,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card } from "@/components/ui/card";
import { cn, formatBRL } from "@/lib/utils";
import { getSession } from "@/lib/auth/session";
import { canAccessSection, firstAllowedHref } from "@/lib/access";
import { getCLevel, getGerFinance, getDeliveryTasks, getHubClientsOps } from "@/lib/data/queries";

export const dynamic = "force-dynamic";

// Fora do componente — evita a regra de pureza com Date.now.
function daysAgoMs(days: number): number {
  return Date.now() - days * 86_400_000;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-muted">{title}</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>
    </section>
  );
}

export default async function PainelExecutivo() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (!canAccessSection(user.allowedSections, "visao-geral")) {
    redirect(firstAllowedHref(user.allowedSections));
  }

  const [c, fin, tasks, hub] = await Promise.all([
    getCLevel(),
    getGerFinance(),
    getDeliveryTasks(),
    getHubClientsOps(),
  ]);

  // Comercial (pipeline já agregado no C-Level).
  const pipeAberto = c.pipeline.total;
  const forecast = c.pipeline.weighted;
  const conv = c.pipeline.conversionRate;
  const stageCount = c.pipeline.stages.reduce((s, st) => s + st.count, 0);

  // Entregas.
  const cutoff30 = daysAgoMs(30);
  const active = tasks.filter((t) => t.stage !== "done").length;
  const overdue = tasks.filter((t) => t.stage !== "done" && t.late).length;
  const approval = tasks.filter((t) => t.stage === "approval").length;
  const done30 = tasks.filter(
    (t) => t.stage === "done" && t.completedAt && new Date(t.completedAt).getTime() >= cutoff30,
  ).length;

  // Financeiro.
  const aReceber = fin.receivablesTotals.open;
  const vencido = fin.receiptStatus.overdue;
  const aPagar = fin.expenses.filter((e) => e.status === "pending").reduce((s, e) => s + e.amount, 0);
  const mrr = fin.revenue.mrr;
  const saldo = aReceber - aPagar;

  // Clientes.
  const ativos = hub.filter((h) => h.status === "ativo").length;
  const emRisco = hub.filter((h) => h.atRisk).length;

  // Alertas consolidados.
  const alertas: { label: string; href: string; tone: "red" | "amber" }[] = [];
  if (overdue > 0) alertas.push({ label: `${overdue} tarefa(s) atrasada(s)`, href: "/gerencial/entregas", tone: "red" });
  if (vencido > 0) alertas.push({ label: `${formatBRL(vencido)} em faturas vencidas`, href: "/gerencial/financeiro", tone: "red" });
  if (emRisco > 0) alertas.push({ label: `${emRisco} cliente(s) em risco de churn`, href: "/gerencial/clientes", tone: "amber" });
  if (approval > 0) alertas.push({ label: `${approval} entrega(s) aguardando aprovação`, href: "/gerencial/entregas", tone: "amber" });

  return (
    <div className="space-y-6">
      <PageHeader title="Painel Executivo" subtitle="O estado do negócio num relance — comercial, entregas, financeiro e alertas." />

      <Section title="Comercial">
        <StatCard label="Pipeline em aberto" value={formatBRL(pipeAberto)} icon={Briefcase} hint={`${stageCount} negócio(s)`} />
        <StatCard label="Forecast ponderado" value={formatBRL(forecast)} icon={TrendingUp} hint="por probabilidade" />
        <StatCard label="Conversão do funil" value={`${conv}%`} icon={Target} />
        <StatCard label="Clientes ativos" value={String(ativos)} icon={Users} hint={emRisco > 0 ? `${emRisco} em risco` : "carteira saudável"} />
      </Section>

      <Section title="Entregas">
        <StatCard label="Ativas" value={String(active)} icon={ListChecks} />
        <StatCard label="Atrasadas" value={String(overdue)} icon={Clock} hint={overdue > 0 ? "requer atenção" : "em dia"} />
        <StatCard label="Aguardando aprovação" value={String(approval)} icon={AlertTriangle} />
        <StatCard label="Concluídas (30d)" value={String(done30)} icon={CheckCircle2} />
      </Section>

      <Section title="Financeiro">
        <StatCard label="A receber" value={formatBRL(aReceber)} icon={Wallet} hint={vencido > 0 ? `${formatBRL(vencido)} vencido` : "em dia"} />
        <StatCard label="A pagar" value={formatBRL(aPagar)} icon={Wallet} />
        <StatCard label="Saldo previsto" value={formatBRL(saldo)} icon={TrendingUp} hint="a receber − a pagar" />
        <StatCard label="MRR" value={formatBRL(mrr)} icon={TrendingUp} />
      </Section>

      <Card className="p-5">
        <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink">
          <AlertTriangle className="h-4 w-4 text-amber-500" /> Alertas
        </h2>
        {alertas.length === 0 ? (
          <p className="text-sm text-muted">Tudo sob controle — nenhum alerta crítico agora. 🎉</p>
        ) : (
          <ul className="space-y-1.5">
            {alertas.map((a, i) => (
              <li key={i}>
                <Link
                  href={a.href}
                  className={cn(
                    "flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition-colors hover:bg-subtle",
                    a.tone === "red" ? "border-rose-500/30 bg-rose-500/5 text-rose-700" : "border-amber-500/30 bg-amber-500/5 text-amber-700",
                  )}
                >
                  <span className="inline-flex items-center gap-2">
                    <span className={cn("h-1.5 w-1.5 rounded-full", a.tone === "red" ? "bg-rose-500" : "bg-amber-500")} />
                    {a.label}
                  </span>
                  <span className="text-xs opacity-70">abrir →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
