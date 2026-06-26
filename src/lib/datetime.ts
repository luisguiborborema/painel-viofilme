/**
 * Helpers de data/hora em pt-BR, baseados em UTC (determinístico para SSR).
 */

const MESES_ABBR = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

const DIAS = [
  "Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado",
];

function parts(iso: string) {
  const d = new Date(iso);
  return {
    y: d.getUTCFullYear(),
    m: d.getUTCMonth(),
    day: d.getUTCDate(),
    h: d.getUTCHours(),
    min: d.getUTCMinutes(),
    wd: d.getUTCDay(),
  };
}

/** "19h" ou "14h30". */
export function timeLabel(iso: string): string {
  const { h, min } = parts(iso);
  return min === 0 ? `${h}h` : `${h}h${String(min).padStart(2, "0")}`;
}

/** "19h00" / "14h30" (sempre com minutos). */
export function clockLabel(iso: string): string {
  const { h, min } = parts(iso);
  return `${h}h${String(min).padStart(2, "0")}`;
}

/** "hoje às 19h" · "amanhã às 12h" · "26 jun às 18h". */
export function relativePostLabel(iso: string, refIso: string): string {
  const a = parts(iso);
  const r = parts(refIso);
  const dayDiff = Math.round(
    (Date.UTC(a.y, a.m, a.day) - Date.UTC(r.y, r.m, r.day)) / 86400000,
  );
  let dayPart: string;
  if (dayDiff === 0) dayPart = "hoje";
  else if (dayDiff === 1) dayPart = "amanhã";
  else dayPart = `${a.day} ${MESES_ABBR[a.m]}`;
  return `${dayPart} às ${timeLabel(iso)}`;
}

/** "hoje às 19h00" · "amanhã às 12h00" · "26/06 às 18h00". */
export function publicationLabel(iso: string, refIso: string): string {
  const a = parts(iso);
  const r = parts(refIso);
  const dayDiff = Math.round(
    (Date.UTC(a.y, a.m, a.day) - Date.UTC(r.y, r.m, r.day)) / 86400000,
  );
  let dayPart: string;
  if (dayDiff === 0) dayPart = "hoje";
  else if (dayDiff === 1) dayPart = "amanhã";
  else dayPart = dayMonth(iso);
  return `${dayPart} às ${clockLabel(iso)}`;
}

/** "15/06". */
export function dayMonth(iso: string): string {
  const { day, m } = parts(iso);
  return `${String(day).padStart(2, "0")}/${String(m + 1).padStart(2, "0")}`;
}

/** "Quinta, 26 jun · 10h00". */
export function meetingLabel(iso: string): string {
  const { day, m, wd } = parts(iso);
  return `${DIAS[wd]}, ${day} ${MESES_ABBR[m]} · ${clockLabel(iso)}`;
}
