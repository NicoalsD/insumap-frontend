import { es } from '@/i18n/es';
import type { GlucoseReadingDto } from '@/services/dto/clinical';
import type { ReadingFilter } from '../patientQueries';
import { dayKey, longDate } from '../patientFormat';

const ONE_DAY = 86_400_000;
const DAY_START = 'T00:00:00';
const DAY_END = 'T23:59:59.999';

/** Local calendar day to the instant range the API expects (`from` and `to`, ISO 8601 with zone). */
export function dayRange(from: string, to: string): ReadingFilter {
  return {
    from: from === '' ? undefined : new Date(`${from}${DAY_START}`).toISOString(),
    to: to === '' ? undefined : new Date(`${to}${DAY_END}`).toISOString(),
  };
}

export interface DayGroup {
  readonly key: string;
  readonly label: string;
  readonly items: readonly GlucoseReadingDto[];
}

/** Groups readings by calendar day in the clinic's time zone, newest day first. */
export function groupByDay(readings: readonly GlucoseReadingDto[], timeZone: string, now: Date): DayGroup[] {
  const today = dayKey(now, timeZone);
  const yesterday = dayKey(new Date(now.getTime() - ONE_DAY), timeZone);
  const groups = new Map<string, GlucoseReadingDto[]>();
  for (const reading of readings) {
    const key = dayKey(new Date(reading.measured_at), timeZone);
    groups.set(key, [...(groups.get(key) ?? []), reading]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([key, items]) => ({
      key,
      label:
        key === today
          ? es.patient.readings.today
          : key === yesterday
            ? es.patient.readings.yesterday
            : longDate(new Date(items[0]?.measured_at ?? now), timeZone),
      items,
    }));
}

