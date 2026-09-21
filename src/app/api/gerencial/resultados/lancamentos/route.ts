import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getLancamentos } from "@/lib/data/resultados-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Os lançamentos por trás de um número da DRE (spec §8.1). */
export async function GET(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const url = new URL(req.url);
  const cat = String(url.searchParams.get("cat") ?? "").trim();
  if (!cat) return NextResponse.json({ error: "categoria ausente" }, { status: 400 });

  return NextResponse.json(await getLancamentos(cat, {
    gran: url.searchParams.get("gran") ?? undefined,
    periodo: url.searchParams.get("periodo") ?? undefined,
    mes: url.searchParams.get("mes") ?? undefined,
  }));
}
