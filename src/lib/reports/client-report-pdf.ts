/**
 * Relatório mensal do cliente em PDF (resultados + entregas do mês).
 * Reaproveita o padrão do le-pdf (pdf-lib, fonte Helvetica sem acentos).
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatBRL, formatCompact } from "@/lib/utils";
import type { ReportSummary } from "@/lib/data/operacao";

const BRAND_DARK = rgb(0x1b / 255, 0x41 / 255, 0x88 / 255);
const LIME = rgb(0xe9 / 255, 0xfc / 255, 0x89 / 255);
const INK = rgb(0.08, 0.09, 0.12);
const MUTED = rgb(0.42, 0.46, 0.48);
const LINE = rgb(0.88, 0.9, 0.92);

export type ClientReportData = {
  clientName: string;
  period: string;
  organic: ReportSummary["organic"];
  paid: ReportSummary["paid"];
  deliveries: { done: number; approval: number; total: number };
  hasPaid: boolean;
};

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

export async function buildClientReportPdf(d: ClientReportData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595, H = 842, M = 50;
  const page = pdf.addPage([W, H]);

  const text = (s: string, x: number, y: number, size: number, f = font, color = INK) =>
    page.drawText(strip(s), { x, y, size, font: f, color });

  // Cabeçalho
  page.drawRectangle({ x: 0, y: H - 90, width: W, height: 90, color: BRAND_DARK });
  page.drawRectangle({ x: 0, y: H - 94, width: W, height: 4, color: LIME });
  text("VIOFILME", M, H - 38, 18, bold, rgb(1, 1, 1));
  text("Relatorio mensal de resultados", M, H - 58, 11, font, rgb(0.9, 0.98, 0.96));
  text(`${d.clientName}  -  ${d.period}`, M, H - 78, 12, bold, rgb(1, 1, 1));

  // Grade de métricas: 3 colunas.
  const colW = (W - M * 2 - 24) / 3;
  const cardH = 58;
  function metricGrid(titleText: string, items: { label: string; value: string }[], top: number): number {
    text(titleText.toUpperCase(), M, top, 11, bold, BRAND_DARK);
    let y = top - 22;
    items.forEach((it, i) => {
      const col = i % 3;
      if (col === 0 && i > 0) y -= cardH + 10;
      const x = M + col * (colW + 12);
      page.drawRectangle({
        x,
        y: y - cardH + 14,
        width: colW,
        height: cardH,
        borderColor: LINE,
        borderWidth: 1,
        color: rgb(0.98, 0.985, 0.99),
      });
      text(it.value, x + 12, y - 8, 18, bold, INK);
      text(it.label.toUpperCase(), x + 12, y - 30, 8, font, MUTED);
    });
    return y - cardH; // baseline após a última linha
  }

  const o = d.organic;
  let cursor = metricGrid(
    "Alcance & engajamento (organico)",
    [
      { label: "Seguidores", value: formatCompact(o.seguidores) },
      { label: "Alcance", value: formatCompact(o.alcance) },
      { label: "Impressoes", value: formatCompact(o.impressoes) },
      { label: "Engajamento", value: formatCompact(o.engajamento) },
      { label: "Comentarios", value: formatCompact(o.comentarios) },
      { label: "Salvamentos", value: formatCompact(o.salvamentos) },
    ],
    H - 130,
  );

  if (d.hasPaid) {
    const p = d.paid;
    cursor = metricGrid(
      "Trafego pago",
      [
        { label: "Investimento", value: formatBRL(p.investimento) },
        { label: "Leads", value: formatCompact(p.leads) },
        { label: "Custo por lead", value: formatBRL(p.cpl) },
        { label: "Conversoes", value: formatCompact(p.conversoes) },
        { label: "Cliques", value: formatCompact(p.cliques) },
        { label: "Custo por aquisicao", value: formatBRL(p.cpa) },
      ],
      cursor - 34,
    );
  }

  // Entregas do mês.
  const del = d.deliveries;
  text("ENTREGAS DO MES", M, cursor - 34, 11, bold, BRAND_DARK);
  const barY = cursor - 60;
  const barW = W - M * 2;
  const t = Math.max(del.total, del.done + del.approval, 1);
  page.drawRectangle({ x: M, y: barY, width: barW, height: 14, color: rgb(0.9, 0.92, 0.94) });
  page.drawRectangle({ x: M, y: barY, width: (del.done / t) * barW, height: 14, color: rgb(0.13, 0.7, 0.4) });
  page.drawRectangle({
    x: M + (del.done / t) * barW,
    y: barY,
    width: (del.approval / t) * barW,
    height: 14,
    color: rgb(0.96, 0.62, 0.05),
  });
  text(
    `${del.done}/${del.total} entregues${del.approval > 0 ? `  -  ${del.approval} aguardando aprovacao` : ""}`,
    M,
    barY - 18,
    10,
    font,
    MUTED,
  );

  // Rodapé
  text("Gerado pelo Painel Viofilme  -  viofilme.com.br", M, 40, 9, font, MUTED);

  return pdf.save();
}
