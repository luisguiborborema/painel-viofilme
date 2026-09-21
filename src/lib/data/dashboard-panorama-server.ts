import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buscarTudo } from "@/lib/data/paginate-server";
import { STATUS_IGNORAR } from "@/lib/data/dre";
import { montarDre, type ImpactType, type TotaisPorImpacto } from "@/lib/data/resultados";
import { brlCheio, ddmm, rotuloDePessoas, somarDias } from "@/lib/data/dashboard-financeiro";
import {
  fraseDoCaixa, fraseDoResultado, fraseDosGastos, fraseDaReceita, larguraRelativa,
  montarLinhaDoCaixa, type LinhaProjetada,
} from "@/lib/data/dashboard-panorama";

/**
 * Panorama — as quatro visões do Bloco 5 (spec §9), montadas no servidor.
 *
 * Fica num módulo próprio por um motivo da própria spec: "adicionar uma visão =
 * criar um slide + uma aba". Cada visão é um objeto autocontido (título, frase,
 * números, dados do gráfico, link), e a tela só percorre a lista.
 *
 * As frases de conclusão vêm de `dashboard-panorama.ts`, por regra e sem IA.
 */

const paraCent = (reais: unknown) => Math.round((Number(reais) || 0) * 100);
type Linha = Record<string, unknown>;

/* ── O que cada slide entrega ──────────────────────────────────────────── */

export type NumeroDoSlide = { rotulo: string; valor: string; tom?: "bom" | "ruim" | "atencao" };

export type SlideCaixa = {
  grafico: LinhaProjetada | null;
  /** Um por dia da série, na mesma ordem: alimenta o tooltip do hover. */
  dias: { dataIso: string; dataLabel: string; saldo: string; nota: string }[];
  /** Índice do menor saldo na série, para marcar o ponto. */
  indiceMenor: number | null;
  menorLabel: string | null;
  reservaLabel: string | null;
  notaVencidos: string | null;
};

export type SlideReceita = {
  pctRecorrente: number;
  pctPontual: number;
  servicos: { nome: string; larguraRec: number; larguraPon: number; total: string }[];
  pontuais: { nome: string; valor: string }[];
  semServicos: boolean;
};

export type SlideResultado = {
  meses: {
    label: string;
    alturaReceita: number;
    alturaSaidas: number;
    resultado: string;
    margem: string;
    emCurso: boolean;
  }[];
};

export type SlideGastos = {
  grupos: {
    nome: string;
    largura: number;
    valor: string;
    pct: string;
    acimaDoOrcado: boolean;
    seloOrcado: string | null;
  }[];
};

export type VisaoPanorama = {
  id: "caixa" | "receita" | "resultado" | "gastos";
  aba: string;
  titulo: string;
  frase: string;
  numeros: NumeroDoSlide[];
  linkLabel: string;
  href: string;
};

export type PanoramaView = {
  visoes: VisaoPanorama[];
  caixa: SlideCaixa;
  receita: SlideReceita;
  resultado: SlideResultado;
  gastos: SlideGastos;
};

export const PANORAMA_VAZIO: PanoramaView = {
  visoes: [],
  caixa: { grafico: null, dias: [], indiceMenor: null, menorLabel: null, reservaLabel: null, notaVencidos: null },
  receita: { pctRecorrente: 0, pctPontual: 0, servicos: [], pontuais: [], semServicos: true },
  resultado: { meses: [] },
  gastos: { grupos: [] },
};

/* ── Contexto que o Dashboard já calculou ──────────────────────────────── */

export type ContextoPanorama = {
  hoje: string;
  mesIni: string;
  mesFim: string;
  mesLabel: string;
  serie: { dataIso: string; saldoCent: number }[];
  saldoHojeCent: number;
  reservaCent: number;
  entradasAbertas: { dataIso: string; valorCent: number; pessoa: string }[];
  saidasAbertas: { dataIso: string; valorCent: number; pessoa: string }[];
  entradasVencidasCent: number;
  receitaMesCent: number;
  recorrenteFaturadoCent: number;
  pontualCent: number;
  deltaMrr30Cent: number | null;
  /** Top 3 títulos pontuais do mês (§9.2, slide 2). */
  pontuaisDoMes: { nome: string; valorCent: number }[];
  impactoDa: Map<string, ImpactType>;
  labelDa: Map<string, string>;
  realizadoPorCategoria: Map<string, number>;
  orcadoPorCategoria: Map<string, number>;
  toleranciaOrcamentoPct: number;
  destinos: { fluxo: string; receita: string; dre: string };
};

