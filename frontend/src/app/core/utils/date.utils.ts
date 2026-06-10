/**
 * Parses a date-only value (e.g. "2026-06-20") returned by the API into a
 * Date representing local midnight on that calendar day.
 *
 * The API may return plain "YYYY-MM-DD" strings or full ISO timestamps
 * (e.g. "2026-06-20T04:00:00.000Z") depending on how `pg` parses the
 * Postgres DATE column on the server's local timezone. Taking the date
 * portion before re-parsing with a bare time component avoids the
 * server-timezone vs. browser-timezone day-shift that otherwise causes
 * datepickers to display the day before (or after) the stored date.
 */
export function parseApiDate(value: string): Date {
  return new Date(value.split('T')[0] + 'T00:00:00');
}
