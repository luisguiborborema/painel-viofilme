import { type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  getReportSummaryView,
  getCSClientDetail,
  getClientById,
  getHubClientsOps,
} from "@/lib/data/queries";
import { buildClientReportPdf } from "@/lib/reports/client-report-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function periodLabel(): string {
  const l = new Date().toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
  return l.charAt(0).toUpperCase() + l.slice(1); // "Agosto de 2026"
}

/** Relatório mensal do cliente (resultados + entregas) em PDF. */
export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return new Response("não autorizado", { status: 401 });
  const clientId = req.nextUrl.searchParams.get("clientId") ?? "";
  if (!clientId) return new Response("clientId ausente", { status: 400 });
  // Cliente só baixa o próprio relatório; gerencial baixa qualquer um.
  if (user.role === "cliente") {
    if (!user.clientId || user.clientId !== clientId) {
      return new Response("não autorizado", { status: 403 });
    }
  } else if (user.role !== "gerencial") {
    return new Response("não autorizado", { status: 401 });
  }

  const [summary, detail, portal, hubOps] = await Promise.all([
    getReportSummaryView(clientId),
    getCSClientDetail(clientId),
    getClientById(clientId),
    getHubClientsOps(),
  ]);
  if (!detail) return new Response("cliente não encontrado", { status: 404 });
  const ops = hubOps.find((x) => x.id === clientId);

  const bytes = await buildClientReportPdf({
    clientName: detail.client.name,
    period: periodLabel(),
    organic: summary.organic,
    paid: summary.paid,
    hasPaid: portal?.hasPaidTraffic ?? detail.campaignsInvested > 0,
    deliveries: {
      done: ops?.monthDone ?? 0,
      approval: ops?.monthApproval ?? 0,
      total: ops?.monthTotal ?? 0,
    },
  });

  const name = `Relatorio-${detail.client.name.normalize("NFD").replace(/[^\w]+/g, "-").slice(0, 30)}.pdf`;
  // ?download=1 força salvar o arquivo; senão abre no navegador (inline).
  const disposition = req.nextUrl.searchParams.get("download") ? "attachment" : "inline";
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${name}"`,
    },
  });
}