/* ── Montagem ──────────────────────────────────────────────────────────── */

export async function montarPanorama(
  db: SupabaseClient,
  ctx: ContextoPanorama,
): Promise<PanoramaView> {
  const [servicos, seisMeses] = await Promise.all([
    lerServicos(db),
    lerSeisMeses(db, ctx),
  ]);

  const caixa = montarCaixa(ctx);
  const receita = montarReceita(ctx, servicos);
  const resultado = montarResultado(ctx, seisMeses);
  const gastos = montarGastos(ctx);

  return {
    caixa: caixa.slide,
    receita: receita.slide,
    resultado: resultado.slide,
    gastos: gastos.slide,
    visoes: [
      {
        id: "caixa", aba: "Caixa em 30 dias",
        titulo: "Caixa nos próximos 30 dias",
        frase: caixa.frase, numeros: caixa.numeros,
        linkLabel: "Abrir fluxo de caixa", href: ctx.destinos.fluxo,
      },
      {
        id: "receita", aba: "Composição da receita",
        titulo: `Composição da receita de ${ctx.mesLabel}`,
        frase: receita.frase, numeros: receita.numeros,
        linkLabel: "Abrir receita", href: ctx.destinos.receita,
      },
      {
        id: "resultado", aba: "Resultado em 6 meses",
        titulo: "Resultado nos últimos 6 meses",
        frase: resultado.frase, numeros: resultado.numeros,
        linkLabel: "Abrir DRE", href: ctx.destinos.dre,
      },
      {
        id: "gastos", aba: "Para onde vai o dinheiro",
        titulo: `Para onde vai o dinheiro em ${ctx.mesLabel}`,
        frase: gastos.frase, numeros: gastos.numeros,
        linkLabel: "Abrir DRE", href: ctx.destinos.dre,
      },
    ],
  };
}

/* ── Slide 1 · Caixa em 30 dias ────────────────────────────────────────── */

function montarCaixa(ctx: ContextoPanorama) {
  const grafico = montarLinhaDoCaixa(ctx.serie, ctx.reservaCent);

  let indiceMenor: number | null = null;
  ctx.serie.forEach((p, i) => {
    if (indiceMenor === null || p.saldoCent < ctx.serie[indiceMenor].saldoCent) indiceMenor = i;
  });
  const menor = indiceMenor === null ? null : ctx.serie[indiceMenor];

  // Só o que ainda vai acontecer entra na projeção — mesma regra de §12.
  const ate = somarDias(ctx.hoje, 30);
  const entradas = ctx.entradasAbertas.filter((e) => e.dataIso >= ctx.hoje && e.dataIso <= ate);
  const saidas = ctx.saidasAbertas.filter((s) => s.dataIso <= ate);
  const entradasCent = entradas.reduce((s, e) => s + e.valorCent, 0);
  const saidasCent = saidas.reduce((s, x) => s + x.valorCent, 0);

  // O que explica o dia do menor saldo: a maior saída daquele dia. A vencida
  // conta como saída de hoje (§12), então quando o menor saldo é hoje ela
  // precisa entrar — senão o dia fica sem explicação nenhuma.
  const doDia = menor
    ? ctx.saidasAbertas.filter(
        (s) => s.dataIso === menor.dataIso || (menor.dataIso === ctx.hoje && s.dataIso < ctx.hoje),
      )
    : [];
  const maiorSaidaDoDia = [...doDia].sort((a, b) => b.valorCent - a.valorCent)[0]?.pessoa ?? null;

  const dias = ctx.serie.map((p) => ({
    dataIso: p.dataIso,
    dataLabel: ddmm(p.dataIso),
    saldo: brlCheio(p.saldoCent),
    nota: notaDoDia(ctx, p.dataIso),
  }));

  return {
    slide: {
      grafico, dias, indiceMenor,
      menorLabel: menor ? `mín. ${brlCheio(menor.saldoCent)} em ${ddmm(menor.dataIso)}` : null,
      reservaLabel: ctx.reservaCent > 0 ? `Reserva mínima de ${brlCheio(ctx.reservaCent)}` : null,
      // A nota existe porque a projeção é conservadora de propósito: quem vê
      // o número precisa saber que há dinheiro fora dele.
      notaVencidos: ctx.entradasVencidasCent > 0
        ? `Recebimentos vencidos ficam fora da projeção. Se forem pagos, somam mais ${brlCheio(ctx.entradasVencidasCent)}.`
        : null,
    } satisfies SlideCaixa,
    frase: fraseDoCaixa({
      saldoHojeCent: ctx.saldoHojeCent,
      menorCent: menor?.saldoCent ?? null,
      menorEmIso: menor?.dataIso ?? null,
      reservaCent: ctx.reservaCent,
      maiorSaidaDoDia,
    }),
    numeros: [
      { rotulo: "Saldo hoje", valor: brlCheio(ctx.saldoHojeCent) },
      { rotulo: "Saldo em 30 dias", valor: brlCheio(ctx.serie[ctx.serie.length - 1]?.saldoCent ?? 0) },
      {
        rotulo: "Menor saldo",
        valor: menor ? `${brlCheio(menor.saldoCent)} em ${ddmm(menor.dataIso)}` : "—",
        tom: menor && menor.saldoCent < ctx.reservaCent ? ("ruim" as const) : undefined,
      },
      { rotulo: "Entradas previstas", valor: brlCheio(entradasCent), tom: "bom" as const },
      { rotulo: "Saídas previstas", valor: brlCheio(saidasCent) },
    ],
  };
}

