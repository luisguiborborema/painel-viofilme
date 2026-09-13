import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { normalizarCadencia, textoDaProposta, totaisDoPacote, valorDeCapa, fmtBRL, type ItemPacote } from "@/lib/data/catalogo";
import { normalizarModo } from "@/lib/data/zapsign";
import { enviarParaAssinatura, zapsignConfigurado } from "@/lib/data/zapsign-server";
import { buildProposalPdf } from "@/lib/crm/proposal-pdf";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const clean = (v?: unknown, max = 200) => {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
};
const dinheiro = (v: unknown) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  // A coluna é numeric(12,2): acima disto o banco devolve overflow cru.
  return Math.min(Math.round(n * 100) / 100, 9_999_999.99);
};
const STATUS = new Set(["rascunho", "enviado", "fechado"]);

/** Erro do Supabase não é `Error`; sem isto a mensagem vira um "erro" inútil. */
const mensagem = (e: unknown) =>
  e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e ?? "");

/**
 * Falta a migração 0144 — vale a pena dizer isso em vez de devolver 500 cru.
 * `PGRST204` é o cache de schema do PostgREST; `42703`/`42P01` vêm do Postgres.
 */
const semMigracao = (e: unknown) => {
  const c = (e as { code?: string })?.code;
  const m = mensagem(e);
  return c === "42703" || c === "42P01" || c === "PGRST204" || /does not exist|schema cache|could not find/i.test(m);
};
const erroDeMigracao = () =>
  NextResponse.json({ error: "Rode a migração 0144_catalogo_rico.sql para usar os pacotes." }, { status: 409 });

type LinhaItem = Record<string, unknown>;

type ItemComPlano = ItemPacote & { servicePlanId: string | null };

function itensDoCorpo(v: unknown): ItemComPlano[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => {
      const o = (x ?? {}) as Record<string, unknown>;
      return {
        label: clean(o.label, 160) ?? "",
        qty: Math.max(1, Math.min(9999, Math.round(Number(o.qty) || 1))),
        price: dinheiro(o.price),
        cost: dinheiro(o.cost),
        cadence: normalizarCadencia(o.cadence),
        servicePlanId: typeof o.servicePlanId === "string" ? o.servicePlanId : null,
      };
    })
    .filter((x) => x.label)
    .slice(0, 60);
}

async function carregarPacotes(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: pacotes, error } = await supabase
    .from("packages")
    .select("id, name, client_hint, deal_id, notes, status, discount, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;

  const ids = (pacotes ?? []).map((p) => String(p.id));
  const [itensRes, docsRes] = await Promise.all([
    ids.length
      ? supabase
          .from("package_items")
          .select("id, package_id, service_plan_id, label, qty, price, cost, cadence, position")
          .in("package_id", ids)
          .order("position")
      : Promise.resolve({ data: [] as LinhaItem[], error: null }),
    ids.length
      ? supabase
          .from("crm_documents")
          .select("id, package_id, public_token, status, viewed_at, signed_at, provider, sign_url, signed_file_url")
          .in("package_id", ids)
      : Promise.resolve({ data: [] as LinhaItem[], error: null }),
  ]);
  if (itensRes.error) throw itensRes.error;

  const porPacote = new Map<string, ItemPacote[]>();
  for (const i of (itensRes.data ?? []) as LinhaItem[]) {
    const pid = String(i.package_id);
    const arr = porPacote.get(pid) ?? [];
    arr.push({
      label: String(i.label ?? ""),
      qty: Number(i.qty ?? 1),
      price: Number(i.price ?? 0),
      cost: Number(i.cost ?? 0),
      cadence: normalizarCadencia(i.cadence),
    });
    porPacote.set(pid, arr);
  }
  // O documento é best-effort: sem a coluna package_id, o pacote aparece sem link.
  const docPorPacote = new Map<string, LinhaItem>();
  for (const d of ((docsRes as { data?: LinhaItem[] }).data ?? []) as LinhaItem[]) {
    if (d.package_id) docPorPacote.set(String(d.package_id), d);
  }

  return (pacotes ?? []).map((p) => {
    const itens = porPacote.get(String(p.id)) ?? [];
    const doc = docPorPacote.get(String(p.id));
    return {
      id: String(p.id),
      name: String(p.name ?? ""),
      clientHint: p.client_hint ? String(p.client_hint) : null,
      dealId: p.deal_id ? String(p.deal_id) : null,
      notes: p.notes ? String(p.notes) : null,
      status: String(p.status ?? "rascunho"),
      discount: Number(p.discount ?? 0),
      itens,
      totais: totaisDoPacote(itens, Number(p.discount ?? 0)),
      proposta: doc
        ? {
            id: String(doc.id),
            token: String(doc.public_token ?? ""),
            status: String(doc.status ?? "draft"),
            viewedAt: doc.viewed_at ? String(doc.viewed_at) : null,
            signedAt: doc.signed_at ? String(doc.signed_at) : null,
            provider: doc.provider === "zapsign" ? "zapsign" : "interno",
            signUrl: doc.sign_url ? String(doc.sign_url) : null,
            signedFileUrl: doc.signed_file_url ? String(doc.signed_file_url) : null,
          }
        : null,
    };
  });
}

