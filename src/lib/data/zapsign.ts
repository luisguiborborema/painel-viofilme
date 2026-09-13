/**
 * Integração com a ZapSign — assinatura da proposta.
 *
 * Até aqui a proposta era aceita na própria página pública: nome digitado, IP e
 * data. Serve para registrar intenção, mas não é assinatura eletrônica com
 * cadeia de custódia. A ZapSign devolve um PDF assinado com carimbo de tempo e
 * trilha de auditoria — o que muda é o que se pode provar depois.
 *
 * Duas decisões de segurança moram aqui:
 *
 * 1. A ZapSign não assina o webhook (não há HMAC). O que ela oferece é mandar
 *    headers que nós escolhemos ao registrar o webhook. Então o segredo é
 *    nosso, viaja no header, e a comparação é feita sem vazar tempo.
 * 2. Sem segredo configurado, o webhook RECUSA. O padrão do projeto em outros
 *    webhooks é "env vazio não valida", que é aceitável para mensagem de chat
 *    — aqui não: aceitar um POST anônimo significaria deixar qualquer um
 *    marcar um documento como assinado.
 *
 * Client-safe: só tipos e funções puras.
 */

export const ZAPSIGN_API = "https://api.zapsign.com.br/api/v1";

/**
 * Como o signatário se autentica. `assinaturaTela` não custa crédito; os
 * outros custam por envio, então a escolha é da agência, não nossa.
 */
export const MODOS_AUTENTICACAO = [
  { key: "assinaturaTela", label: "Só desenhar/aceitar em tela", custo: "sem custo" },
  { key: "tokenEmail", label: "Token por e-mail", custo: "sem custo" },
  { key: "tokenSms", label: "Token por SMS", custo: "R$ 0,10 por envio" },
  { key: "tokenWhatsapp", label: "Token por WhatsApp", custo: "5 créditos" },
] as const;

export type ModoAutenticacao = (typeof MODOS_AUTENTICACAO)[number]["key"];

export function normalizarModo(v: unknown): ModoAutenticacao {
  const s = String(v ?? "").trim();
  return MODOS_AUTENTICACAO.some((m) => m.key === s) ? (s as ModoAutenticacao) : "assinaturaTela";
}

export type Signatario = {
  nome: string;
  email?: string | null;
  /** DDI e telefone separados, como a API espera. */
  telefone?: string | null;
};

export type EntradaDocumento = {
  nome: string;
  urlPdf: string;
  signatario: Signatario;
  modo?: ModoAutenticacao;
  /** Mensagem que acompanha o e-mail automático da ZapSign. */
  mensagem?: string | null;
};

export type ErroValidacao = { erro: string };

const texto = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

/** Telefone brasileiro em DDI + número, como a API separa. */
export function partirTelefone(bruto?: string | null): { ddi: string; numero: string } | null {
  const d = String(bruto ?? "").replace(/\D/g, "");
  if (!d) return null;
  // Com 12 ou 13 dígitos já vem com o 55 na frente; com 10 ou 11 é local.
  if (d.length >= 12) return { ddi: d.slice(0, d.length - 11) || "55", numero: d.slice(-11) };
  if (d.length >= 10) return { ddi: "55", numero: d };
  return null;
}

/** E-mail só precisa ser plausível: quem valida de verdade é a ZapSign. */
export function emailPlausivel(v?: string | null): boolean {
  const s = String(v ?? "").trim();
  return /^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$/.test(s);
}

/**
 * Monta o corpo do POST /docs/.
 *
 * Devolve `{erro}` em vez de lançar: quem chama transforma em 400 com a
 * mensagem pronta, e nenhum caso inválido chega a gastar crédito na ZapSign.
 */
