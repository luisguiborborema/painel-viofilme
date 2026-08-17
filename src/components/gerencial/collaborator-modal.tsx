"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import type { Employee } from "@/lib/data/rh";

const inputCls =
  "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400";
const labelCls = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted";

const undash = (v?: string) => (v && v !== "—" ? v : "");

/** Modal de cadastro/edição de colaborador do RH. */
export function CollaboratorModal({
  mode,
  employee,
  onClose,
}: {
  mode: "create" | "edit";
  employee?: Employee;
  onClose: () => void;
}) {
  const router = useRouter();
  const [f, setF] = useState({
    name: employee?.name ?? "",
    role: employee?.role ?? "",
    squad: employee?.squad ?? "",
    contractType: employee?.contractType ?? "clt",
    email: employee?.email ?? "",
    phone: employee?.phone ?? "",
    admissionDate: undash(employee?.admissionDate),
    salary: employee?.salary ? String(employee.salary) : "",
    weeklyLoadPct: employee?.weeklyLoadPct != null ? String(employee.weeklyLoadPct) : "",
    hourLimit: employee?.hourLimit != null ? String(employee.hourLimit) : "8",
    vacationDue: undash(employee?.vacationDue),
    pdiActive: employee?.pdiActive ?? false,
    reviewPending: employee?.reviewPending ?? false,
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    if (!f.name.trim()) {
      toast("O nome do colaborador é obrigatório.", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/gerencial/rh/collaborators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode === "edit" ? "update" : "create",
          id: employee?.id,
          name: f.name,
          role: f.role,
          squad: f.squad,
          contractType: f.contractType,
          email: f.email,
          phone: f.phone,
          admissionDate: f.admissionDate,
          salary: Number(f.salary) || 0,
          weeklyLoadPct: Number(f.weeklyLoadPct) || 0,
          hourLimit: Number(f.hourLimit) || 8,
          vacationDue: f.vacationDue,
          pdiActive: f.pdiActive,
          reviewPending: f.reviewPending,
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        toast(j?.error ?? "Não foi possível salvar.", "error");
        return;
      }
      router.refresh();
      onClose();
    } catch {
      toast("Falha de rede ao salvar.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === "edit" ? "Editar colaborador" : "Novo colaborador"}
      description="Dados do colaborador do time."
      footer={
        <button
          onClick={save}
          disabled={busy}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Salvar
        </button>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className={labelCls}>Nome *</span>
          <input autoFocus value={f.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Função</span>
          <input value={f.role} onChange={(e) => set("role", e.target.value)} placeholder="Ex.: Designer" className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Squad / área</span>
          <input value={f.squad} onChange={(e) => set("squad", e.target.value)} placeholder="Ex.: Criação & Produção" className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Contrato</span>
          <select value={f.contractType} onChange={(e) => set("contractType", e.target.value)} className={inputCls}>
            <option value="clt">CLT</option>
            <option value="pj">PJ</option>
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Admissão</span>
          <input value={f.admissionDate} onChange={(e) => set("admissionDate", e.target.value)} placeholder="Ex.: jan/24" className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>E-mail</span>
          <input value={f.email} onChange={(e) => set("email", e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Telefone</span>
          <input value={f.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Salário / valor (R$)</span>
          <input value={f.salary} onChange={(e) => set("salary", e.target.value)} inputMode="decimal" className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Férias previstas</span>
          <input value={f.vacationDue} onChange={(e) => set("vacationDue", e.target.value)} placeholder="Ex.: jan/25" className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Carga semanal (%)</span>
          <input value={f.weeklyLoadPct} onChange={(e) => set("weeklyLoadPct", e.target.value)} inputMode="numeric" placeholder="0" className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Limite banco de horas (h)</span>
          <input value={f.hourLimit} onChange={(e) => set("hourLimit", e.target.value)} inputMode="numeric" className={inputCls} />
        </label>
        <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
          <label className="inline-flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={f.pdiActive} onChange={(e) => set("pdiActive", e.target.checked)} /> PDI ativo
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={f.reviewPending} onChange={(e) => set("reviewPending", e.target.checked)} /> Avaliação pendente
          </label>
        </div>
      </div>
    </Modal>
  );
}
