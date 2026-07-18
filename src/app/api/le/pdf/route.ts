import { type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getEditorialLineView } from "@/lib/data/queries";
import { buildEditorialPdf } from "@/lib/reports/le-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Exporta a Linha Editorial do cliente em PDF (texto simplificado — HUB09.5). */
export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return new Response("não autorizado", { status: 401 });
  }
  const clientId = req.nextUrl.searchParams.get("clientId") ?? "";
  const le = await getEditorialLineView(clientId);
  const bytes = await buildEditorialPdf(le);
  const name = `LE-${le.clientName.normalize("NFD").replace(/[^\w]+/g, "-").slice(0, 30)}.pdf`;

  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${name}"`,
    },
  });
}
