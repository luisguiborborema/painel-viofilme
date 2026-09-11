import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isAdminTier } from "@/lib/access";
import { nomeValido, normalizarEscopos, type Dominio } from "@/lib/data/api-keys";
import { apagarChave, criarChave, listarChaves, revogarChave } from "@/lib/data/api-keys-server";
import { logFromUser } from "@/lib/audit/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Chaves de API do painel.
 *
 * Só admin. Uma chave aqui dá acesso de leitura a TUDO pelo MCP, sem passar por
 * RLS — é o mesmo peso de criar um usuário, e por isso a mesma alçada.
 */
export async function GET() {
  const user = await getSession();
  if (!isAdminTier(user?.tier)) return NextResponse.json({ error: "não autorizado" }, { status: 403 });
  return NextResponse.json(await listarChaves());
}

export async function POST(req: Request) {
  const user = await getSession();
  if (user?.readOnly) return NextResponse.json({ error: "acesso somente leitura" }, { status: 403 });
  if (!isAdminTier(user?.tier)) {
    return NextResponse.json({ error: "Apenas admin cria ou revoga chaves de API." }, { status: 403 });
  }

  let b: { action?: "create" | "revoke" | "delete"; name?: string; id?: string; scopes?: string[] };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const autor = user!.name || user!.email || "—";
  try {
    if (b.action === "revoke" || b.action === "delete") {
      if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
      await logFromUser(user!, { action: b.action, area: "Chaves de API", target: b.id });
      if (b.action === "revoke") await revogarChave(b.id, autor);
      else await apagarChave(b.id);
      return NextResponse.json({ ok: true });
    }

    if (b.action !== undefined && b.action !== "create") {
      return NextResponse.json({ error: `ação desconhecida: ${String(b.action)}` }, { status: 400 });
    }

    const nome = nomeValido(b.name);
    if (!nome.ok) return NextResponse.json({ error: nome.erro }, { status: 400 });
    await logFromUser(user!, { action: "create", area: "Chaves de API", target: nome.nome });
    // Nenhuma área marcada seria uma chave que não lê nada — provavelmente o
    // formulário veio vazio por engano, não uma escolha.
    const escopos = normalizarEscopos(b.scopes) as Dominio[];
    if (Array.isArray(b.scopes) && b.scopes.length === 0) {
      return NextResponse.json({ error: "Escolha ao menos uma área que a chave pode ler." }, { status: 400 });
    }
    const { token, chave } = await criarChave(nome.nome, autor, escopos);
    // O token só existe nesta resposta — nem o banco o tem.
    return NextResponse.json({ ok: true, token, chave });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    const status = /migração/i.test(msg) ? 409 : /não encontrada|já revogada/i.test(msg) ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