export function montarDocumento(e: EntradaDocumento): Record<string, unknown> | ErroValidacao {
  const nome = texto(e.nome, 255);
  if (!nome) return { erro: "O documento precisa de um nome." };
  const urlPdf = texto(e.urlPdf, 2000);
  if (!/^https:\/\//i.test(urlPdf)) return { erro: "O PDF precisa de uma URL pública https." };

  const nomeSig = texto(e.signatario?.nome, 160);
  if (!nomeSig) return { erro: "Informe o nome de quem vai assinar." };

  const email = texto(e.signatario?.email, 160);
  const tel = partirTelefone(e.signatario?.telefone);
  if (!email && !tel) return { erro: "Informe e-mail ou WhatsApp de quem vai assinar." };
  if (email && !emailPlausivel(email)) return { erro: "E-mail do signatário parece inválido." };

  const modo = normalizarModo(e.modo);
  // Token por e-mail sem e-mail não tem como chegar a lugar nenhum.
  if (modo === "tokenEmail" && !email) return { erro: "Token por e-mail exige o e-mail do signatário." };
  if ((modo === "tokenSms" || modo === "tokenWhatsapp") && !tel) {
    return { erro: "Token por SMS/WhatsApp exige o telefone do signatário." };
  }

  const signer: Record<string, unknown> = {
    name: nomeSig,
    auth_mode: modo,
    // O e-mail automático da ZapSign só faz sentido se houver e-mail.
    send_automatic_email: Boolean(email),
  };
  if (email) signer.email = email;
  if (tel) { signer.phone_country = tel.ddi; signer.phone_number = tel.numero; }
  const msg = texto(e.mensagem, 500);
  if (msg) signer.custom_message = msg;

  return { name: nome, url_pdf: urlPdf, lang: "pt-br", signers: [signer] };
}

export type DocumentoCriado = {
  docToken: string;
  signUrl: string | null;
  signerToken: string | null;
  status: string;
};

const str = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
  return s || null;
};

/** Lê a resposta da criação. Sem `token` não há como reconciliar depois. */
export function lerRespostaDocumento(json: unknown): DocumentoCriado | ErroValidacao {
  const o = (json ?? {}) as Record<string, unknown>;
  const docToken = str(o.token);
  if (!docToken) return { erro: "A ZapSign não devolveu o token do documento." };
  const signers = Array.isArray(o.signers) ? (o.signers as Record<string, unknown>[]) : [];
  const primeiro = signers[0] ?? {};
  return {
    docToken,
    signUrl: str(primeiro.sign_url) ?? str(o.sign_url),
    signerToken: str(primeiro.token),
    status: str(o.status) ?? "pending",
  };
}

/** Estados nossos, não os da ZapSign. `pending` vira "enviado", não "rascunho". */
export type StatusDocumento = "sent" | "viewed" | "signed" | "refused";

export function mapearStatus(bruto: unknown): StatusDocumento | null {
  const s = String(bruto ?? "").trim().toLowerCase();
  if (s === "signed") return "signed";
  if (s === "refused" || s === "rejected") return "refused";
  if (s === "pending" || s === "new" || s === "created") return "sent";
  return null;
}

export type EventoWebhook = {
  docToken: string;
  status: StatusDocumento | null;
  signedFileUrl: string | null;
  signerName: string | null;
  signedAt: string | null;
};

/**
 * Lê o que a ZapSign posta no webhook.
 *
 * O formato exato do corpo não está documentado, e o campo de evento já
 * apareceu como `event_type` e como `type`. Por isso a leitura procura o dado
 * em vários lugares e decide pelo `status` do documento, que é o que importa —
 * um evento com nome inesperado mas status "signed" continua sendo uma
 * assinatura. Devolve `null` quando não achou nem o token do documento.
 */
export function lerWebhook(json: unknown): EventoWebhook | null {
  const raiz = (json ?? {}) as Record<string, unknown>;
  const ninho = ["doc", "document", "data"]
    .map((k) => raiz[k])
    .find((v) => v && typeof v === "object") as Record<string, unknown> | undefined;
  const o = { ...(ninho ?? {}), ...raiz };

  const docToken = str(o.token) ?? str(o.doc_token) ?? str(ninho?.token);
  if (!docToken) return null;

  const evento = String(str(o.event_type) ?? str(o.type) ?? "").toLowerCase();
  // O evento é dica; o status manda. Mas um evento de recusa sem status ainda
  // precisa ser entendido.
  let status = mapearStatus(o.status);
  if (!status && evento.includes("refused")) status = "refused";
  if (!status && evento.includes("signed")) status = "signed";

  const signers = Array.isArray(o.signers) ? (o.signers as Record<string, unknown>[]) : [];
  const assinante = signers.find((s) => str(s.signed_at)) ?? signers[0];

  return {
    docToken,
    status,
    signedFileUrl: str(o.signed_file),
    signerName: str(assinante?.name),
    signedAt: str(assinante?.signed_at) ?? str(o.last_update_at),
  };
}

/**
 * Compara o segredo do webhook sem vazar em quanto tempo falhou.
 *
 * Comparação normal de string sai no primeiro caractere diferente; medindo o
 * tempo dá para descobrir o segredo caractere a caractere. Aqui todo o
 * comprimento é percorrido sempre.
 */
export function segredoConfere(recebido: unknown, esperado: string): boolean {
  const a = String(recebido ?? "").replace(/^Bearer\s+/i, "").trim();
  const b = String(esperado ?? "").trim();
  if (!b || !a || a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < b.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}
