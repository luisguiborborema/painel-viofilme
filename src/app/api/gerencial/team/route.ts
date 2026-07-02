import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { hasFullAccess } from "@/lib/access";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Gestão de usuários gerenciais (somente Gestor — acesso total).
 * action: "create" | "update".
 */
export async function POST(req: Request) {
  const user = await getSession();
  if (
    !user ||
    user.role !== "gerencial" ||
    !hasFullAccess(user.allowedSections)
  ) {
    return NextResponse.json({ error: "não autorizado" }, { status: 403 });
  }
  if (!isSupabaseConfigured() || !hasServiceRole()) {
    return NextResponse.json(
      { error: "Supabase/service-role necessário" },
      { status: 503 },
    );
  }

  let body: {
    action?: "create" | "update" | "reset_password" | "set_active";
    userId?: string;
    email?: string;
    name?: string;
    password?: string;
    teamRole?: string;
    allowedSections?: string[] | null;
    active?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const admin = createAdminClient();
  // Gestor = acesso total → allowed_sections null.
  const allowed =
    body.teamRole === "gestor" ? null : (body.allowedSections ?? []);

  try {
    if (body.action === "create") {
      if (!body.email || !body.password || !body.name) {
        return NextResponse.json(
          { error: "informe nome, e-mail e senha" },
          { status: 400 },
        );
      }
      const { data, error } = await admin.auth.admin.createUser({
        email: body.email.trim(),
        password: body.password,
        email_confirm: true,
        user_metadata: { role: "gerencial", full_name: body.name.trim() },
      });
      if (error || !data.user) {
        return NextResponse.json(
          { error: error?.message ?? "falha ao criar usuário" },
          { status: 400 },
        );
      }
      await admin.from("profiles").upsert(
        {
          id: data.user.id,
          full_name: body.name.trim(),
          role: "gerencial",
          client_id: null,
          team_role: body.teamRole ?? "custom",
          allowed_sections: allowed,
        },
        { onConflict: "id" },
      );
      return NextResponse.json({ ok: true, id: data.user.id });
    }

    if (body.action === "update") {
      if (!body.userId) {
        return NextResponse.json({ error: "userId ausente" }, { status: 400 });
      }
      const { error } = await admin
        .from("profiles")
        .update({
          team_role: body.teamRole ?? "custom",
          allowed_sections: allowed,
        })
        .eq("id", body.userId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    if (body.action === "reset_password") {
      if (!body.userId || !body.password || body.password.length < 6) {
        return NextResponse.json(
          { error: "senha mínima de 6 caracteres" },
          { status: 400 },
        );
      }
      const { error } = await admin.auth.admin.updateUserById(body.userId, {
        password: body.password,
      });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    if (body.action === "set_active") {
      if (!body.userId) {
        return NextResponse.json({ error: "userId ausente" }, { status: 400 });
      }
      if (body.userId === user.id && body.active === false) {
        return NextResponse.json(
          { error: "você não pode desativar a si mesmo" },
          { status: 400 },
        );
      }
      const { error } = await admin.auth.admin.updateUserById(body.userId, {
        ban_duration: body.active ? "none" : "876000h",
      });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "ação inválida" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
