import { LOCALE } from '@/i18n/format';

const dateTime = (timeZone: string) =>
  new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone });
const clock = (timeZone: string) => new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit', timeZone });
const dayLabel = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const formatters = new Map<string, { dateTime: Intl.DateTimeFormat; clock: Intl.DateTimeFormat }>();

function formattersFor(timeZone: string) {
  let found = formatters.get(timeZone);
  if (!found) {
    found = { dateTime: dateTime(timeZone), clock: clock(timeZone) };
    formatters.set(timeZone, found);
  }
  return found;
}

/** "14 nov, 08:30" in the clinic's time zone. */
export function formatDateTime(date: Date, timeZone: string): string {
  return formattersFor(timeZone).dateTime.format(date);
}

/** "08:30" in the clinic's time zone. */
export function formatClockTime(date: Date, timeZone: string): string {
  return formattersFor(timeZone).clock.format(date);
}

/** Label of a `YYYY-MM-DD` day key, for example "vie. 14 nov.". Noon UTC keeps the calendar day stable. */
export function formatDayKey(dayKey: string): string {
  return dayLabel.format(new Date(`${dayKey}T12:00:00Z`));
}