/** "Folha e Aluguel − R$ 63.400" — o que explica o degrau daquele dia. */
function notaDoDia(ctx: ContextoPanorama, dataIso: string): string {
  const entram = ctx.entradasAbertas.filter((e) => e.dataIso === dataIso);
  // A saída vencida foi empurrada para hoje pela projeção; a nota segue a mesma
  // regra, senão o degrau de hoje apareceria sem explicação nenhuma.
  const saem = ctx.saidasAbertas.filter(
    (s) => s.dataIso === dataIso || (dataIso === ctx.hoje && s.dataIso < ctx.hoje),
  );
  const partes: string[] = [];
  if (entram.length) {
    const v = entram.reduce((s, e) => s + e.valorCent, 0);
    partes.push(`${rotuloDePessoas(entram.map((e) => e.pessoa), "recebimentos")} + ${brlCheio(v)}`);
  }
  if (saem.length) {
    const v = saem.reduce((s, x) => s + x.valorCent, 0);
    partes.push(`${rotuloDePessoas(saem.map((x) => x.pessoa))} − ${brlCheio(v)}`);
  }
  return partes.join(". ") || "Sem movimentações previstas";
}

/* ── Slide 2 · Composição da receita ───────────────────────────────────── */

type ServicoContratado = { nome: string; recorrenteCent: number; pontualCent: number };

async function lerServicos(db: SupabaseClient): Promise<ServicoContratado[]> {
  const r = await db
    .from("client_services")
    .select("type, final_value, services(name), clients!inner(status)")
    .neq("clients.status", "churn");
  if (r.error) return [];

  const porNome = new Map<string, ServicoContratado>();
  for (const l of ((r.data ?? []) as Linha[])) {
    // O join devolve objeto ou array conforme a cardinalidade inferida.
    const s = l.services as { name?: string } | { name?: string }[] | null;
    const nome = String((Array.isArray(s) ? s[0]?.name : s?.name) ?? "").trim() || "Sem serviço";
    const atual = porNome.get(nome) ?? { nome, recorrenteCent: 0, pontualCent: 0 };
    const v = paraCent(l.final_value);
    if (String(l.type ?? "") === "recorrente") atual.recorrenteCent += v;
    else atual.pontualCent += v;
    porNome.set(nome, atual);
  }
  return [...porNome.values()].sort(
    (a, b) => b.recorrenteCent + b.pontualCent - (a.recorrenteCent + a.pontualCent),
  );
}

