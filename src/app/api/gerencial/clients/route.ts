import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CLIENT_TYPES = new Set(["lead_gen", "ecommerce", "local_business"]);
const clean = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

type Body = {
  name?: string;
  segment?: string;
  city?: string;
  clientType?: string;
  monthlyFee?: number;
  whatsapp?: string;
  hasPaidTraffic?: boolean;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  csResponsavel?: string;
};

/** Cadastro de novo cliente (gerencial) — origem dos dados do Hub. */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  let b: Body;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const name = (b.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "nome é obrigatório" }, { status: 400 });
  }
  const clientType = b.clientType && CLIENT_TYPES.has(b.clientType) ? b.clientType : "local_business";
  const fee = Number(b.monthlyFee);

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, persisted: false, id: "demo" });
  }
  const supabase = await createClient();

  // slug único: acrescenta sufixo curto se já existir.
  const base = slugify(name) || "cliente";
  let slug = base;
  const { data: existing } = await supabase
    .from("clients")
    .select("slug")
    .like("slug", `${base}%`);
  const taken = new Set((existing ?? []).map((r) => (r as { slug: string | null }).slug));
  if (taken.has(slug)) {
    let i = 2;
    while (taken.has(`${base}-${i}`)) i += 1;
    slug = `${base}-${i}`;
  }

  const { data, error } = await supabase
    .from("clients")
    .insert({
      name,
      slug,
      segment: clean(b.segment),
      status: "onboarding",
      monthly_fee: Number.isFinite(fee) && fee > 0 ? fee : null,
      client_type: clientType,
      has_paid_traffic: Boolean(b.hasPaidTraffic),
      whatsapp: b.whatsapp?.replace(/\D/g, "") || null,
      city: clean(b.city),
      cs_responsavel: clean(b.csResponsavel),
      contact_name: clean(b.contactName),
      contact_phone: clean(b.contactPhone),
      contact_email: clean(b.contactEmail),
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: true, id: data.id });
}
