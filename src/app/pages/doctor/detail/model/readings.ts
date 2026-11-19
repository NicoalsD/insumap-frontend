import type { ReadingViewModel } from '@/services/adapters/ReadingViewModelAdapter';
import { DAY_MS } from '../constants';
import { localTime } from './localTime';

/** A reading placed on the clinic's calendar, inside the selected window. */
export interface LocalReading {
  readonly valueMgDl: number;
  readonly dayKey: string;
  readonly hour: number;
  readonly minuteOfDay: number;
  readonly state: ReadingViewModel['state'];
  readonly source: ReadingViewModel['source'];
  readonly measuredAt: Date;
}

/**
 * Readings of the last `days` days ending at `periodEnd` (the API's period end, not the browser
 * clock, so the screen is stable), placed on the clinic's calendar. Readings outside the window
 * are dropped; the API already sends them newest first, and order does not matter here.
 */
export function readingsInWindow(
  readings: readonly ReadingViewModel[],
  options: { readonly periodEnd: Date; readonly days: number; readonly timeZone: string },
): LocalReading[] {
  const startMs = options.periodEnd.getTime() - options.days * DAY_MS;
  return readings
    .filter((reading) => {
      const at = reading.measuredAt.getTime();
      return at >= startMs && at <= options.periodEnd.getTime();
    })
    .map((reading) => {
      const local = localTime(reading.measuredAt, options.timeZone);
      return {
        valueMgDl: reading.valueMgDl,
        dayKey: local.dayKey,
        hour: local.hour,
        minuteOfDay: local.minuteOfDay,
        state: reading.state,
        source: reading.source,
        measuredAt: reading.measuredAt,
      };
    });
}
