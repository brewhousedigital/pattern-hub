import dayjs, { type Dayjs } from 'dayjs';

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
