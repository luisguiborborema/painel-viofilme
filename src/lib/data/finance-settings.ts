/**
 * Configuração do Financeiro — régua de cobrança, formas de recebimento e
 * alertas. Client-safe: só tipos, padrões e regras puras.
 */

export type CollectionAction = "whatsapp" | "cs" | "email";

export const COLLECTION_ACTIONS: { key: CollectionAction; label: string }[] = [
  { key: "whatsapp", label: "WhatsApp" },
  { key: "cs", label: "Escalar para o CS" },
  { key: "email", label: "E-mail" },
];

/** Um degrau da régua: a partir de N dias de atraso, faça isto. */
export type CollectionRule = { days: number; label: string; action: CollectionAction };

export type PaymentMethodDef = { key: string; label: string };

export type FinanceSettings = {
  metaMargin: number;
  collectionRules: CollectionRule[];
  paymentMethods: PaymentMethodDef[];
  alertMargin: boolean;
  alertOverdue: number;
  /** Fechamento contábil: tudo com vencimento até aqui está travado. */
  closedUntil: string | null;
};

export const REGUA_PADRAO: CollectionRule[] = [
  { days: 3, label: "Lembrete amigável", action: "whatsapp" },
  { days: 10, label: "Cobrança formal", action: "whatsapp" },
  { days: 20, label: "Escalar para o CS", action: "cs" },
];

export const METODOS_PADRAO: PaymentMethodDef[] = [
  { key: "PIX", label: "Pix" },
  { key: "CASH", label: "Dinheiro" },
  { key: "TRANSFER", label: "Transferência" },
  { key: "CARD", label: "Cartão" },
  { key: "BARTER", label: "Permuta" },
  { key: "OTHER", label: "Outro" },
];

export const FINANCE_SETTINGS_PADRAO: FinanceSettings = {
  metaMargin: 42,
  collectionRules: REGUA_PADRAO,
  paymentMethods: METODOS_PADRAO,
  alertMargin: false,
  alertOverdue: 0,
  closedUntil: null,
};

/** Normaliza a régua vinda do banco: ordena por dias e descarta lixo. */
export function parseRegua(raw: unknown): CollectionRule[] {
  if (!Array.isArray(raw)) return REGUA_PADRAO;
  const acoes = new Set(COLLECTION_ACTIONS.map((a) => a.key));
  const out = raw
    .map((r) => {
      const o = (r ?? {}) as Record<string, unknown>;
      const days = Math.max(0, Math.round(Number(o.days)));
      const label = String(o.label ?? "").trim();
      const action = acoes.has(String(o.action) as CollectionAction)
        ? (String(o.action) as CollectionAction)
        : "whatsapp";
      return Number.isFinite(days) && label ? { days, label, action } : null;
    })
    .filter(Boolean) as CollectionRule[];
  return out.length ? out.sort((a, b) => a.days - b.days) : REGUA_PADRAO;
}

export function parseMetodos(raw: unknown): PaymentMethodDef[] {
  if (!Array.isArray(raw)) return METODOS_PADRAO;
  const vistos = new Set<string>();
  const out: PaymentMethodDef[] = [];
  for (const m of raw) {
    const o = (m ?? {}) as Record<string, unknown>;
    const label = String(o.label ?? "").trim();
    if (!label) continue;
    // Acento vira a letra base (à → A); sem isso "Boleto à vista" perderia o "a".
    const key =
      String(o.key ?? label)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 20) || "OUTRO";
    if (vistos.has(key)) continue;
    vistos.add(key);
    out.push({ key, label });
  }
  return out.length ? out : METODOS_PADRAO;
}

/**
 * Qual degrau da régua se aplica a N dias de atraso.
 * Devolve o mais avançado que já foi ultrapassado; null se ainda não venceu.
 */
export function degrauDaRegua(regua: CollectionRule[], diasAtraso: number): CollectionRule | null {
  if (diasAtraso <= 0) return null;
  let atual: CollectionRule | null = null;
  for (const r of [...regua].sort((a, b) => a.days - b.days)) {
    if (diasAtraso >= r.days) atual = r;
  }
  return atual;
}
