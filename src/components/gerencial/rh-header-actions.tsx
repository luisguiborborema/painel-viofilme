"use client";

import { useState } from "react";
import { Download, Plus } from "lucide-react";
import { CollaboratorModal } from "./collaborator-modal";
import type { Employee } from "@/lib/data/rh";

/** Botões do cabeçalho do RH: exportar CSV do time + criar colaborador. */
export function RhHeaderActions({ employees }: { employees: Employee[] }) {
  const [creating, setCreating] = useState(false);

  function exportCsv() {
    const head = ["Nome", "Função", "Squad", "Contrato", "Admissão", "E-mail", "Telefone", "Salário", "Carga %", "PDI", "Aval. pendente"];
    const rows = employees.map((e) => [
      e.name, e.role, e.squad, e.contractType.toUpperCase(), e.admissionDate,
      e.email, e.phone, String(e.salary ?? ""), String(e.weeklyLoadPct ?? ""),
      e.pdiActive ? "sim" : "não", e.reviewPending ? "sim" : "não",
    ]);
    const csv = [head, ...rows]
      .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "time_viofilme.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={exportCsv}
        className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink hover:bg-subtle"
      >
        <Download className="h-4 w-4" /> Exportar
      </button>
      <button
        onClick={() => setCreating(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-600"
      >
        <Plus className="h-4 w-4" /> Novo colaborador
      </button>
      {creating && <CollaboratorModal mode="create" onClose={() => setCreating(false)} />}
    </div>
  );
}
