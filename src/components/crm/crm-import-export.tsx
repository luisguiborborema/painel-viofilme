"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileUp, Loader2, Upload } from "lucide-react";
import {
  stageLabel,
  type Company,
  type Contact,
  type CrmLead,
} from "@/lib/data/crm";

// ── CSV utils ────────────────────────────────────────────────────────────────
function esc(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
function toCsv(headers: string[], rows: string[][]): string {
  return [headers, ...rows].map((r) => r.map((c) => esc(c ?? "")).join(",")).join("\n");
}
function download(filename: string, csv: string) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
/** Parser CSV simples com suporte a aspas, vírgulas e quebras dentro de campos. */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (!nonEmpty.length) return [];
  const headers = nonEmpty[0].map((h) => h.trim().toLowerCase());
  return nonEmpty.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = (r[i] ?? "").trim()));
    return obj;
  });
}

const IMPORT_HEADERS = [
  "empresa", "contato", "telefone", "email", "titulo",
  "valor_mensal", "plano", "origem", "responsavel", "estagio",
];

export function CrmImportExport({
  leads,
  companies,
  contacts,
}: {
  leads: CrmLead[];
  companies: Company[];
  contacts: Contact[];
}) {
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: string[] } | null>(null);

  const companyName = (id?: string) => companies.find((c) => c.id === id)?.name ?? "";
  const contactName = (id?: string) => contacts.find((c) => c.id === id)?.name ?? "";

  function exportDeals() {
    const rows = leads.map((l) => [
      companyName(l.companyId),
      contactName(l.primaryContactId) || l.contactName || "",
      l.name,
      String(l.monthlyValue || ""),
      stageLabel(l.stage),
      l.owner ?? "",
      l.source ?? "",
      l.plan ?? "",
      String(l.probability || ""),
    ]);
    download(
      "negocios.csv",
      toCsv(
        ["empresa", "contato", "titulo", "valor_mensal", "estagio", "responsavel", "origem", "plano", "probabilidade"],
        rows,
      ),
    );
  }

  function exportCompanies() {
    const rows = companies.map((c) => [c.name, c.segment ?? "", c.phone ?? "", c.email ?? "", c.city ?? "", c.owner ?? ""]);
    download("empresas.csv", toCsv(["nome", "segmento", "telefone", "email", "cidade", "responsavel"], rows));
  }

  function exportContacts() {
    const rows = contacts.map((c) => [c.name, companyName(c.companyId), c.title ?? "", c.phone ?? "", c.email ?? ""]);
    download("contatos.csv", toCsv(["nome", "empresa", "cargo", "telefone", "email"], rows));
  }

  function downloadTemplate() {
    download("modelo-importacao.csv", toCsv(IMPORT_HEADERS, [[
      "Padaria do Zé", "José Silva", "5527999990000", "jose@padaria.com",
      "Social Pro (mensal)", "1500", "Social Pro", "Indicação", "", "Prospecção",
    ]]));
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsv(await file.text());
    setResult(null);
  }

  async function runImport() {
    const rows = parseCsv(csv);
    if (!rows.length) {
      setResult({ created: 0, errors: ["Nenhuma linha encontrada. Confira o cabeçalho."] });
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/crm/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "falha");
      setResult({ created: json.created ?? 0, errors: json.errors ?? [] });
      setCsv("");
      router.refresh();
    } catch (err) {
      setResult({ created: 0, errors: [err instanceof Error ? err.message : "erro"] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Export */}
      <div>
        <p className="mb-2 text-xs font-medium text-muted">Exportar</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportDeals} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-subtle">
            <Download className="h-4 w-4" /> Negócios
          </button>
          <button onClick={exportCompanies} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-subtle">
            <Download className="h-4 w-4" /> Empresas
          </button>
          <button onClick={exportContacts} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-subtle">
            <Download className="h-4 w-4" /> Contatos
          </button>
        </div>
      </div>

      {/* Import */}
      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">Importar negócios (CSV)</p>
          <button onClick={downloadTemplate} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
            <FileUp className="h-3.5 w-3.5" /> Baixar modelo
          </button>
        </div>
        <p className="mb-2 text-xs text-muted">
          Colunas: <code className="rounded bg-subtle px-1">{IMPORT_HEADERS.join(", ")}</code>.
          Cada linha cria (ou reaproveita) a empresa, cria o contato e o negócio já vinculados.
        </p>
        <input type="file" accept=".csv,text/csv" onChange={onFile} className="mb-2 block w-full text-xs text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-subtle file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink" />
        <textarea
          value={csv}
          onChange={(e) => { setCsv(e.target.value); setResult(null); }}
          rows={5}
          placeholder="…ou cole o conteúdo CSV aqui (com a linha de cabeçalho)"
          className="w-full resize-y rounded-lg border border-line bg-canvas px-3 py-2 font-mono text-xs text-ink outline-none focus:border-brand-400"
        />
        <div className="mt-2 flex items-center justify-between">
          {result ? (
            <p className="text-xs">
              <span className="font-semibold text-emerald-600">{result.created} criados</span>
              {result.errors.length > 0 && (
                <span className="text-rose-500"> · {result.errors.length} erro(s)</span>
              )}
            </p>
          ) : <span />}
          <button
            onClick={runImport}
            disabled={busy || !csv.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Importar
          </button>
        </div>
        {result?.errors.length ? (
          <ul className="mt-2 max-h-32 space-y-0.5 overflow-y-auto text-[11px] text-rose-500">
            {result.errors.slice(0, 20).map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
