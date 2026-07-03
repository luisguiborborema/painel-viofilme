/**
 * PDF simplificado (texto) da Linha Editorial — para registro (HUB09.5).
 * O "Apresentar ao cliente" (doc A) é outro artefato (visual), ainda placeholder.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { EditorialLine } from "@/lib/data/operacao";

const BRAND_DARK = rgb(0x1b / 255, 0x41 / 255, 0x88 / 255);
const LIME = rgb(0xe9 / 255, 0xfc / 255, 0x89 / 255);
const INK = rgb(0.08, 0.09, 0.12);
const MUTED = rgb(0.42, 0.46, 0.48);

export async function buildEditorialPdf(le: EditorialLine): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595, H = 842, M = 50;
  let page = pdf.addPage([W, H]);
  let y = H;

  const strip = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  function ensure(space: number) {
    if (y - space < 60) {
      page = pdf.addPage([W, H]);
      y = H - 40;
    }
  }
  function text(s: string, x: number, size: number, f = font, color = INK) {
    page.drawText(strip(s), { x, y, size, font: f, color });
  }
  function wrap(s: string, x: number, size: number, maxW: number, f = font, color = INK) {
    const words = strip(s).split(" ");
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (f.widthOfTextAtSize(test, size) > maxW) {
        text(line, x, size, f, color); y -= size + 4; ensure(size + 6);
        line = w;
      } else line = test;
    }
    if (line) { text(line, x, size, f, color); y -= size + 4; }
  }

  // Cabeçalho
  page.drawRectangle({ x: 0, y: H - 70, width: W, height: 70, color: BRAND_DARK });
  page.drawRectangle({ x: 0, y: H - 74, width: W, height: 4, color: LIME });
  y = H - 30;
  text("VIOFILME - Linha Editorial", M, 16, bold, rgb(1, 1, 1));
  y = H - 50;
  text(`${strip(le.clientName)} - ${le.month}`, M, 11, font, rgb(0.9, 0.98, 0.96));

  y = H - 100;
  // Macro
  text("Cabecalho estrategico", M, 13, bold, BRAND_DARK); y -= 20;
  const macro: [string, string][] = [
    ["Narrativa central", le.narrativaCentral],
    ["Tensao narrativa", le.tensaoNarrativa],
    ["Datas comemorativas", le.datasComemorativas],
    ["Frequencia", le.frequency],
    ["Redes", le.networks],
    ["Responsaveis", le.responsibles],
  ];
  for (const [k, v] of macro) {
    ensure(30);
    text(k, M, 9, bold, MUTED); y -= 13;
    wrap(v, M, 11, W - 2 * M);
    y -= 4;
  }
  ensure(24);
  text("Pilares: " + le.pillars.map((p) => `${strip(p.name)} (${p.posts})`).join(" · "), M, 10, font, MUTED);
  y -= 26;

  // Posts
  text("Posts", M, 13, bold, BRAND_DARK); y -= 18;
  for (const p of le.posts) {
    ensure(64);
    text(`${String(p.n).padStart(2, "0")}. ${strip(p.title)}`, M, 11, bold); y -= 15;
    text(`${p.date} (${p.weekday}) - ${p.format} - ${strip(p.pillar)} - arte: ${strip(p.artDirection)}`, M, 9, font, MUTED); y -= 13;
    wrap(p.description, M, 10, W - 2 * M, font, INK);
    y -= 8;
  }

  return pdf.save();
}
