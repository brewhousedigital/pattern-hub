import dayjs, { type Dayjs } from 'dayjs';

// PocketBase returns UTC timestamps as "YYYY-MM-DD HH:mm:ss.SSSZ" (space-separated,
// not the 'T' ISO-8601 separator) - Safari/Firefox reject that form, so normalize
// before handing it to dayjs/Date. Shared by createPrettyDate below and anything
// that needs the parsed value itself (e.g. bucketing records by day/month/year).
export const parsePbDate = (date: string): Dayjs => dayjs(date.replace(' ', 'T'));

export const createPrettyDate = (date: string | Date | Dayjs) => {
  if (!date) {
    return 'No Date Selected';
  }

  // PocketBase returns UTC timestamps as "YYYY-MM-DD HH:mm:ss.SSSZ" (space-separated).
  // Normalize the date/time space to 'T' so it parses as a proper ISO-8601 UTC instant
  // in every browser (Safari/Firefox reject the space form), then dayjs formats it in
  // the viewer's local timezone.
  const normalized = typeof date === 'string' ? date.replace(' ', 'T') : date;
  const parsed = dayjs(normalized);

  return parsed.isValid() ? parsed.format('MMM DD, YYYY') : 'No Date Selected';
};

// ─── Calendar dates (a day, with no time) ─────────────────────────────────────
// PocketBase has no date-only field. A calendar date is saved as midnight UTC
// ("YYYY-MM-DD 00:00:00.000Z"), and only its "YYYY-MM-DD" part is read back.
// The date then shows the same day for every viewer, on the server and in the
// browser. createPrettyDate above moves the day for viewers in other time zones.

/** PocketBase date string -> Dayjs for that calendar day. Returns null when the value is empty or not valid. */
export const parsePbCalendarDate = (value?: string | null): Dayjs | null => {
  const day = value?.slice(0, 10);
  if (!day) return null;

  const parsed = dayjs(day);
  return parsed.isValid() ? parsed : null;
};

/** Dayjs -> PocketBase date string for that calendar day, at midnight UTC. */
export const toPbCalendarDate = (date: Dayjs): string => `${date.format('YYYY-MM-DD')} 00:00:00.000Z`;

/** PocketBase date string -> text such as "September 12, 2026". Returns "" when the value is empty or not valid. */
export const createPrettyCalendarDate = (value?: string | null, format = 'MMMM D, YYYY'): string =>
  parsePbCalendarDate(value)?.format(format) ?? '';
