import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getValidAccess } from "@/lib/google/client";
import { getDriveRoot } from "@/lib/google/drive-root";
import { driveGetName, driveListChildren, parseDriveFolderId } from "@/lib/google/drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Normaliza nome para casar cliente ↔ pasta (sem acento/pontuação/caixa). */
function norm(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

type Body = {
  action?: "get" | "set-root" | "clear-root" | "scan" | "link";
  folder?: string; // link ou id da pasta-mãe
  links?: { clientId: string; folderId: string }[];
};

export async function POST(req: Request) {
  const user = await getSession();
  if (user?.readOnly) return NextResponse.json({ error: "acesso somente leitura" }, { status: 403 });
  if (!user || user.role !== "gerencial") return NextResponse.json({ error: "não autorizado" }, { status: 401 });

  let b: Body;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "sem banco" }, { status: 400 });
  const supabase = await createClient();
  const action = b.action ?? "get";

  try {
    if (action === "get") {
      return NextResponse.json({ root: await getDriveRoot(supabase) });
    }

    if (action === "clear-root") {
      const { error } = await supabase
        .from("google_connections")
        .update({ drive_root_folder_id: null, drive_root_folder_name: null })
        .eq("scope", "agency");
      if (error) throw error;
      return NextResponse.json({ ok: true, root: await getDriveRoot(supabase) });
    }

    if (action === "set-root") {
      const id = parseDriveFolderId(b.folder);
      if (!id) return NextResponse.json({ error: "Cole o link ou o id da pasta do Drive." }, { status: 400 });
      const access = await getValidAccess();
      if (!access?.token) return NextResponse.json({ error: "Google não conectado." }, { status: 400 });
      const info = await driveGetName(access.token, id);
      if (!info) return NextResponse.json({ error: "Pasta não encontrada ou sem acesso com a conta conectada." }, { status: 400 });
      const { error } = await supabase
        .from("google_connections")
        .update({ drive_root_folder_id: id, drive_root_folder_name: info.name })
        .eq("scope", "agency");
      if (error) throw error;
      return NextResponse.json({ ok: true, root: { id, name: info.name, source: "config" } });
    }

    // Lista as pastas dentro da pasta-mãe e sugere o casamento com os clientes.
    if (action === "scan") {
      const access = await getValidAccess();
      if (!access?.token) return NextResponse.json({ error: "Google não conectado." }, { status: 400 });
      const root = await getDriveRoot(supabase);
      if (!root.id) return NextResponse.json({ error: "Defina a pasta-mãe antes de escanear." }, { status: 400 });

      const [children, { data: clientRows }] = await Promise.all([
        driveListChildren(access.token, root.id),
        supabase.from("clients").select("id, name, drive_folder_url").order("name"),
      ]);
      const folders = children.filter((c) => c.isFolder);
      const clients = (clientRows ?? []) as { id: string; name: string; drive_folder_url: string | null }[];

      // Pastas já usadas por algum cliente não entram como sugestão.
      const usados = new Set(
        clients.map((c) => parseDriveFolderId(c.drive_folder_url)).filter(Boolean) as string[],
      );

      const sugestoes = clients.map((c) => {
        const atual = parseDriveFolderId(c.drive_folder_url);
        if (atual) return { clientId: c.id, cliente: c.name, jaVinculado: true, folderId: atual, pasta: "", confianca: "" };
        const alvo = norm(c.name);
        const livres = folders.filter((f) => !usados.has(f.id));
        const exata = livres.find((f) => norm(f.name) === alvo);
        const parcial =
          exata ??
          livres.find((f) => {
            const n = norm(f.name);
            return alvo.length >= 3 && (n.includes(alvo) || alvo.includes(n));
          });
        return {
          clientId: c.id,
          cliente: c.name,
          jaVinculado: false,
          folderId: parcial?.id ?? "",
          pasta: parcial?.name ?? "",
          confianca: exata ? "exata" : parcial ? "parcial" : "",
        };
      });

      return NextResponse.json({
        root,
        pastas: folders.map((f) => ({ id: f.id, name: f.name })),
        sugestoes,
        resumo: {
          clientes: clients.length,
          jaVinculados: sugestoes.filter((s) => s.jaVinculado).length,
          sugeridos: sugestoes.filter((s) => !s.jaVinculado && s.folderId).length,
          semPasta: sugestoes.filter((s) => !s.jaVinculado && !s.folderId).length,
        },
      });
    }

    // Vincula em lote: grava drive_folder_url nos clientes escolhidos.
    if (action === "link") {
      const links = (b.links ?? []).filter((l) => l?.clientId && l?.folderId);
      if (links.length === 0) return NextResponse.json({ error: "Nada para vincular." }, { status: 400 });
      let ok = 0;
      for (const l of links) {
        const { error } = await supabase
          .from("clients")
          .update({ drive_folder_url: `https://drive.google.com/drive/folders/${l.folderId}` })
          .eq("id", l.clientId);
        if (!error) ok++;
      }
      return NextResponse.json({ ok: true, vinculados: ok, total: links.length });
    }

    return NextResponse.json({ error: "ação inválida" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    if (/drive_root_folder_id|42703/i.test(msg)) {
      return NextResponse.json({ error: "Rode a migração 0128_drive_root_folder.sql." }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
