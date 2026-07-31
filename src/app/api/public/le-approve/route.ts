import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/audit/log";
import { trigger } from "@/lib/push/triggers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const str = (v: unknown) => (v == null ? "" : String(v).trim());
function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  return xff.split(",")[0].trim() || req.headers.get("x-real-ip") || "";
}

/** Cliente aprova / pede ajuste num post da linha editorial (link público). */
export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "corpo inválido" }, { status: 400 });
  }
  const token = str(b.token);
  const postId = str(b.postId);
  const decision = str(b.decision);
  const comment = str(b.comment);
  if (str(b.website)) return NextResponse.json({ ok: true }); // honeypot
  if (!token || !postId || (decision !== "approved" && decision !== "changes")) {
    return NextResponse.json({ error: "dados inválidos" }, { status: 400 });
  }
  if (!isSupabaseConfigured() || !hasServiceRole()) {
    return NextResponse.json({ ok: true, persisted: false });
  }

  const admin = createAdminClient();
  const { data: line } = await admin
    .from("editorial_lines")
    .select("id, client_id, month")
    .eq("public_approval_token", token)
    .maybeSingle();
  if (!line) return NextResponse.json({ error: "link inválido" }, { status: 404 });

  const { data: post } = await admin
    .from("editorial_posts")
    .select("id, title, tema")
    .eq("id", postId)
    .eq("line_id", line.id)
    .maybeSingle();
  if (!post) return NextResponse.json({ error: "post não encontrado" }, { status: 404 });

  const { error } = await admin
    .from("editorial_posts")
    .update({
      client_status: decision,
      client_feedback: decision === "changes" ? comment || null : null,
      client_reviewed_at: new Date().toISOString(),
    })
    .eq("id", postId);
  if (error) return NextResponse.json({ error: "falha ao salvar" }, { status: 500 });

  const { data: client } = await admin
    .from("clients")
    .select("name")
    .eq("id", line.client_id)
    .maybeSingle();
  const clientName = String(client?.name ?? "Cliente");
  const postTitle = String(post.title || post.tema || "Post");

  await trigger
    .editorialClientDecision({
      clientId: String(line.client_id),
      lineId: String(line.id),
      clientName,
      month: String(line.month ?? ""),
      postTitle,
      decision: decision as "approved" | "changes",
      feedback: comment || undefined,
    })
    .catch(() => {});

  await logEvent({
    userName: clientName,
    panel: "cliente",
    action: decision === "approved" ? "approve-editorial-post" : "request-changes-editorial-post",
    area: "Editorial",
    target: String(line.id),
    detail:
      `${decision === "approved" ? "Aprovou" : "Pediu ajuste em"} "${postTitle}"` +
      (comment ? `: ${comment}` : ""),
    meta: { ip: clientIp(req), postId, decision },
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
