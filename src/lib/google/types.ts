/** Tipos client-safe do Google Calendar (compartilhados server/cliente). */

export type GoogleEvent = {
  id: string;
  summary: string;
  description?: string;
  start?: string; // ISO
  end?: string; // ISO
  allDay: boolean;
  hangoutLink?: string;
  htmlLink?: string;
  attendees: string[];
  location?: string;
};

export type GoogleStatus = {
  connected: boolean;
  email?: string;
  calendarId?: string;
};