function montarReceita(ctx: ContextoPanorama, servicos: ServicoContratado[]) {
  const total = ctx.receitaMesCent;
  const pctRecorrente = total > 0 ? Math.round((ctx.recorrenteFaturadoCent / total) * 100) : 0;
  const maior = Math.max(0, ...servicos.map((s) => s.recorrenteCent + s.pontualCent));

  return {
    slide: {
      pctRecorrente,
      pctPontual: total > 0 ? 100 - pctRecorrente : 0,
      semServicos: servicos.length === 0,
      servicos: servicos.slice(0, 6).map((s) => ({
        nome: s.nome,
        larguraRec: larguraRelativa(s.recorrenteCent, maior),
        larguraPon: larguraRelativa(s.pontualCent, maior),
        total: brlCheio(s.recorrenteCent + s.pontualCent),
      })),
      pontuais: ctx.pontuaisDoMes.slice(0, 3).map((p) => ({
        nome: p.nome, valor: brlCheio(p.valorCent),
      })),
    } satisfies SlideReceita,
    frase: fraseDaReceita({ pctRecorrente, totalCent: total, servicos }),
    numeros: [
      { rotulo: "Receita do mês", valor: brlCheio(total) },
      {
        rotulo: "Recorrente (faturado)",
        valor: total > 0 ? `${brlCheio(ctx.recorrenteFaturadoCent)}, ${pctRecorrente}%` : "—",
      },
      {
        rotulo: "Pontual",
        valor: total > 0 ? `${brlCheio(ctx.pontualCent)}, ${100 - pctRecorrente}%` : "—",
      },
      {
        rotulo: "MRR em 30 dias",
        // Zero é "não mudou", não "subiu zero": o sinal sugere movimento.
        valor: ctx.deltaMrr30Cent == null
          ? "—"
          : ctx.deltaMrr30Cent === 0
            ? "sem mudança"
            : `${ctx.deltaMrr30Cent > 0 ? "+ " : "− "}${brlCheio(Math.abs(ctx.deltaMrr30Cent))}`,
        tom: ctx.deltaMrr30Cent == null || ctx.deltaMrr30Cent === 0
          ? undefined
          : ctx.deltaMrr30Cent > 0 ? ("bom" as const) : ("ruim" as const),
      },
    ],
  };
}

/* ── Slide 3 · Resultado nos últimos 6 meses ───────────────────────────── */

type MesDeResultado = { iso: string; label: string; receitaCent: number; saidasCent: number; resultadoCent: number };

const MESES_CURTOS = ["", "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

async function lerSeisMeses(db: SupabaseClient, ctx: ContextoPanorama): Promise<MesDeResultado[]> {
  // Início do 6º mês para trás, contando o corrente.
  const [ano, mes] = ctx.mesIni.split("-").map(Number);
  const de = new Date(Date.UTC(ano, mes - 1 - 5, 1)).toISOString().slice(0, 10);

  const [rec, desp] = await Promise.all([
    buscarTudo<Linha>((a, b) => db.from("payments")
      .select("value, due_date, status").gte("due_date", de).lte("due_date", ctx.mesFim).range(a, b)),
    buscarTudo<Linha>((a, b) => db.from("expenses")
      .select("amount, due_date, category").gte("due_date", de).lte("due_date", ctx.mesFim).range(a, b)),
  ]);

  const porMes = new Map<string, TotaisPorImpacto>();
  const garantir = (iso: string) => {
    const k = iso.slice(0, 7);
    if (!porMes.has(k)) porMes.set(k, {});
    return porMes.get(k) as TotaisPorImpacto;
  };

  for (const r of rec.linhas) {
    if (STATUS_IGNORAR.has(String(r.status ?? ""))) continue;
    const d = String(r.due_date ?? "");
    if (!d) continue;
    const t = garantir(d);
    t.operating_revenue = (t.operating_revenue ?? 0) + paraCent(r.value);
  }
  for (const e of desp.linhas) {
    const imp = ctx.impactoDa.get(String(e.category ?? ""));
    const d = String(e.due_date ?? "");
    if (!imp || !d) continue;
    const t = garantir(d);
    t[imp] = (t[imp] ?? 0) + paraCent(e.amount);
  }

  // O histórico começa no primeiro mês COM lançamento e daí segue inteiro,
  // inclusive os meses zerados. Pular o mês vazio encostaria julho em setembro
  // no gráfico e faria a sequência de alta comparar meses não vizinhos.
  const meses: MesDeResultado[] = [];
  let comecou = false;
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(ano, mes - 1 - i, 1));
    const iso = d.toISOString().slice(0, 10);
    const totais = porMes.get(iso.slice(0, 7));
    if (!totais && !comecou) continue;
    comecou = true;
    const dre = montarDre(totais ?? {});
    meses.push({
      iso,
      label: MESES_CURTOS[d.getUTCMonth() + 1],
      receitaCent: dre.receitaBrutaCent,
      // "Saídas de resultado" (§12): tudo que reduz o resultado, sem
      // investimento nem sócios — senão uma câmera viraria prejuízo do mês.
      saidasCent: dre.receitaBrutaCent - dre.resultadoLiquidoCent,
      resultadoCent: dre.resultadoLiquidoCent,
    });
  }
  return meses;
}

