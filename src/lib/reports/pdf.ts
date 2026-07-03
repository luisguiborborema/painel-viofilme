/**
 * Gerador de PDF do relatório de resultados (server-only, pdf-lib).
 * Layout simples e limpo: cabeçalho da marca + métricas do período.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type ReportMetric = { label: string; value: string; variation?: string };

const TEAL = rgb(0.07, 0.47, 0.42);
const INK = rgb(0.11, 0.15, 0.16);
const MUTED = rgb(0.42, 0.46, 0.48);
const LINE = rgb(0.88, 0.9, 0.9);

export async function buildReportPdf(input: {
  clientName: string;
  period: string;
  metrics: ReportMetric[];
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  const M = 50;

  // Faixa do cabeçalho
  page.drawRectangle({ x: 0, y: height - 110, width, height: 110, color: TEAL });
  page.drawText("VIOFILME", { x: M, y: height - 52, size: 20, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Relatorio de resultados", {
    x: M, y: height - 78, size: 12, font, color: rgb(0.9, 0.98, 0.96),
  });

  // Cliente + período
  let y = height - 150;
  page.drawText(input.clientName, { x: M, y, size: 22, font: bold, color: INK });
  y -= 22;
  page.drawText(`Periodo: ${input.period}`, { x: M, y, size: 12, font, color: MUTED });
  y -= 36;

  page.drawText("Resumo do periodo", { x: M, y, size: 13, font: bold, color: INK });
  y -= 10;
  page.drawLine({ start: { x: M, y }, end: { x: width - M, y }, thickness: 1, color: LINE });
  y -= 30;

  // Métricas (uma por linha: label à esquerda, valor grande à direita)
  for (const m of input.metrics) {
    page.drawText(m.label, { x: M, y, size: 12, font, color: MUTED });
    const valueSize = 16;
    const valueWidth = bold.widthOfTextAtSize(m.value, valueSize);
    page.drawText(m.value, {
      x: width - M - valueWidth,
      y: y - 2,
      size: valueSize,
      font: bold,
      color: INK,
    });
    if (m.variation) {
      const vSize = 10;
      const vWidth = font.widthOfTextAtSize(m.variation, vSize);
      page.drawText(m.variation, {
        x: width - M - valueWidth - vWidth - 8,
        y,
        size: vSize,
        font,
        color: TEAL,
      });
    }
    y -= 22;
    page.drawLine({
      start: { x: M, y: y + 6 },
      end: { x: width - M, y: y + 6 },
      thickness: 0.5,
      color: LINE,
    });
    y -= 8;
  }

  // Rodapé
  page.drawText(
    "Gerado automaticamente pela Central de Relatorios - Viofilme.",
    { x: M, y: 50, size: 9, font, color: MUTED },
  );

  return pdf.save();
}