export async function GET() {
  const user = await getSession();
  if (!user || user.role !== "gerencial") return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  if (!isSupabaseConfigured()) return NextResponse.json({ pacotes: [], metaMargin: 42 });
  const supabase = await createClient();

  const cfg = await supabase.from("finance_settings").select("meta_margin").eq("id", 1).maybeSingle();
  const metaMargin = Number(cfg.data?.meta_margin ?? 42);

  try {
    return NextResponse.json({ pacotes: await carregarPacotes(supabase), metaMargin });
  } catch (e) {
    if (semMigracao(e)) return NextResponse.json({ pacotes: [], metaMargin, pendente: "0144" });
    return NextResponse.json({ error: mensagem(e) || "erro" }, { status: 500 });
  }
}

type Body = {
  action?: string;
  id?: string;
  name?: string;
  clientHint?: string;
  dealId?: string | null;
  notes?: string;
  status?: string;
  discount?: number;
  itens?: unknown;
  signerName?: string;
  signerEmail?: string;
  signerPhone?: string;
  authMode?: string;
};

/** Só estas ações escrevem. Sem a lista, um `action` errado cairia num update. */
const ACOES = new Set(["criar", "atualizar", "excluir", "gerar-proposta", "enviar-assinatura"]);

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
  if (!b.action || !ACOES.has(b.action)) {
    return NextResponse.json({ error: `ação desconhecida: ${b.action ?? "(vazia)"}` }, { status: 400 });
  }
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });
  const supabase = await createClient();

  try {
    switch (b.action) {
      case "criar": {
        const nome = clean(b.name, 160);
        if (!nome) return NextResponse.json({ error: "Dê um nome ao pacote." }, { status: 400 });
        const { data, error } = await supabase
          .from("packages")
          .insert({
            name: nome,
            client_hint: clean(b.clientHint, 160),
            deal_id: b.dealId || null,
            notes: clean(b.notes, 2000),
            discount: Math.min(100, Math.max(0, Number(b.discount) || 0)),
            status: "rascunho",
          })
          .select("id")
          .single();
        if (error) throw error;
        const id = String(data.id);
        await salvarItens(supabase, id, itensDoCorpo(b.itens));
        return NextResponse.json({ ok: true, id });
      }

      case "atualizar": {
        if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
        const patch: Record<string, unknown> = {};
        if (b.name !== undefined) {
          const nome = clean(b.name, 160);
          if (!nome) return NextResponse.json({ error: "Dê um nome ao pacote." }, { status: 400 });
          patch.name = nome;
        }
        if (b.clientHint !== undefined) patch.client_hint = clean(b.clientHint, 160);
        if (b.dealId !== undefined) patch.deal_id = b.dealId || null;
        if (b.notes !== undefined) patch.notes = clean(b.notes, 2000);
        if (b.discount !== undefined) patch.discount = Math.min(100, Math.max(0, Number(b.discount) || 0));
        if (b.status !== undefined && STATUS.has(String(b.status))) patch.status = b.status;
        if (Object.keys(patch).length) {
          const { error } = await supabase.from("packages").update(patch).eq("id", b.id);
          if (error) throw error;
        }
        // Itens só são substituídos quando vêm no corpo: um patch de status não
        // pode apagar o pacote inteiro por omissão.
        if (b.itens !== undefined) await salvarItens(supabase, b.id, itensDoCorpo(b.itens));
        return NextResponse.json({ ok: true });
      }

      case "excluir": {
        if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });

        // Excluir o pacote sem mexer na proposta deixaria o link público vivo,
        // mostrando ao cliente um preço que não existe mais. Expira em vez de
        // apagar: o CRM precisa da memória de que a proposta foi enviada.
        // Assinada fica intacta — é registro de negócio fechado, não rascunho.
        await supabase
          .from("crm_documents")
          .update({ status: "expired", expires_at: new Date().toISOString() })
          .eq("package_id", b.id)
          .is("signed_at", null)
          .then(
            () => {},
            () => {},
          );

        const { error } = await supabase.from("packages").delete().eq("id", b.id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }

      case "gerar-proposta": {
        if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
        const { data: p, error } = await supabase
          .from("packages")
          .select("id, name, client_hint, deal_id, notes, discount")
          .eq("id", b.id)
          .maybeSingle();
        if (error) throw error;
        if (!p) return NextResponse.json({ error: "pacote não encontrado" }, { status: 404 });

        const { data: itensRaw } = await supabase
          .from("package_items")
          .select("label, qty, price, cost, cadence, position")
          .eq("package_id", b.id)
          .order("position");
        const itens: ItemPacote[] = (itensRaw ?? []).map((i) => ({
          label: String(i.label ?? ""),
          qty: Number(i.qty ?? 1),
          price: Number(i.price ?? 0),
          cost: Number(i.cost ?? 0),
          cadence: normalizarCadencia(i.cadence),
        }));
        if (!itens.length) {
          return NextResponse.json({ error: "Adicione ao menos um item antes de gerar a proposta." }, { status: 400 });
        }

        const desconto = Number(p.discount ?? 0);
        const totais = totaisDoPacote(itens, desconto);
        const conteudo = textoDaProposta(
          { name: String(p.name), clientHint: p.client_hint as string | null, notes: p.notes as string | null },
          itens,
          desconto,
        );

        // Uma proposta por pacote: regerar atualiza a existente, senão o mesmo
        // pacote acumularia links públicos vivos, cada um com um preço diferente.
        const { data: existente } = await supabase
          .from("crm_documents")
          .select("id, public_token")
          .eq("package_id", b.id)
          .maybeSingle();

        const linha = {
          title: `Proposta — ${p.name}`,
          kind: "proposta",
          content: conteudo,
          value: valorDeCapa(totais),
          deal_id: p.deal_id ?? null,
          package_id: p.id,
          owner: user.name,
          status: "sent",
          sent_at: new Date().toISOString(),
          created_by: user.id,
        };

        let token: string;
        if (existente) {
          const { error: e2 } = await supabase.from("crm_documents").update(linha).eq("id", existente.id);
          if (e2) throw e2;
          token = String(existente.public_token);
        } else {
          const { data: novo, error: e3 } = await supabase
            .from("crm_documents")
            .insert(linha)
            .select("id, public_token")
            .single();
          if (e3) throw e3;
          token = String(novo.public_token);
        }

        await supabase.from("packages").update({ status: "enviado" }).eq("id", b.id);

        // `caminho` é o que a tela usa: o link absoluto sai do próprio navegador,
        // que sempre sabe o domínio certo. `url` fica para quem chama a API de
        // fora e depende do env estar configurado.
        const base = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");
        const caminho = `/proposta/${token}`;
        return NextResponse.json({ ok: true, token, caminho, url: base ? `${base}${caminho}` : caminho });
      }

      case "enviar-assinatura": {
        if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
        if (!zapsignConfigurado()) {
          return NextResponse.json(
            { error: "ZapSign não configurada. Falta a variável ZAPSIGN_TOKEN." },
            { status: 503 },
          );
        }
        if (!hasServiceRole()) {
          return NextResponse.json({ error: "serviço indisponível para subir o PDF" }, { status: 503 });
        }

        const carga = await carregarParaProposta(supabase, b.id);
        if (!carga) return NextResponse.json({ error: "pacote não encontrado" }, { status: 404 });
        if (!carga.itens.length) {
          return NextResponse.json({ error: "Adicione ao menos um item antes de enviar." }, { status: 400 });
        }

        const nomeSig = clean(b.signerName, 160);
        if (!nomeSig) return NextResponse.json({ error: "Informe o nome de quem vai assinar." }, { status: 400 });

        const totais = totaisDoPacote(carga.itens, carga.desconto);
        const nomePacote = String(carga.p.name ?? "Proposta");
        const paraQuem = (carga.p.client_hint as string | null) ?? nomePacote;

        // O PDF de marca que o CRM já usa. Uma proposta assinada com cara
        // diferente da enviada por WhatsApp levanta a dúvida de ser a mesma.
        const bytes = await buildProposalPdf({
          companyName: paraQuem,
          dealTitle: nomePacote,
          monthlyValue: totais.mensal.receita,
          owner: user.name,
          scopeLines: carga.itens.map(
            (i) => `${i.label}${i.qty > 1 ? ` (${i.qty}x)` : ""} — ${fmtBRL(i.price * i.qty)}`,
          ),
          validityDays: 15,
          dateLabel: new Date().toLocaleDateString("pt-BR"),
        });

        // A ZapSign busca o arquivo do lado dela, então precisa de URL pública.
        // O caminho carrega o id do pacote e o instante — não é adivinhável.
        const admin = createAdminClient();
        await admin.storage
          .createBucket("wa-media", { public: true, fileSizeLimit: "16MB" })
          .catch(() => {});
        const caminhoPdf = `proposals/pacote/${b.id}/${Date.now()}.pdf`;
        const { error: upErr } = await admin.storage
          .from("wa-media")
          .upload(caminhoPdf, Buffer.from(bytes), { contentType: "application/pdf", upsert: false });
        if (upErr) return NextResponse.json({ error: "Falha ao subir o PDF." }, { status: 500 });
        const urlPdf = admin.storage.from("wa-media").getPublicUrl(caminhoPdf).data.publicUrl;

        const envio = await enviarParaAssinatura({
          nome: `Proposta — ${nomePacote}`.slice(0, 255),
          urlPdf,
          signatario: { nome: nomeSig, email: clean(b.signerEmail, 160), telefone: clean(b.signerPhone, 40) },
          modo: normalizarModo(b.authMode),
          mensagem: `Olá! Segue a proposta comercial. Qualquer dúvida, é só chamar.`,
        });
        if (!envio.ok) return NextResponse.json({ error: envio.erro }, { status: envio.status ?? 502 });

        // Reaproveita o documento do pacote, se já houver: manter um só evita
        // que o cliente receba dois pedidos de assinatura com preços diferentes.
        const conteudo = textoDaProposta(
          { name: nomePacote, clientHint: carga.p.client_hint as string | null, notes: carga.p.notes as string | null },
          carga.itens,
          carga.desconto,
        );
        const linha: Record<string, unknown> = {
          title: `Proposta — ${nomePacote}`,
          kind: "proposta",
          content: conteudo,
          value: valorDeCapa(totais),
          deal_id: (carga.p.deal_id as string | null) ?? null,
          package_id: carga.p.id,
          owner: user.name,
          status: "sent",
          sent_at: new Date().toISOString(),
          created_by: user.id,
          provider: "zapsign",
          external_id: envio.docToken,
          sign_url: envio.signUrl,
          signer_email: clean(b.signerEmail, 160),
          signer_phone: clean(b.signerPhone, 40),
        };

        const { data: existente } = await supabase
          .from("crm_documents")
          .select("id, public_token")
          .eq("package_id", b.id)
          .maybeSingle();

        let token: string;
        if (existente) {
          const { error: e2 } = await supabase.from("crm_documents").update(linha).eq("id", existente.id);
          if (e2) throw e2;
          token = String(existente.public_token);
        } else {
          const { data: novo, error: e3 } = await supabase
            .from("crm_documents")
            .insert(linha)
            .select("id, public_token")
            .single();
          if (e3) throw e3;
          token = String(novo.public_token);
        }

        await supabase.from("packages").update({ status: "enviado" }).eq("id", b.id);
        return NextResponse.json({
          ok: true,
          token,
          caminho: `/proposta/${token}`,
          signUrl: envio.signUrl,
        });
      }

      default:
        return NextResponse.json({ error: "ação inválida" }, { status: 400 });
    }
  } catch (e) {
    if (semMigracao(e)) return erroDeMigracao();
    return NextResponse.json({ error: mensagem(e) || "erro" }, { status: 500 });
  }
}

