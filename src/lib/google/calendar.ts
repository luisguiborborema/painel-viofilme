/**
 * Chamadas ao Google Calendar (server-only). Usa o access token válido da
 * conexão única da agência.
 */
import { getValidAccess } from "./client";
import type { GoogleEvent } from "./types";

const API = "https://www.googleapis.com/calendar/v3";

type RawEvent = {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  hangoutLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { email?: string }[];
};

function mapEvent(e: RawEvent): GoogleEvent {
  const allDay = !e.start?.dateTime;
  return {
    id: e.id,
    summary: e.summary ?? "(sem título)",
    description: e.description,
    start: e.start?.dateTime ?? e.start?.date,
    end: e.end?.dateTime ?? e.end?.date,
    allDay,
    hangoutLink: e.hangoutLink,
    htmlLink: e.htmlLink,
    location: e.location,
    attendees: (e.attendees ?? []).map((a) => a.email ?? "").filter(Boolean),
  };
}

export type GoogleCalendarInfo = {
  id: string;
  summary: string;
  primary: boolean;
  color?: string;
};

/** Lista os calendários da conta conectada. */
export async function listCalendars(): Promise<GoogleCalendarInfo[]> {
  const access = await getValidAccess();
  if (!access) return [];
  try {
    const res = await fetch(`${API}/users/me/calendarList?minAccessRole=writer`, {
      headers: { Authorization: `Bearer ${access.token}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.items ?? []).map(
      (c: { id: string; summary?: string; primary?: boolean; backgroundColor?: string }) => ({
        id: c.id,
        summary: c.summary ?? c.id,
        primary: !!c.primary,
        color: c.backgroundColor,
      }),
    );
  } catch {
    return [];
  }
}

async function eventsFromCalendar(
  token: string,
  calendarId: string,
  maxResults: number,
  opts?: { timeMin?: string; timeMax?: string },
): Promise<GoogleEvent[]> {
  const url = new URL(`${API}/calendars/${encodeURIComponent(calendarId)}/events`);
  url.searchParams.set("timeMin", opts?.timeMin ?? new Date().toISOString());
  if (opts?.timeMax) url.searchParams.set("timeMax", opts.timeMax);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", String(maxResults));
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.items ?? []).map(mapEvent);
  } catch {
    return [];
  }
}

/** Próximos eventos, agregando os calendários selecionados para leitura. */
export async function listUpcomingEvents(
  maxResults = 10,
  opts?: { timeMin?: string; timeMax?: string },
): Promise<GoogleEvent[]> {
  const access = await getValidAccess();
  if (!access) return [];
  const lists = await Promise.all(
    access.readCalendarIds.map((cal) =>
      eventsFromCalendar(access.token, cal, maxResults, opts),
    ),
  );
  return lists
    .flat()
    .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""))
    .slice(0, maxResults);
}

export type CreateEventResult = { event?: GoogleEvent; error?: string };

/**
 * Cria um evento no calendário de escrita. O Google Meet é best-effort: se a
 * criação com conferência falhar, tenta novamente sem Meet. Devolve o evento
 * ou uma mensagem de erro (para exibir no painel).
 */
export async function createEvent(input: {
  summary: string;
  description?: string;
  startIso: string;
  endIso: string;
  attendees?: string[];
  addMeet?: boolean;
}): Promise<CreateEventResult> {
  const access = await getValidAccess();
  if (!access) return { error: "Google não conectado." };

  const baseBody: Record<string, unknown> = {
    summary: input.summary,
    description: input.description,
    start: { dateTime: input.startIso, timeZone: "America/Sao_Paulo" },
    end: { dateTime: input.endIso, timeZone: "America/Sao_Paulo" },
  };
  if (input.attendees?.length) {
    baseBody.attendees = input.attendees.map((email) => ({ email }));
  }

  async function attempt(withMeet: boolean): Promise<{ ok: boolean; status: number; json: unknown; text: string }> {
    const url = new URL(`${API}/calendars/${encodeURIComponent(access!.calendarId)}/events`);
    if (withMeet) url.searchParams.set("conferenceDataVersion", "1");
    const body = { ...baseBody };
    if (withMeet) {
      body.conferenceData = {
        createRequest: {
          requestId: `vio-${Date.parse(input.startIso)}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      };
    }
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access!.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* mantém text */
    }
    return { ok: res.ok, status: res.status, json, text };
  }

  try {
    let r = await attempt(!!input.addMeet);
    // Se falhou COM Meet, tenta sem (contas que não permitem conferência via API).
    if (!r.ok && input.addMeet) {
      r = await attempt(false);
    }
    if (!r.ok) {
      const msg =
        (r.json as { error?: { message?: string } })?.error?.message ?? r.text.slice(0, 200);
      return { error: `Google ${r.status}: ${msg}` };
    }
    return { event: mapEvent(r.json as RawEvent) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "erro de rede" };
  }
}
