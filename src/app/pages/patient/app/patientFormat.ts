import { LOCALE, format } from '@/i18n/format';
import { es } from '@/i18n/es';

const MINUTE_MS = 60_000;
const MINUTES_PER_HOUR_LOCAL = 60;
const HOURS_PER_DAY_LOCAL = 24;
const HOUR_MS = MINUTES_PER_HOUR_LOCAL * MINUTE_MS;
const DAY_MS = HOURS_PER_DAY_LOCAL * HOUR_MS;
const MORNING_UNTIL_HOUR = 12;
const AFTERNOON_UNTIL_HOUR = 18;

const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });

/** "hace 5 min", "hace 2 h", "ayer". Relative to `now`, never a timer inside the text. */
export function relativeTime(date: Date, now: Date): string {
  const diff = date.getTime() - now.getTime();
  const abs = Math.abs(diff);
  if (abs < MINUTE_MS) return relative.format(0, 'minute');
  if (abs < HOUR_MS) return relative.format(Math.round(diff / MINUTE_MS), 'minute');
  if (abs < DAY_MS) return relative.format(Math.round(diff / HOUR_MS), 'hour');
  return relative.format(Math.round(diff / DAY_MS), 'day');
}

/** Clock time in the clinic's time zone, `14:05`. */
export function clockTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone }).format(date);
}

/** Calendar day in the clinic's time zone, `2026-11-19`, used to group and compare days. */
export function dayKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone }).format(date);
}

/** Long date for headings, `19 de noviembre de 2026`. */
export function longDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric', timeZone }).format(date);
}

/** Hour of day (0 to 23) in the clinic's time zone, with fractional minutes. */
export function hourOfDay(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return (hour % HOURS_PER_DAY_LOCAL) + minute / MINUTES_PER_HOUR_LOCAL;
}

/** Greeting for the hour of the day, with the first name. */
export function greetingFor(now: Date, fullName: string): string {
  const name = fullName.trim().split(/\s+/)[0] ?? fullName;
  const hour = now.getHours();
  if (hour < MORNING_UNTIL_HOUR) return format(es.patient.greeting.morning, { name });
  if (hour < AFTERNOON_UNTIL_HOUR) return format(es.patient.greeting.afternoon, { name });
  return format(es.patient.greeting.evening, { name });
}

export const ONE_MINUTE_MS = MINUTE_MS;
export const ONE_DAY_MS = DAY_MS;
