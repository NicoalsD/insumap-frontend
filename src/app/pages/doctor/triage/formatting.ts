import { es } from '@/i18n/es';
import { LOCALE } from '@/i18n/format';

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MINUTES_PER_DAY = MINUTES_PER_HOUR * HOURS_PER_DAY;

/** Spanish label of an alert priority code; an unknown code shows as the API sent it. */
export function priorityLabel(code: string): string {
  const labels: Readonly<Record<string, string | undefined>> = es.doctor.priority;
  return labels[code] ?? code;
}

const relativeFormat = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'always', style: 'long' });

/** "hace 12 minutos", "hace 3 horas", "hace 2 días"; under a minute, "hace un momento". */
export function formatElapsed(from: Date, now: Date): string {
  const minutes = Math.max(0, Math.round((now.getTime() - from.getTime()) / MS_PER_MINUTE));
  if (minutes < 1) return es.doctor.relative.now;
  if (minutes < MINUTES_PER_HOUR) return relativeFormat.format(-minutes, 'minute');
  if (minutes < MINUTES_PER_DAY) return relativeFormat.format(-Math.floor(minutes / MINUTES_PER_HOUR), 'hour');
  return relativeFormat.format(-Math.floor(minutes / MINUTES_PER_DAY), 'day');
}

/** Clock time in the clinic's time zone (`metrics.timezone` from the API), for example "14:05". */
export function formatClock(date: Date, timezone: string | undefined): string {
  return new Intl.DateTimeFormat(LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  }).format(date);
}

/** Date and time in the clinic's zone, for the alerts table. */
export function formatDateTime(date: Date, timezone: string | undefined): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  }).format(date);
}
