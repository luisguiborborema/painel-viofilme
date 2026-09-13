/**
 * Catálogo de serviços e montador de pacotes.
 *
 * O problema que isto resolve: a proposta era montada fora do sistema, e o
 * preço saía sem ninguém saber a margem. Aqui cada plano carrega custo além do
 * preço, e o pacote soma os dois — a margem aparece enquanto a proposta é
 * montada, não depois de fechada.
 *
 * Duas decisões que mudam o resultado:
 *
 * 1. Recorrente e pontual não se somam. Um pacote de R$ 3.000/mês mais R$ 5.000
 *    de setup não é "R$ 8.000". Os blocos ficam separados, e a margem anual
 *    (12 meses de recorrente + o pontual) é a que se compara com a meta —
 *    é assim que a agência decide se o negócio vale.
 * 2. Desconto é percentual sobre a proposta inteira. Em reais sobre o mensal,
 *    o mesmo desconto significaria coisas diferentes conforme a cadência de
 *    cada item, e a margem sairia errada sem avisar.
 *
 * Client-safe: só tipos e cálculo puro.
 */

export type Cadencia = "mensal" | "trimestral" | "semestral" | "anual" | "unico";

/** `porMes` é quantas vezes o valor entra por mês. `null` = pontual, não recorre. */
export const CADENCIAS: { key: Cadencia; label: string; porMes: number | null }[] = [
  { key: "mensal", label: "Mensal", porMes: 1 },
  { key: "trimestral", label: "Trimestral", porMes: 1 / 3 },
  { key: "semestral", label: "Semestral", porMes: 1 / 6 },
  { key: "anual", label: "Anual", porMes: 1 / 12 },
  { key: "unico", label: "Pontual", porMes: null },
];

export function normalizarCadencia(v: unknown): Cadencia {
  const s = String(v ?? "").trim().toLowerCase();
  const achou = CADENCIAS.find((c) => c.key === s);
  if (achou) return achou.key;
  // "avulso" e "projeto" apareceram em rascunhos de schema; ambos são pontuais.
  if (s === "avulso" || s === "projeto" || s === "pontual") return "unico";
  return "mensal";
}

export function fatorMensal(c: Cadencia): number | null {
  // `?? 1` aqui seria um bug: `porMes` é null de propósito para o pontual, e o
  // fallback transformaria um setup de R$ 5.000 em R$ 5.000 todo mês.
  const achou = CADENCIAS.find((x) => x.key === c);
  return achou ? achou.porMes : 1;
}

export type ItemPacote = {
  label: string;
  qty: number;
  /** Preço unitário em reais, na cadência do item. */
  price: number;
  /** Custo interno unitário em reais, na mesma cadência. */
  cost: number;
  cadence: Cadencia;
};

export type Bloco = {
  receita: number;
  custo: number;
  margem: number;
  /** `null` quando não há receita — margem sobre zero não é 0%, é indefinida. */
  margemPct: number | null;
};

export type TotaisPacote = {
  /** Recorrente, já convertido para equivalente mensal. */
  mensal: Bloco;
  /** Pontual (setup, projeto) — entra uma vez só. */
  unico: Bloco;
  /** Doze meses de recorrente mais o pontual. É o número que decide o negócio. */
  ano: Bloco;
  descontoPct: number;
};

/** Dinheiro só existe até o centavo; sem isto o float acumula lixo na soma. */
const cent = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

const bloco = (receita: number, custo: number): Bloco => {
  const r = cent(receita);
  const c = cent(custo);
  return {
    receita: r,
    custo: c,
    margem: cent(r - c),
    margemPct: r > 0 ? Math.round(((r - c) / r) * 100) : null,
  };
};

const naFaixa = (n: unknown, max: number) => {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return 0;
  return Math.min(v, max);
};

/**
 * Soma o pacote.
 *
 * O desconto incide sobre a receita, nunca sobre o custo: dar desconto não
 * torna a entrega mais barata. É exatamente por isso que a margem cai — e é
 * essa queda que a tela precisa mostrar na hora.
 */
export function totaisDoPacote(itens: ItemPacote[], descontoPct = 0): TotaisPacote {
  const desconto = naFaixa(descontoPct, 100);
  const fator = 1 - desconto / 100;

  let recM = 0, cusM = 0, recU = 0, cusU = 0;
  for (const it of itens ?? []) {
    const qty = naFaixa(it?.qty, 9999) || 0;
    if (!qty) continue;
    const preco = naFaixa(it?.price, 99_999_999) * qty;
    const custo = naFaixa(it?.cost, 99_999_999) * qty;
    const f = fatorMensal(normalizarCadencia(it?.cadence));
    if (f == null) { recU += preco; cusU += custo; } else { recM += preco * f; cusM += custo * f; }
  }

  const mensal = bloco(recM * fator, cusM);
  const unico = bloco(recU * fator, cusU);
  const ano = bloco(mensal.receita * 12 + unico.receita, mensal.custo * 12 + unico.custo);
  return { mensal, unico, ano, descontoPct: desconto };
}

