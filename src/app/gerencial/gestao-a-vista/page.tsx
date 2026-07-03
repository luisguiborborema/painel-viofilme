import { PageHeader } from "@/components/dashboard/page-header";
import { GestaoVista } from "@/components/gerencial/gestao-vista";
import { getSession } from "@/lib/auth/session";
import { hasFullAccess } from "@/lib/access";
import { getGoalsForPeriod } from "@/lib/data/queries";
import {
  GAV_CLIENTS,
  buildHealth,
  buildTrafficRanking,
  buildSocialRanking,
  teamAverageSocial,
  buildSpecialty,
  buildFormatStrength,
  buildAggregate,
  lensAccess,
  periodFromIso,
  periodLabel,
} from "@/lib/data/gestao-vista";

export default async function GestaoAVista() {
  const user = await getSession();
  const isFull = hasFullAccess(user?.allowedSections);
  const access = lensAccess(user?.teamRole, isFull);
  const ownName = user?.name;

  const period = periodFromIso(new Date().toISOString());
  const goals = await getGoalsForPeriod(period);
  const clients = GAV_CLIENTS;

  const health = buildHealth(clients, goals);
  const trafficAll = buildTrafficRanking(clients, goals);
  const socialAll = buildSocialRanking(clients);
  const socialAvg = teamAverageSocial(socialAll);

  // Média do time de tráfego (para o benchmarking do colaborador).
  const defined = trafficAll.map((r) => r.metaHit).filter((m): m is number => typeof m === "number");
  const trafficAvg = {
    metaHit: defined.length ? defined.reduce((s, m) => s + m, 0) / defined.length : undefined,
    avgCpl: trafficAll.reduce((s, r) => s + r.avgCpl, 0) / (trafficAll.length || 1),
    avgCtr: trafficAll.reduce((s, r) => s + r.avgCtr, 0) / (trafficAll.length || 1),
  };

  // GAV05: colaborador só recebe a própria linha (sem dados nominais dos colegas).
  const trafficRows = access.nominal ? trafficAll : trafficAll.filter((r) => r.name === ownName);
  const socialRows = access.nominal ? socialAll : socialAll.filter((r) => r.name === ownName);

  return (
    <div>
      <PageHeader
        title="Gestão à Vista"
        subtitle="Radiografia da carteira, benchmarking do time e leitura de vocação — apenas leitura."
      />
      <GestaoVista
        lenses={access.lenses}
        nominal={access.nominal}
        ownName={ownName}
        periodLabel={periodLabel(period)}
        health={health}
        traffic={{ rows: trafficRows, average: trafficAvg }}
        social={{ rows: socialRows, average: socialAvg }}
        specialty={buildSpecialty(clients, goals)}
        formats={buildFormatStrength(clients)}
        aggregate={buildAggregate(clients)}
      />
    </div>
  );
}
