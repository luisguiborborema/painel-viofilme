import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { completarSerieAberta, type Recurrence } from "@/lib/data/expense-series";
import { withApiLog } from "@/lib/audit/api-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Linha = {
  series_id: string;
  description: string;
  category: string;
  amount: number;
  vendor: string | null;
  recurrence: string;
  due_date: string;
};

/**
 * Mantém as séries SEM FIM de contas a pagar com ~12 meses de parcelas à
 * frente. Roda no despachante diário; protegida por CRON_SECRET.
 *
 * Séries com número fixo de parcelas não são tocadas.
 */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  if (!isSupabaseConfigured() || !hasServiceRole()) {
    return NextResponse.json({ ok: true, persisted: false, motivo: "sem service role" });
  }

  const admin = createAdminClient();
  const hoje = new Date().toISOString().slice(0, 10);

  const { data, error } = await admin
    .from("expenses")
    .select("series_id, description, category, amount, vendor, recurrence, due_date")
    .eq("open_ended", true)
    .not("series_id", "is", null)
    .order("due_date", { ascending: false })
    .limit(5000);
  if (error) {
    if (/open_ended|series_id|42703/i.test(error.message)) {
      return NextResponse.json({ ok: true, motivo: "migração 0130 pendente" });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Último vencimento de cada série (a query já vem ordenada desc).
  const ultimaPorSerie = new Map<string, Linha>();
  for (const l of (data ?? []) as Linha[]) {
    if (!ultimaPorSerie.has(l.series_id)) ultimaPorSerie.set(l.series_id, l);
  }

  let criadas = 0;
  const series: { serie: string; novas: number }[] = [];
  for (const [serieId, ref] of ultimaPorSerie) {
    const datas = completarSerieAberta(ref.due_date, (ref.recurrence || "monthly") as Recurrence, hoje);
    if (datas.length === 0) continue;
    const linhas = datas.map((d) => ({
      description: ref.description,
      category: ref.category,
      amount: ref.amount,
      vendor: ref.vendor,
      due_date: d,
      paid_date: null,
      status: "pending",
      recurring: true,
      series_id: serieId,
      recurrence: ref.recurrence,
      open_ended: true,
    }));
    const { error: e2 } = await admin.from("expenses").insert(linhas);
    if (!e2) {
      criadas += linhas.length;
      series.push({ serie: serieId, novas: linhas.length });
    }
  }

  return NextResponse.json({ ok: true, seriesAbertas: ultimaPorSerie.size, parcelasCriadas: criadas, series });
}

export const GET = withApiLog("cron:expenses", handle);
export const POST = withApiLog("cron:expenses", handle);
