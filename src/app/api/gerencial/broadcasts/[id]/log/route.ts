import { type NextRequest, NextResponse } from "next/server";
// SheetJS: a dependência aponta para o tarball oficial (cdn.sheetjs.com), não
// para o npm — o pacote `xlsx` do registro parou na 0.18.5, que tem prototype
// pollution sem correção publicada lá. A 0.20.3 do CDN é a versão mantida.
import * as XLSX from "xlsx";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fmt(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR");
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "sem banco" }, { status: 400 });

  const { id } = await params;
  const type = request.nextUrl.searchParams.get("type") === "contacts" ? "contacts" : "log";
  const supabase = await createClient();

  const { data: b } = await supabase.from("broadcasts").select("title").eq("id", id).maybeSingle();
  const { data: recs } = await supabase
    .from("broadcast_recipients")
    .select("target, name, vars, status, error, sent_at")
    .eq("broadcast_id", id)
    .order("status", { ascending: true })
    .limit(50_000);
  const list = (recs ?? []) as { target: string; name?: string; vars?: Record<string, unknown>; status: string; error?: string | null; sent_at?: string | null }[];

  // Colunas extras a partir das variáveis presentes.
  const varKeys = new Set<string>();
  for (const r of list) for (const k of Object.keys(r.vars ?? {})) varKeys.add(k);
  const extraCols = [...varKeys];

  const STATUS_PT: Record<string, string> = { pending: "Na fila", sent: "Enviado", failed: "Falhou", skipped: "Pulado" };
  const header = type === "contacts"
    ? ["numero", "nome", ...extraCols]
    : ["numero", "nome", "status", "erro", "enviado_em", ...extraCols];

  const aoa: unknown[][] = [header];
  for (const r of list) {
    const base = type === "contacts"
      ? [r.target, r.name ?? ""]
      : [r.target, r.name ?? "", STATUS_PT[r.status] ?? r.status, r.error ?? "", fmt(r.sent_at)];
    aoa.push([...base, ...extraCols.map((k) => String((r.vars ?? {})[k] ?? ""))]);
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), type === "contacts" ? "Contatos" : "Log");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const safe = String(b?.title ?? "disparo").replace(/[^\w-]+/g, "_").slice(0, 40);
  const fname = `${type === "contacts" ? "contatos" : "log"}-${safe}.xlsx`;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fname}"`,
      "Cache-Control": "no-store",
    },
  });
}