type PacoteComItens = {
  p: Record<string, unknown>;
  itens: ItemPacote[];
  desconto: number;
};

/** Carrega o pacote e seus itens — o que gerar proposta e enviar para assinar precisam. */
async function carregarParaProposta(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
): Promise<PacoteComItens | null> {
  const { data: p, error } = await supabase
    .from("packages")
    .select("id, name, client_hint, deal_id, notes, discount")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!p) return null;
  const { data: itensRaw } = await supabase
    .from("package_items")
    .select("label, qty, price, cost, cadence, position")
    .eq("package_id", id)
    .order("position");
  const itens: ItemPacote[] = (itensRaw ?? []).map((i) => ({
    label: String(i.label ?? ""),
    qty: Number(i.qty ?? 1),
    price: Number(i.price ?? 0),
    cost: Number(i.cost ?? 0),
    cadence: normalizarCadencia(i.cadence),
  }));
  return { p: p as Record<string, unknown>, itens, desconto: Number(p.discount ?? 0) };
}

/** Substitui os itens do pacote. Apagar e reinserir mantém a ordem explícita. */
async function salvarItens(
  supabase: Awaited<ReturnType<typeof createClient>>,
  packageId: string,
  itens: ItemComPlano[],
) {
  await supabase.from("package_items").delete().eq("package_id", packageId);
  if (!itens.length) return;
  const { error } = await supabase.from("package_items").insert(
    itens.map((i, idx) => ({
      package_id: packageId,
      service_plan_id: i.servicePlanId || null,
      label: i.label,
      qty: i.qty,
      price: i.price,
      cost: i.cost,
      cadence: i.cadence,
      position: idx,
    })),
  );
  if (error) throw error;
}