export type NivelMargem = "sem-receita" | "prejuizo" | "abaixo" | "ok";
export type VeredictoMargem = { nivel: NivelMargem; texto: string };

/**
 * Compara a margem com a meta que o Financeiro já guarda (`metaMargin`).
 *
 * Um alerta que dispara sempre é ignorado sempre, então só há três estados que
 * merecem atenção — e "abaixo da meta" diz de quanto, porque 41% contra meta de
 * 42% e 12% contra 42% exigem reações diferentes.
 */
export function avaliarMargem(margemPct: number | null, metaMargin: number): VeredictoMargem {
  const meta = naFaixa(metaMargin, 100);
  if (margemPct == null) return { nivel: "sem-receita", texto: "Sem receita no pacote." };
  if (margemPct < 0) return { nivel: "prejuizo", texto: `Prejuízo: o custo supera o preço em ${Math.abs(margemPct)}%.` };
  if (margemPct < meta) {
    return { nivel: "abaixo", texto: `Margem de ${margemPct}% — ${cent(meta - margemPct)} pontos abaixo da meta de ${meta}%.` };
  }
  return { nivel: "ok", texto: `Margem de ${margemPct}%, dentro da meta de ${meta}%.` };
}

/** Rótulo curto de um plano para virar linha da proposta: "Serviço › Plano". */
export function rotuloDoPlano(servico: string, plano: string): string {
  const s = String(servico ?? "").trim();
  const p = String(plano ?? "").trim();
  if (!s) return p || "Item";
  return p ? `${s} › ${p}` : s;
}

/**
 * O número que vai na capa da proposta e no valor do documento.
 *
 * A página pública mostra este valor em destaque, embaixo do título. O total de
 * 12 meses assusta sem informar: o cliente vê "R$ 28.700,00" antes de ler que é
 * mensal. O CRM também trabalha em valor mensal (`monthly_value`), então o
 * recorrente é o número coerente nos dois lugares — o total anual continua no
 * painel, onde a decisão de margem é tomada.
 */
export function valorDeCapa(t: TotaisPacote): number {
  return t.mensal.receita > 0 ? t.mensal.receita : t.unico.receita;
}

export const fmtBRL = (v: number) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Texto da proposta a partir do pacote.
 *
 * Vira o corpo de um `crm_documents`, que já tem link público, rastreio de
 * abertura e assinatura — gerar um segundo mecanismo de link público seria
 * duplicar rastreio e acabar com dois números diferentes de "propostas vistas".
 *
 * Texto puro, sem markdown: a página pública renderiza com `whitespace-pre-wrap`,
 * então `**negrito**` chegaria ao cliente como asteriscos literais.
 */
export function textoDaProposta(
  p: { name: string; clientHint?: string | null; notes?: string | null },
  itens: ItemPacote[],
  descontoPct = 0,
): string {
  const t = totaisDoPacote(itens, descontoPct);
  const partes: string[] = [];
  if (p.clientHint) partes.push(`Preparada para ${p.clientHint}.`);

  const rec = itens.filter((i) => fatorMensal(normalizarCadencia(i.cadence)) != null);
  const uni = itens.filter((i) => fatorMensal(normalizarCadencia(i.cadence)) == null);
  const linha = (i: ItemPacote) =>
    `• ${i.label}${i.qty > 1 ? ` (${i.qty}×)` : ""} — ${fmtBRL(i.price * i.qty)}`;
  const secao = (titulo: string, linhas: string[]) =>
    partes.push(`\n${titulo.toUpperCase()}\n\n${linhas.join("\n")}`);

  if (rec.length) secao("Serviços recorrentes", rec.map(linha));
  if (uni.length) secao("Investimento pontual", uni.map(linha));

  // O desconto vem antes do valor líquido: depois dele, o cliente lê "R$ 2.100
  // por mês" seguido de "desconto de 30%" e pergunta se ainda vai descontar.
  const inv: string[] = [];
  if (t.descontoPct > 0) inv.push(`• Desconto de ${t.descontoPct}% já aplicado abaixo`);
  if (t.mensal.receita > 0) inv.push(`• ${fmtBRL(t.mensal.receita)} por mês`);
  if (t.unico.receita > 0) inv.push(`• ${fmtBRL(t.unico.receita)} — pagamento único`);
  if (inv.length) secao("Investimento", inv);

  if (p.notes) secao("Observações", [p.notes]);
  return partes.join("\n").trim();
}
