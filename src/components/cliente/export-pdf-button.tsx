"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

export function ExportPdfButton() {
  const [busy, setBusy] = useState(false);

  async function exportPdf() {
    setBusy(true);
    try {
      const main = document.querySelector("main");
      if (!main) throw new Error("sem conteúdo");
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const bg = getComputedStyle(document.body).backgroundColor || "#ffffff";
      const canvas = await html2canvas(main as HTMLElement, {
        backgroundColor: bg,
        scale: 2,
      });
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: canvas.width >= canvas.height ? "l" : "p",
        unit: "px",
        format: [canvas.width, canvas.height],
      });
      pdf.addImage(img, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save("resultados-viofilme.pdf");
    } catch {
      // Fallback robusto: impressão do navegador (gera PDF via "Salvar como PDF").
      window.print();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={exportPdf}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:bg-subtle disabled:opacity-60"
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      Exportar PDF
    </button>
  );
}
