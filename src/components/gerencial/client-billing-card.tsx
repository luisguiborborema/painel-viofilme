"use client";

import { useEffect, useState } from "react";
import { CreditCard, ExternalLink, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn, formatBRL } from "@/lib/utils";

type Subscription = {
  asaas_subscription_id: string;
  value: number | null;
  cycle: string | null;
  billing_type: string | null;
  status: string | null;
  next_due_date: string | null;
  description: string | null;
};
type Payment = {
  asaas_payment_id: string;
  status: string | null;
  billing_type: string | null;
  value: number | null;
  due_date: string | null;
  payment_date: string | null;
  invoice_url: string | null;
};

const CYCLE_LABEL: Record<string, string> = {
  WEEKLY: "Semanal",
  BIWEEKLY: "Quinzenal",
  MONTHLY: "Mensal",
  QUARTERLY: "Trimestral",
  SEMIANNUALLY: "Semestral",
  YEARLY: "Anual",
};
const PAY_TONE: Record<string, string> = {
  RECEIVED: "text-emerald-600",
  CONFIRMED: "text-emerald-600",
  RECEIVED_IN_CASH: "text-emerald-600",
  PENDING: "text-amber-600",
  OVERDUE: "text-rose-500",
  REFUNDED: "text-muted",
};
const PAY_LABEL: Record<string, string> = {
  RECEIVED: "Pago",
  CONFIRMED: "Pago",
  RECEIVED_IN_CASH: "Pago",
  PENDING: "Pendente",
  OVERDUE: "Atrasado",
  REFUNDED: "Estornado",
};
const fmtDate = (iso?: string | null) =>
  iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—";

const inputCls =
  "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400";

export function ClientBillingCard({ clientId }: { clientId: string }) {
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Form de ativação.
  const [value, setValue] = useState("");
  const [cycle, setCycle] = useState("MONTHLY");
  const [billingType, setBillingType] = useState("UNDEFINED");
  const [nextDueDate, setNextDueDate] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  async function load() {
    try {
      const j = await fetch(`/api/gerencial/asaas/subscription?clientId=${clientId}`, { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : null,
      );
      if (j) {
        setConfigured(Boolean(j.configured));
        setSub(j.subscription ?? null);
        setPayments((j.payments as Payment[]) ?? []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function activate() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/gerencial/asaas/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          clientId,
          value: Number(value.replace(",", ".")),
          cycle,
          billingType,
          nextDueDate,
          cpfCnpj,
          email,
          phone,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "falha");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "erro");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (busy || !sub) return;
    setBusy(true);
    setErr(null);
    try {
      await fetch("/api/gerencial/asaas/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", subscriptionId: sub.asaas_subscription_id }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  const active = sub && sub.status !== "INACTIVE" && sub.status !== "EXPIRED";

  return (
    <Card className="p-5">
      <h2 className="mb-1 inline-flex items-center gap-2 text-sm font-semibold text-ink">
        <CreditCard className="h-4 w-4 text-brand-500" /> Cobrança recorrente
      </h2>

      {loading ? (
        <div className="flex py-4"><Loader2 className="h-4 w-4 animate-spin text-muted" /></div>
      ) : !configured ? (
        <p className="rounded-lg bg-subtle px-3 py-3 text-xs text-muted">
          Integração Asaas não configurada. Defina <code>ASAAS_API_KEY</code> (e <code>ASAAS_ENV</code>) nas variáveis de ambiente para ativar cobranças.
        </p>
      ) : active && sub ? (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-600">
              Ativa
            </span>
            <span className="font-semibold text-ink">{formatBRL(Number(sub.value ?? 0))}</span>
            <span className="text-muted">{CYCLE_LABEL[sub.cycle ?? ""] ?? sub.cycle}</span>
            <span className="text-muted">próx. {fmtDate(sub.next_due_date)}</span>
            <button onClick={cancel} disabled={busy} className="ml-auto text-xs font-medium text-rose-500 hover:underline disabled:opacity-50">
              Cancelar
            </button>
          </div>
          {payments.length > 0 ? (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {payments.map((p) => (
                <li key={p.asaas_payment_id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <span className={cn("text-xs font-semibold", PAY_TONE[p.status ?? ""] ?? "text-muted")}>
                      {PAY_LABEL[p.status ?? ""] ?? p.status ?? "—"}
                    </span>
                    <span className="text-ink">{formatBRL(Number(p.value ?? 0))}</span>
                    <span className="text-[11px] text-muted">venc. {fmtDate(p.due_date)}</span>
                  </span>
                  {p.invoice_url && (
                    <a href={p.invoice_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-600 hover:underline">
                      Fatura <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted">Assinatura criada. As cobranças aparecerão aqui conforme o Asaas gerar.</p>
          )}
        </>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted">Ative a mensalidade automática deste cliente no Asaas.</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] text-muted">
              Valor (R$)
              <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder="1200,00" className={inputCls} />
            </label>
            <label className="text-[11px] text-muted">
              1ª cobrança
              <input type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} className={inputCls} />
            </label>
            <label className="text-[11px] text-muted">
              Ciclo
              <select value={cycle} onChange={(e) => setCycle(e.target.value)} className={inputCls}>
                <option value="MONTHLY">Mensal</option>
                <option value="QUARTERLY">Trimestral</option>
                <option value="YEARLY">Anual</option>
              </select>
            </label>
            <label className="text-[11px] text-muted">
              Forma
              <select value={billingType} onChange={(e) => setBillingType(e.target.value)} className={inputCls}>
                <option value="UNDEFINED">Cliente escolhe</option>
                <option value="PIX">Pix</option>
                <option value="BOLETO">Boleto</option>
                <option value="CREDIT_CARD">Cartão</option>
              </select>
            </label>
            <label className="col-span-2 text-[11px] text-muted">
              CPF/CNPJ do cliente
              <input value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} inputMode="numeric" placeholder="Só números" className={inputCls} />
            </label>
            <label className="text-[11px] text-muted">
              E-mail (opcional)
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className={inputCls} />
            </label>
            <label className="text-[11px] text-muted">
              WhatsApp (opcional)
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className={inputCls} />
            </label>
          </div>
          {err && <p className="mt-2 text-xs text-rose-500">{err}</p>}
          <button
            onClick={activate}
            disabled={busy}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />} Ativar cobrança recorrente
          </button>
        </>
      )}
    </Card>
  );
}