function montarResultado(ctx: ContextoPanorama, meses: MesDeResultado[]) {
  const maior = Math.max(0, ...meses.flatMap((m) => [m.receitaCent, m.saidasCent]));
  const receitaPeriodo = meses.reduce((s, m) => s + m.receitaCent, 0);
  const resultadoPeriodo = meses.reduce((s, m) => s + m.resultadoCent, 0);
  const media = meses.length ? Math.round(resultadoPeriodo / meses.length) : 0;
  const atual = meses[meses.length - 1];

  return {
    slide: {
      meses: meses.map((m) => {
        const emCurso = m.iso.slice(0, 7) === ctx.mesIni.slice(0, 7);
        return {
          label: emCurso ? `${m.label}, em curso` : m.label,
          alturaReceita: larguraRelativa(m.receitaCent, maior),
          alturaSaidas: larguraRelativa(m.saidasCent, maior),
          resultado: brlCheio(m.resultadoCent),
          margem: m.receitaCent > 0
            ? `${Math.round((m.resultadoCent / m.receitaCent) * 100)}% da receita`
            : "sem receita",
          emCurso,
        };
      }),
    } satisfies SlideResultado,
    frase: fraseDoResultado({
      resultados: meses.map((m) => m.resultadoCent),
      mediaCent: media,
      mesEmCurso: Boolean(atual && atual.iso.slice(0, 7) === ctx.mesIni.slice(0, 7)),
      desdeIso: meses[0]?.iso ?? null,
      mesesDisponiveis: meses.length,
    }),
    numeros: [
      { rotulo: `Resultado de ${ctx.mesLabel}`, valor: atual ? brlCheio(atual.resultadoCent) : "—" },
      { rotulo: "Média do período", valor: meses.length ? brlCheio(media) : "—" },
      { rotulo: "Receita no período", valor: brlCheio(receitaPeriodo) },
      { rotulo: "Resultado no período", valor: brlCheio(resultadoPeriodo) },
    ],
  };
}

/* ── Slide 4 · Para onde vai o dinheiro ────────────────────────────────── */

function montarGastos(ctx: ContextoPanorama) {
  // Só o que reduz o resultado. O plano de categorias aqui é plano — cada
  // categoria É o primeiro nível, então ela mesma serve de grupo.
  const grupos = [...ctx.realizadoPorCategoria.entries()]
    .map(([key, valorCent]) => {
      const imp = ctx.impactoDa.get(key);
      if (!imp || imp === "investment" || imp === "equity_financing") return null;
      const orcado = ctx.orcadoPorCategoria.get(key) ?? 0;
      const pctDoOrcado = orcado > 0 ? (valorCent / orcado) * 100 : null;
      return {
        nome: ctx.labelDa.get(key) ?? key,
        valorCent,
        acimaDoOrcado: pctDoOrcado != null && pctDoOrcado > ctx.toleranciaOrcamentoPct,
        pctDoOrcado,
      };
    })
    .filter((g): g is NonNullable<typeof g> => g !== null && g.valorCent > 0)
    .sort((a, b) => b.valorCent - a.valorCent);

  const total = grupos.reduce((s, g) => s + g.valorCent, 0);
  const maior = grupos[0];
  const maiorEstouro = [...grupos]
    .filter((g) => g.acimaDoOrcado)
    .sort((a, b) => (b.pctDoOrcado ?? 0) - (a.pctDoOrcado ?? 0))[0];

  return {
    slide: {
      grupos: grupos.slice(0, 8).map((g) => ({
        nome: g.nome,
        largura: larguraRelativa(g.valorCent, maior?.valorCent ?? 0),
        valor: brlCheio(g.valorCent),
        pct: total > 0 ? `${Math.round((g.valorCent / total) * 100)}%` : "—",
        acimaDoOrcado: g.acimaDoOrcado,
        seloOrcado: g.acimaDoOrcado && g.pctDoOrcado != null ? `${Math.round(g.pctDoOrcado)}%` : null,
      })),
    } satisfies SlideGastos,
    frase: fraseDosGastos({ grupos, totalCent: total }),
    numeros: [
      { rotulo: "Total do mês", valor: brlCheio(total) },
      {
        rotulo: "Em relação à receita",
        valor: ctx.receitaMesCent > 0 ? `${Math.round((total / ctx.receitaMesCent) * 100)}%` : "—",
      },
      {
        rotulo: "Maior grupo",
        valor: maior && total > 0
          ? `${maior.nome}, ${Math.round((maior.valorCent / total) * 100)}%`
          : "—",
      },
      {
        rotulo: "Acima do orçado",
        valor: maiorEstouro && maiorEstouro.pctDoOrcado != null
          ? `${maiorEstouro.nome}, ${Math.round(maiorEstouro.pctDoOrcado)}%`
          : "nenhum",
        tom: maiorEstouro ? ("atencao" as const) : undefined,
      },
    ],
  };
}
