import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Salva a configuração do cliente (gerencial). Persiste em `clients` quando o
 * Supabase está configurado; no modo demo a UI mantém em localStorage.
 */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  let body: {
    clientId?: string;
    hasPaidTraffic?: boolean;
    clientType?: "lead_gen" | "ecommerce" | "local_business";
    activeNetworks?: ("instagram" | "facebook")[];
    asaasCustomerId?: string;
    whatsapp?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!body.clientId) {
    return NextResponse.json({ error: "clientId ausente" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, persisted: false });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({
      has_paid_traffic: body.hasPaidTraffic,
      client_type: body.clientType,
      active_networks: body.activeNetworks,
      asaas_customer_id: body.asaasCustomerId?.trim() || null,
      whatsapp: body.whatsapp?.replace(/\D/g, "") || null,
    })
    .eq("id", body.clientId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, persisted: true });
}
