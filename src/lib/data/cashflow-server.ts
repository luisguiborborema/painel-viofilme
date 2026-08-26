import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { STATUS_IGNORAR } from "./dre";

/**
 * Fluxo de caixa PROJETADO.
 *
 * Responde "vou ter dinheiro no dia 15?": parte do saldo real das contas hoje e
 * projeta semana a semana somando o que está a receber e subtraindo o que está
 * a pagar, pela data de vencimento. Só conta o que ainda NÃO foi liquidado — o
 * que já entrou/saiu está no saldo inicial.
 */
export type SemanaFluxo = {
  inicio: string;
  fim: string;
  label: string;
  entradas: number;
  saidas: number;
  resultado: number;
  saldoFinal: number;
  /** Saldo projetado ficou negativo nesta semana. */
  negativo: boolean;
  /** Recebimentos vencidos e não pagos incluídos aqui (risco de não entrar). */
  entradasVencidas: number;
};

export type Cashflow = {
  saldoHoje: number;
  semanas: SemanaFluxo[];
  /** Primeira semana em que o saldo fica negativo, se houver. */
  alertaNegativo: SemanaFluxo | null;
  totalAReceber: number;
  totalAPagar: number;
  semContas: boolean;
};

const PAGO = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "DUNNING_RECEIVED"]);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const ddmm = (s: string) => {
  const [, m, d] = s.split("-");
  return d && m ? `${d}/${m}` : s;
};

const VAZIO: Cashflow = {
  saldoHoje: 0, semanas: [], alertaNegativo: null,
  totalAReceber: 0, totalAPagar: 0, semContas: true,
};

/** Projeta `semanas` semanas à frente (padrão 12 ≈ 3 meses). */
export async function getCashflow(semanas = 12): Promise<Cashflow> {
  if (!isSupabaseConfigured()) return VAZIO;
  try {
    const supabase = await createClient();
    const n = Math.max(4, Math.min(Math.round(semanas) || 12, 26));
    const hoje = new Date();
    const hojeIso = iso(hoje);
    const fim = iso(new Date(hoje.getTime() + n * 7 * 86_400_000));

    // 1) Saldo de hoje: soma das contas (já embute recebido/pago/transferências).
    const contasRes = await supabase
      .from("financial_accounts")
      .select("id, opening_balance, active")
      .eq("active", true);
    const semContas = Boolean(contasRes.error) || (contasRes.data ?? []).length === 0;

    let saldoHoje = 0;
    if (!semContas) {
      const contas = (contasRes.data ?? []) as { id: string; opening_balance: number }[];
      const ids = contas.map((c) => String(c.id));
      saldoHoje = contas.reduce((s, c) => s + Number(c.opening_balance ?? 0), 0);

      const [recRes, pagRes, transfRes] = await Promise.all([
        supabase.from("payments").select("value, status, account_id").in("account_id", ids).limit(5000),
        supabase.from("expenses").select("amount, status, account_id").in("account_id", ids).limit(5000),
        supabase.from("account_transfers").select("amount, from_account, to_account").limit(2000),
      ]);
      for (const r of (recRes.error ? [] : (recRes.data ?? [])) as Record<string, unknown>[]) {
        if (PAGO.has(String(r.status ?? ""))) saldoHoje += Number(r.value ?? 0);
      }
      for (const r of (pagRes.error ? [] : (pagRes.data ?? [])) as Record<string, unknown>[]) {
        if (r.status === "paid") saldoHoje -= Number(r.amount ?? 0);
      }
      for (const t of (transfRes.error ? [] : (transfRes.data ?? [])) as Record<string, unknown>[]) {
        const v = Number(t.amount ?? 0);
        if (ids.includes(String(t.to_account))) saldoHoje += v;
        if (ids.includes(String(t.from_account))) saldoHoje -= v;
      }
    }

    // 2) O que ainda vai entrar/sair. Vencidos e não pagos entram na 1ª semana:
    //    são caixa esperado, mas sinalizados como risco.
    const [recRes, pagRes] = await Promise.all([
      supabase.from("payments").select("value, due_date, status").lte("due_date", fim).limit(5000),
      supabase.from("expenses").select("amount, due_date, status").lte("due_date", fim).limit(5000),
    ]);

    const aReceber = ((recRes.error ? [] : recRes.data ?? []) as Record<string, unknown>[])
      .filter((r) => !PAGO.has(String(r.status ?? "")) && !STATUS_IGNORAR.has(String(r.status ?? "")))
      .map((r) => ({ date: String(r.due_date ?? ""), value: Number(r.value ?? 0) }))
      .filter((r) => r.date);
    const aPagar = ((pagRes.error ? [] : pagRes.data ?? []) as Record<string, unknown>[])
      .filter((r) => r.status !== "paid")
      .map((r) => ({ date: String(r.due_date ?? ""), value: Number(r.amount ?? 0) }))
      .filter((r) => r.date);

    // 3) Projeção semana a semana.
    const out: SemanaFluxo[] = [];
    let saldo = saldoHoje;
    for (let i = 0; i < n; i++) {
      const ini = new Date(hoje.getTime() + i * 7 * 86_400_000);
      const f = new Date(hoje.getTime() + ((i + 1) * 7 - 1) * 86_400_000);
      const iniIso = iso(ini);
      const fimIso = iso(f);
      // Na primeira semana entra também tudo que venceu antes e não foi liquidado.
      const dentro = (d: string) => (i === 0 ? d <= fimIso : d >= iniIso && d <= fimIso);

      const entradas = aReceber.filter((r) => dentro(r.date)).reduce((s, r) => s + r.value, 0);
      const entradasVencidas = i === 0 ? aReceber.filter((r) => r.date < hojeIso).reduce((s, r) => s + r.value, 0) : 0;
      const saidas = aPagar.filter((r) => dentro(r.date)).reduce((s, r) => s + r.value, 0);
      saldo += entradas - saidas;

      out.push({
        inicio: iniIso,
        fim: fimIso,
        label: `${ddmm(iniIso)}–${ddmm(fimIso)}`,
        entradas: Math.round(entradas),
        saidas: Math.round(saidas),
        resultado: Math.round(entradas - saidas),
        saldoFinal: Math.round(saldo),
        negativo: saldo < 0,
        entradasVencidas: Math.round(entradasVencidas),
      });
    }

    return {
      saldoHoje: Math.round(saldoHoje),
      semanas: out,
      alertaNegativo: out.find((s) => s.negativo) ?? null,
      totalAReceber: Math.round(aReceber.reduce((s, r) => s + r.value, 0)),
      totalAPagar: Math.round(aPagar.reduce((s, r) => s + r.value, 0)),
      semContas,
    };
  } catch {
    return VAZIO;
  }
}
