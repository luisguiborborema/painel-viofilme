/**
 * Unificação da agenda: eventos do painel + eventos do Google.
 *
 * As duas fontes gravam horário em formatos diferentes. `calendar_events` vem
 * do Postgres como `"2026-09-14 21:00:00+00"` — com **espaço**. O Google vem em
 * ISO 8601, `"2026-09-14T09:00:00-03:00"` — com **T**.
 *
 * Comparar isso como texto ordena pelo separador antes de chegar na hora: o
 * espaço vence o "T", e todo evento do painel sobe para o topo do dia
 * independentemente do horário. Era por isso que a reunião das 21:00 aparecia
 * acima das de 09:00 no "Meu dia".
 *
 * A tela de Agenda já fazia certo (`Date.parse` numérico e dedupe por
 * `googleEventId`); o "Meu dia" fazia errado nas duas coisas. Isto aqui existe
 * para as duas telas não voltarem a divergir.
 *
 * Client-safe: só funções puras.
 */

/**
 * Instante em milissegundos, aceitando os dois formatos.
 *
 * Sem horário reconhecível devolve `Infinity` em vez de `NaN`: `NaN` em
 * comparação de sort devolve sempre `false` e deixa a lista em ordem
 * imprevisível, enquanto `Infinity` manda o item para o fim, que é onde um
 * evento sem hora deve ficar.
 */
export function instanteDe(valor: string | null | undefined): number {
  const s = String(valor ?? "").trim();
  if (!s) return Infinity;

  // O parser do motor é tolerante e aceita formatos não-ISO que o Postgres
  // produz (espaço no lugar do "T", fuso `+00` sem minutos). Tentar primeiro
  // sem mexer evita quebrar o que já funcionava.
  const direto = Date.parse(s);
  if (Number.isFinite(direto)) return direto;

  // Só se falhar: normaliza para ISO. `+00` vira `+00:00`, senão não é válido.
  const norm = Date.parse(s.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00"));
  return Number.isFinite(norm) ? norm : Infinity;
}

/** Comparador por instante. Use no lugar de `localeCompare` em data. */
export function porInstante<T>(pegar: (x: T) => string | null | undefined) {
  return (a: T, b: T) => instanteDe(pegar(a)) - instanteDe(pegar(b));
}

/**
 * Ids do Google que já têm par local.
 *
 * Reunião criada pelo painel é gravada aqui e espelhada no Google. Sem isto,
 * as duas cópias aparecem lado a lado e o contador de "reuniões hoje" conta
 * cada compromisso duas vezes.
 */
export function idsGoogleVinculados(locais: { googleEventId?: string | null }[]): Set<string> {
  return new Set((locais ?? []).map((e) => e.googleEventId).filter(Boolean) as string[]);
}

export type EventoDoDia = { id: string; title: string; start: string; link?: string };

type Local = { id: string; title: string; startAt: string; meetLink?: string; googleEventId?: string | null };
type DoGoogle = { id?: string; summary?: string; start?: string; allDay?: boolean; hangoutLink?: string; htmlLink?: string };

/**
 * Junta as duas fontes num dia: sem duplicata, em ordem de horário.
 *
 * Evento de dia inteiro fica de fora — "Reuniões hoje" contando um feriado
 * como reunião é pior que não mostrá-lo, e ele apareceria com hora inventada.
 */
export function reunioesDoDia(locais: Local[], google: DoGoogle[]): EventoDoDia[] {
  const vinculados = idsGoogleVinculados(locais);
  const proprios: EventoDoDia[] = (locais ?? []).map((e) => ({
    id: `o-${e.id}`,
    title: e.title,
    start: e.startAt,
    link: e.meetLink,
  }));
  // O Google é consultado em vários calendários e as listas são concatenadas.
  // Um compromisso que existe em dois deles (o próprio e o do time, por
  // exemplo) volta duas vezes com o mesmo id.
  const vistos = new Set<string>();
  const externos: EventoDoDia[] = (google ?? [])
    .filter((e) => {
      if (!e.start || e.allDay) return false;
      if (e.id && vinculados.has(e.id)) return false;
      if (e.id) {
        if (vistos.has(e.id)) return false;
        vistos.add(e.id);
      }
      return true;
    })
    .map((e, i) => ({
      id: `g-${e.id ?? i}`,
      title: e.summary || "(sem título)",
      start: e.start as string,
      link: e.hangoutLink ?? e.htmlLink,
    }));
  return [...proprios, ...externos].filter((e) => e.start).sort(porInstante((e) => e.start));
}
