/**
 * Gerador de PDF de PROPOSTA COMERCIAL (server-only, pdf-lib).
 * Marca Viofilme: logo vetorial + cores. Reaproveita LOGO_PATHS do relatório.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { LOGO_PATHS } from "@/lib/reports/pdf";

const BRAND = rgb(0x2a / 255, 0x63 / 255, 0xc9 / 255);
const BRAND_DARK = rgb(0x1b / 255, 0x41 / 255, 0x88 / 255);
const LIME = rgb(0xe9 / 255, 0xfc / 255, 0x89 / 255);
const WHITE = rgb(1, 1, 1);
const INK = rgb(0x14 / 255, 0x17 / 255, 0x1f / 255);
const MUTED = rgb(0x66 / 255, 0x70 / 255, 0x85 / 255);
const LINE = rgb(0xe7 / 255, 0xe9 / 255, 0xee / 255);
const SOFT = rgb(0.96, 0.97, 0.99);

/** Helvetica (WinAnsi) não tem emojis nem alguns tipográficos → normaliza. */
function s(text: string): string {
  return (text ?? "")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    .replace(/[•·]/g, "-")
    .replace(/[^\x00-\xFF]/g, "");
}

export type ProposalInput = {
  companyName: string;
  contactName?: string;
  dealTitle: string;
  monthlyValue: number;
  plan?: string;
  owner?: string;
  scopeLines: string[];
  validityDays: number;
  dateLabel: string;
};

export async function buildProposalPdf(input: ProposalInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  const M = 50;

  // Cabeçalho da marca
  const bandH = 104;
  page.drawRectangle({ x: 0, y: height - bandH, width, height: bandH, color: BRAND_DARK });
  page.drawRectangle({ x: 0, y: height - bandH - 4, width, height: 4, color: LIME });
  const logoScale = 26 / 209.62;
  for (const p of LOGO_PATHS) {
    page.drawSvgPath(p, { x: M, y: height - 40, scale: logoScale, color: WHITE, borderWidth: 0 });
  }
  page.drawText("Proposta comercial", { x: M, y: height - 80, size: 12, font, color: LIME });

  // Empresa + meta
  let y = height - bandH - 44;
  page.drawText(s(input.companyName), { x: M, y, size: 22, font: bold, color: INK });
  y -= 20;
  const metaBits = [
    input.contactName ? `A/C ${s(input.contactName)}` : "",
    input.dateLabel,
  ].filter(Boolean);
  page.drawText(metaBits.join("  ·  "), { x: M, y, size: 11, font, color: MUTED });
  y -= 34;

  // Título do negócio
  page.drawText(s(input.dealTitle), { x: M, y, size: 15, font: bold, color: BRAND_DARK });
  y -= 26;

  // Caixa de investimento
  const boxH = 66;
  page.drawRectangle({ x: M, y: y - boxH, width: width - 2 * M, height: boxH, color: SOFT, borderColor: LINE, borderWidth: 1 });
  page.drawText("Investimento mensal", { x: M + 16, y: y - 24, size: 10, font, color: MUTED });
  const valueStr = `R$ ${input.monthlyValue.toLocaleString("pt-BR")}`;
  page.drawText(valueStr, { x: M + 16, y: y - 48, size: 24, font: bold, color: BRAND });
  if (input.plan) {
    const planStr = s(input.plan);
    const w = bold.widthOfTextAtSize(planStr, 12);
    page.drawText(planStr, { x: width - M - 16 - w, y: y - 30, size: 12, font: bold, color: INK });
    page.drawText("por mes", {
      x: width - M - 16 - font.widthOfTextAtSize("por mes", 9), y: y - 46, size: 9, font, color: MUTED,
    });
  }
  y -= boxH + 34;

  // Escopo
  page.drawText("Escopo da proposta", { x: M, y, size: 13, font: bold, color: BRAND });
  y -= 6;
  page.drawLine({ start: { x: M, y }, end: { x: width - M, y }, thickness: 1.2, color: BRAND });
  y -= 22;

  const scope = input.scopeLines.map((l) => l.trim()).filter(Boolean);
  for (const item of scope.length ? scope : ["Escopo a combinar."]) {
    // marcador lime
    page.drawCircle({ x: M + 3, y: y + 3, size: 2.5, color: BRAND });
    // wrap simples
    const maxW = width - 2 * M - 18;
    const words = s(item).split(/\s+/);
    let lineStr = "";
    const flush = () => {
      page.drawText(lineStr, { x: M + 16, y, size: 11, font, color: INK });
      y -= 16;
      lineStr = "";
    };
    for (const wd of words) {
      const trial = lineStr ? `${lineStr} ${wd}` : wd;
      if (font.widthOfTextAtSize(trial, 11) > maxW) {
        flush();
        lineStr = wd;
      } else lineStr = trial;
    }
    if (lineStr) flush();
    y -= 4;
    if (y < 120) break; // não estoura a página (1 página)
  }

  // Rodapé
  const validUntil = input.validityDays > 0 ? ` · valida por ${input.validityDays} dias` : "";
  page.drawLine({ start: { x: M, y: 78 }, end: { x: width - M, y: 78 }, thickness: 1, color: LINE });
  page.drawText(s(`Proposta emitida em ${input.dateLabel}${validUntil}`), {
    x: M, y: 62, size: 9, font, color: MUTED,
  });
  if (input.owner) {
    page.drawText(s(`Responsavel: ${input.owner}`), { x: M, y: 50, size: 9, font, color: MUTED });
  }
  page.drawText("Make it happen.", {
    x: width - M - bold.widthOfTextAtSize("Make it happen.", 10), y: 55, size: 10, font: bold, color: BRAND,
  });

  return pdf.save();
}
