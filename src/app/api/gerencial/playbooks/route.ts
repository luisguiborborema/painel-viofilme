import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action?:
    | "create-sector" | "rename-sector" | "delete-sector"
    | "create-playbook" | "update-playbook" | "delete-playbook";
  id?: string;
  sectorId?: string;
  name?: string;
  title?: string;
  content?: string;
  format?: "md" | "html";
};

/** CRUD de setores e playbooks (gerencial). */
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

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, persisted: false });
  }
  const supabase = await createClient();
  const now = new Date().toISOString();

  switch (b.action) {
    case "create-sector": {
      if (!b.name?.trim()) return NextResponse.json({ error: "nome ausente" }, { status: 400 });
      const { data: secs } = await supabase.from("playbook_sectors").select("position");
      const pos = (secs ?? []).reduce((m, s) => Math.max(m, Number(s.position ?? 0)), 0) + 1;
      const { data, error } = await supabase
        .from("playbook_sectors").insert({ name: b.name.trim(), position: pos }).select("id").single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, id: data.id });
    }
    case "rename-sector": {
      if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
      const { error } = await supabase.from("playbook_sectors").update({ name: b.name }).eq("id", b.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    case "delete-sector": {
      if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
      const { error } = await supabase.from("playbook_sectors").delete().eq("id", b.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    case "create-playbook": {
      if (!b.sectorId || !b.title?.trim()) {
        return NextResponse.json({ error: "setor/título ausente" }, { status: 400 });
      }
      const { data: docs } = await supabase.from("playbooks").select("position").eq("sector_id", b.sectorId);
      const pos = (docs ?? []).reduce((m, d) => Math.max(m, Number(d.position ?? 0)), 0) + 1;
      const { data, error } = await supabase
        .from("playbooks")
        .insert({
          sector_id: b.sectorId,
          title: b.title.trim(),
          content: b.content ?? "",
          format: b.format === "html" ? "html" : "md",
          position: pos,
          created_by: user.name,
        })
        .select("id")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, id: data.id });
    }
    case "update-playbook": {
      if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
      const patch: Record<string, unknown> = { updated_at: now };
      if (b.title != null) patch.title = b.title;
      if (b.content != null) patch.content = b.content;
      if (b.format != null) patch.format = b.format === "html" ? "html" : "md";
      if (b.sectorId != null) patch.sector_id = b.sectorId;
      const { error } = await supabase.from("playbooks").update(patch).eq("id", b.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    case "delete-playbook": {
      if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
      const { error } = await supabase.from("playbooks").delete().eq("id", b.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: "ação inválida" }, { status: 400 });
  }
}
