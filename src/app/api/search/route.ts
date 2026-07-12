import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getCrmLeads, getCrmCompanies, getCrmContacts } from "@/lib/data/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Item = { type: "Negócio" | "Empresa" | "Contato"; label: string; sublabel?: string; href: string };

/** Busca global (⌘K): negócios, empresas e contatos por nome. Só gerencial. */
export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") return NextResponse.json({ results: [] });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const items: Item[] = [];

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const like = `%${q}%`;
    const [leads, companies, contacts] = await Promise.all([
      supabase.from("crm_leads").select("id,name,segment").ilike("name", like).limit(6),
      supabase.from("crm_companies").select("id,name,segment").ilike("name", like).limit(5),
      supabase.from("crm_contacts").select("id,name,title").ilike("name", like).limit(5),
    ]);
    for (const l of leads.data ?? [])
      items.push({ type: "Negócio", label: String(l.name), sublabel: l.segment ? String(l.segment) : undefined, href: `/gerencial/crm/${l.id}` });
    for (const c of companies.data ?? [])
      items.push({ type: "Empresa", label: String(c.name), sublabel: c.segment ? String(c.segment) : undefined, href: `/gerencial/crm/empresa/${c.id}` });
    for (const c of contacts.data ?? [])
      items.push({ type: "Contato", label: String(c.name), sublabel: c.title ? String(c.title) : undefined, href: `/gerencial/crm/contato/${c.id}` });
  } else {
    const ql = q.toLowerCase();
    const [leads, companies, contacts] = await Promise.all([
      getCrmLeads(),
      getCrmCompanies(),
      getCrmContacts(),
    ]);
    for (const l of leads.filter((l) => l.name.toLowerCase().includes(ql)).slice(0, 6))
      items.push({ type: "Negócio", label: l.name, sublabel: l.segment, href: `/gerencial/crm/${l.id}` });
    for (const c of companies.filter((c) => c.name.toLowerCase().includes(ql)).slice(0, 5))
      items.push({ type: "Empresa", label: c.name, sublabel: c.segment, href: `/gerencial/crm/empresa/${c.id}` });
    for (const c of contacts.filter((c) => c.name.toLowerCase().includes(ql)).slice(0, 5))
      items.push({ type: "Contato", label: c.name, sublabel: c.title, href: `/gerencial/crm/contato/${c.id}` });
  }

  return NextResponse.json({ results: items });
}
