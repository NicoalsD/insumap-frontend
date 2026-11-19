import { HOURS_PER_DAY, MINUTES_PER_HOUR } from '../constants';

/** A moment seen on the clinic's wall clock: calendar day, hour and minute of the day. */
export interface LocalTime {
  /** `YYYY-MM-DD` in the clinic's time zone; sorts chronologically as a string. */
  readonly dayKey: string;
  readonly hour: number;
  readonly minuteOfDay: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    // en-CA gives numeric year-month-day parts; the text is never shown to the user.
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/** Local day, hour and minute of an instant in the clinic's time zone (`metrics.timezone`). */
export function localTime(date: Date, timeZone: string): LocalTime {
  const parts = new Map(formatterFor(timeZone).formatToParts(date).map((part) => [part.type, part.value]));
  const hour = Number(parts.get('hour')) % HOURS_PER_DAY;
  const minute = Number(parts.get('minute'));
  const dayKey = `${parts.get('year') ?? ''}-${parts.get('month') ?? ''}-${parts.get('day') ?? ''}`;
  return { dayKey, hour, minuteOfDay: hour * MINUTES_PER_HOUR + minute };
}

/** `"22:00"` to minutes after midnight. The profile sends times in this format (`night_start`, `night_end`). */
export function minutesOfTimeOfDay(value: string): number {
  const [hours = '0', minutes = '0'] = value.split(':');
  return Number(hours) * MINUTES_PER_HOUR + Number(minutes);
}
