import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isAdminTier, tierHasFullAccess } from "@/lib/access";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Gestão de usuários gerenciais (somente Admin).
 * action: "create" | "update" | "reset_password" | "set_active" |
 *         "send_reset_email" | "create_team".
 */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial" || !isAdminTier(user.tier)) {
    return NextResponse.json({ error: "não autorizado" }, { status: 403 });
  }
  if (!isSupabaseConfigured() || !hasServiceRole()) {
    return NextResponse.json(
      { error: "Supabase/service-role necessário" },
      { status: 503 },
    );
  }

  let body: {
    action?:
      | "create"
      | "update"
      | "reset_password"
      | "set_active"
      | "send_reset_email"
      | "create_team"
      | "delete";
    mode?: "password" | "invite";
    userId?: string;
    email?: string;
    name?: string;
    password?: string;
    teamRole?: string;
    tier?: string;
    allowedSections?: string[] | null;
    whatsapp?: string;
    squadId?: string | null;
    active?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const admin = createAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const redirectTo = appUrl ? `${appUrl}/definir-senha` : undefined;
  // Perfil (tier) define o acesso. Admin/Gestor = acesso total (null).
  const tier = body.tier ?? (body.teamRole === "gestor" ? "gestor" : "colaborador");
  const allowed = tierHasFullAccess(tier) ? null : (body.allowedSections ?? []);
  // team_role legado: mantém "gestor" para acesso total, senão "custom".
  const teamRole = tierHasFullAccess(tier) ? "gestor" : "custom";
  const squadId = body.squadId ? body.squadId : null;
  const whatsappDigits =
    body.whatsapp !== undefined ? body.whatsapp.replace(/\D/g, "") || null : undefined;

  try {
    if (body.action === "create") {
      if (!body.email || !body.name) {
        return NextResponse.json(
          { error: "informe nome e e-mail" },
          { status: 400 },
        );
      }
      const invite = body.mode === "invite";
      if (!invite && (!body.password || body.password.length < 6)) {
        return NextResponse.json(
          { error: "senha mínima de 6 caracteres" },
          { status: 400 },
        );
      }
      const meta = { role: "gerencial", full_name: body.name.trim() };

      const { data, error } = invite
        ? await admin.auth.admin.inviteUserByEmail(body.email.trim(), {
            data: meta,
            redirectTo,
          })
        : await admin.auth.admin.createUser({
            email: body.email.trim(),
            password: body.password,
            email_confirm: true,
            user_metadata: meta,
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
          team_role: teamRole,
          profile_tier: tier,
          allowed_sections: allowed,
          squad_id: squadId,
          whatsapp: whatsappDigits ?? null,
        },
        { onConflict: "id" },
      );
      return NextResponse.json({ ok: true, id: data.user.id, invited: invite });
    }

    if (body.action === "update") {
      if (!body.userId) {
        return NextResponse.json({ error: "userId ausente" }, { status: 400 });
      }
      const { error } = await admin
        .from("profiles")
        .update({
          ...(body.name?.trim() ? { full_name: body.name.trim() } : {}),
          team_role: teamRole,
          profile_tier: tier,
          allowed_sections: allowed,
          squad_id: squadId,
          whatsapp: whatsappDigits,
        })
        .eq("id", body.userId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    if (body.action === "create_team") {
      const name = body.name?.trim();
      if (!name) {
        return NextResponse.json({ error: "informe o nome do time" }, { status: 400 });
      }
      const { data, error } = await admin
        .from("squads")
        .insert({ name })
        .select("id")
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, id: data.id });
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

    if (body.action === "delete") {
      if (!body.userId) {
        return NextResponse.json({ error: "userId ausente" }, { status: 400 });
      }
      if (body.userId === user.id) {
        return NextResponse.json(
          { error: "você não pode excluir a si mesmo" },
          { status: 400 },
        );
      }
      // Hard delete no Auth; a linha em profiles cai por cascade (0001).
      const { error } = await admin.auth.admin.deleteUser(body.userId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    if (body.action === "send_reset_email") {
      if (!body.email) {
        return NextResponse.json({ error: "e-mail ausente" }, { status: 400 });
      }
      const { error } = await admin.auth.resetPasswordForEmail(body.email, {
        redirectTo,
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
