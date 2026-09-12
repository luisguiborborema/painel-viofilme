/**
 * Linha do tempo das postagens (estilo ClickUp).
 *
 * Cada card tem duas datas — entrega e postagem — então a barra não é um
 * enfeite: ela É a janela de produção. Ver as barras lado a lado mostra o que o
 * kanban esconde: semana sobrecarregada, prazo apertado demais e post que vai
 * ao ar sem folga nenhuma depois da entrega.
 *
 * Client-safe: só cálculo puro sobre datas ISO.
 */

const DIA = 86_400_000;

const asDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
export const isoDoDia = (d: Date) => d.toISOString().slice(0, 10);

/** Dias inteiros entre duas datas ISO (b − a). Negativo se b vem antes. */
export function diasEntre(a: string, b: string): number {
  return Math.round((asDate(b).getTime() - asDate(a).getTime()) / DIA);
}

export function somarDias(iso: string, n: number): string {
  return isoDoDia(new Date(asDate(iso).getTime() + n * DIA));
}

export type PostNaTimeline = {
  id: string;
  n: number;
  titulo: string;
  tipo: string;
  /** Início da barra. */
  entrega: string | null;
  /** Fim da barra. */
  postagem: string | null;
  responsavel: string | null;
};

export type BarraTimeline = {
  post: PostNaTimeline;
  /** Posição da barra, em % da largura da janela. */
  left: number;
  width: number;
  inicio: string;
  fim: string;
  /** Só uma das datas: a barra vira um marco de um dia. */
  pontual: boolean;
  /** Entrega depois da postagem — o conteúdo ficaria pronto atrasado. */
  invertida: boolean;
  /** Quantos dias de folga entre ficar pronto e ir ao ar. */
  folgaDias: number | null;
};

export type Janela = {
  inicio: string;
  fim: string;
  /** Dias que a janela cobre, incluindo as pontas. */
  dias: number;
  /** Divisórias de semana, para o cabeçalho. */
  semanas: { iso: string; left: number; label: string }[];
  hoje: { iso: string; left: number } | null;
};

const MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "23/09" a partir de "2026-09-23". */
export function ddmm(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/**
 * Janela que a timeline cobre.
 *
 * Parte das datas dos posts, não do mês de referência: a produção de outubro
 * começa em setembro, e uma timeline que só mostrasse outubro cortaria
 * justamente as entregas. Margem de um dia em cada ponta para a barra não
 * encostar na borda.
 */
export function janelaDaTimeline(posts: PostNaTimeline[], hojeIso?: string): Janela | null {
  const datas = posts
    .flatMap((p) => [p.entrega, p.postagem])
    .filter((d): d is string => Boolean(d) && /^\d{4}-\d{2}-\d{2}$/.test(String(d)))
    .sort();
  if (datas.length === 0) return null;

  const inicio = somarDias(datas[0], -1);
  const fim = somarDias(datas.at(-1)!, 1);
  const dias = Math.max(1, diasEntre(inicio, fim) + 1);
  const pct = (iso: string) => (diasEntre(inicio, iso) / dias) * 100;

  // Divisórias na segunda-feira: é como a equipe fala do calendário ("semana 1").
  const semanas: Janela["semanas"] = [];
  for (let i = 0; i < dias; i++) {
    const d = asDate(somarDias(inicio, i));
    if (d.getUTCDay() === 1) {
      const iso = isoDoDia(d);
      semanas.push({ iso, left: pct(iso), label: `${d.getUTCDate()} ${MES_CURTO[d.getUTCMonth()]}` });
    }
  }

  const hoje = hojeIso ?? isoDoDia(new Date());
  return {
    inicio, fim, dias, semanas,
    hoje: hoje >= inicio && hoje <= fim ? { iso: hoje, left: pct(hoje) } : null,
  };
}

/**
 * Converte um post em barra posicionada.
 *
 * Post sem data nenhuma não vira barra — ele fica numa lista à parte, porque
 * esconder o que não tem data é como perder o post.
 */
export function barraDoPost(p: PostNaTimeline, janela: Janela): BarraTimeline | null {
  const a = p.entrega;
  const b = p.postagem;
  if (!a && !b) return null;

  const pontual = !a || !b;
  const bruto: [string, string] = pontual ? [(a ?? b)!, (a ?? b)!] : [a!, b!];
  const invertida = !pontual && bruto[0] > bruto[1];
  // Invertida ainda é desenhada, do menor para o maior: some seria pior, porque
  // é justamente o caso que precisa ser visto e corrigido.
  const [inicio, fim] = invertida ? [bruto[1], bruto[0]] : bruto;

  const left = (diasEntre(janela.inicio, inicio) / janela.dias) * 100;
  // +1 dia para a barra cobrir o próprio dia final, não parar no começo dele.
  const width = ((diasEntre(inicio, fim) + 1) / janela.dias) * 100;

  return {
    post: p,
    left: Math.max(0, left),
    width: Math.max(100 / janela.dias, Math.min(width, 100 - Math.max(0, left))),
    inicio, fim, pontual, invertida,
    folgaDias: pontual || invertida ? null : diasEntre(a!, b!),
  };
}

export type LinhaDaTimeline = { chave: string; label: string; barras: BarraTimeline[] };

/** Agrupa as barras por tipo ou por responsável. */
export function agruparBarras(
  posts: PostNaTimeline[],
  janela: Janela,
  por: "tipo" | "responsavel",
  ordemDosTipos: string[] = [],
): LinhaDaTimeline[] {
  const mapa = new Map<string, BarraTimeline[]>();
  for (const p of posts) {
    const barra = barraDoPost(p, janela);
    if (!barra) continue;
    const chave = por === "tipo" ? p.tipo : (p.responsavel || "— sem responsável");
    if (!mapa.has(chave)) mapa.set(chave, []);
    mapa.get(chave)!.push(barra);
  }

  const chaves = [...mapa.keys()].sort((a, b) => {
    if (por === "tipo") {
      const ia = ordemDosTipos.indexOf(a);
      const ib = ordemDosTipos.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    }
    // "sem responsável" por último: é pendência, não uma pessoa.
    if (a.startsWith("—")) return 1;
    if (b.startsWith("—")) return -1;
    return a.localeCompare(b, "pt-BR");
  });

  return chaves.map((chave) => ({
    chave,
    label: chave,
    barras: mapa.get(chave)!.sort((x, y) => x.inicio.localeCompare(y.inicio)),
  }));
}

/** Posts sem data nenhuma — não cabem na timeline, mas não podem sumir. */
export function semData(posts: PostNaTimeline[]): PostNaTimeline[] {
  return posts.filter((p) => !p.entrega && !p.postagem);
}

/**
 * Quantas entregas caem em cada semana.
 *
 * É o número que a timeline existe para mostrar: cinco entregas na mesma
 * quarta-feira é um problema de capacidade que nenhum kanban denuncia.
 */
export function cargaPorSemana(posts: PostNaTimeline[]): { semana: string; entregas: number }[] {
  const mapa = new Map<string, number>();
  for (const p of posts) {
    if (!p.entrega) continue;
    const d = asDate(p.entrega);
    const segunda = somarDias(p.entrega, -((d.getUTCDay() + 6) % 7));
    mapa.set(segunda, (mapa.get(segunda) ?? 0) + 1);
  }
  return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([semana, entregas]) => ({ semana, entregas }));
}

/**
 * Converte a data legada do post ("01/07") para ISO, usando o mês de
 * referência da linha editorial.
 *
 * Posts anteriores à migração 0066 guardam só esse texto, com `post_date_iso`
 * nulo. Eles aparecem no kanban (com o campo de data vazio) e sumiam da linha
 * do tempo — que só olha ISO. Para quem já tinha linhas editoriais, a timeline
 * nascia vazia mesmo com tudo planejado.
 *
 * `referenciaMes` vem como "AAAA-MM". A virada de ano é tratada: um post de
 * dezembro numa LE de janeiro pertence ao ano anterior.
 */
export function isoDaDataLegada(ddmmTexto: string | null | undefined, referenciaMes: string | null | undefined): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})$/.exec(String(ddmmTexto ?? "").trim());
  if (!m || !/^\d{4}-\d{2}$/.test(String(referenciaMes ?? ""))) return null;

  const dia = Number(m[1]);
  const mes = Number(m[2]);
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null;

  const anoRef = Number(referenciaMes!.slice(0, 4));
  const mesRef = Number(referenciaMes!.slice(5, 7));
  // Diferença grande entre o mês do post e o da LE = virada de ano.
  let ano = anoRef;
  if (mesRef - mes > 6) ano = anoRef + 1;
  else if (mes - mesRef > 6) ano = anoRef - 1;

  const iso = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  // Rejeita data que não existe (31/02 escrito à mão).
  const d = new Date(`${iso}T00:00:00Z`);
  return d.getUTCDate() === dia && d.getUTCMonth() + 1 === mes ? iso : null;
}
