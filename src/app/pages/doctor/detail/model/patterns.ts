import { PATTERN_MIN_REPEATED_DAYS } from '../constants';
import { minutesOfTimeOfDay } from './localTime';
import type { LocalReading } from './readings';

/**
 * Cut points of the patient's target profile. Every clinical number the detector uses comes from
 * here; a field the profile does not carry turns its pattern off instead of falling back to a value
 * in the code.
 */
export interface PatternRules {
  /** Values below this are hypoglycemia (the profile's `range_low_mg_dl`). */
  readonly rangeLowMgDl: number;
  /** Values above this, after a meal, are high (the profile's `postprandial_max_mg_dl`), or null. */
  readonly postprandialMaxMgDl: number | null;
  /** Night window (`night_start`, `night_end`, `HH:MM`); a window that crosses midnight is allowed. */
  readonly night: { readonly start: string; readonly end: string } | null;
  /** Days a pattern must repeat on. Defaults to `PATTERN_MIN_REPEATED_DAYS`. */
  readonly minRepeatedDays?: number;
}

export type DetectedPattern =
  | {
      readonly kind: 'NIGHT_HYPO';
      /** Days with at least one value below the cut point inside the night window. */
      readonly days: number;
      readonly observedDays: number;
    }
  | {
      readonly kind: 'REPEATED_HIGH_AT_HOUR';
      /** First and last hour (inclusive) of a run of consecutive hours where the pattern repeats. */
      readonly fromHour: number;
      readonly toHour: number;
      /** Days on which the busiest hour of the run was above the cut point. */
      readonly days: number;
      readonly observedDays: number;
    };

function inNightWindow(minuteOfDay: number, start: number, end: number): boolean {
  if (start === end) return false;
  return start < end ? minuteOfDay >= start && minuteOfDay < end : minuteOfDay >= start || minuteOfDay < end;
}

/**
 * Patterns that repeat across days, found with the profile's cut points. Pure: no React, no clock.
 *
 * - `NIGHT_HYPO`: several days with a value below the low cut point inside the night window.
 * - `REPEATED_HIGH_AT_HOUR`: runs of consecutive clock hours where, on enough days, a value above
 *   the postprandial maximum appears. Repeated peaks at the same hour are the postprandial signal.
 *
 * Pattern: none (plain function; tested in patterns.test.ts).
 */
export function detectPatterns(readings: readonly LocalReading[], rules: PatternRules): DetectedPattern[] {
  const minRepeatedDays = rules.minRepeatedDays ?? PATTERN_MIN_REPEATED_DAYS;
  const observedDays = new Set(readings.map((reading) => reading.dayKey)).size;
  const patterns: DetectedPattern[] = [];

  if (rules.night) {
    const start = minutesOfTimeOfDay(rules.night.start);
    const end = minutesOfTimeOfDay(rules.night.end);
    const hypoDays = new Set(
      readings
        .filter(
          (reading) =>
            reading.valueMgDl < rules.rangeLowMgDl && inNightWindow(reading.minuteOfDay, start, end),
        )
        .map((reading) => reading.dayKey),
    );
    if (hypoDays.size >= minRepeatedDays) {
      patterns.push({ kind: 'NIGHT_HYPO', days: hypoDays.size, observedDays });
    }
  }

  if (rules.postprandialMaxMgDl !== null) {
    const cut = rules.postprandialMaxMgDl;
    const daysByHour = new Map<number, Set<string>>();
    for (const reading of readings) {
      if (reading.valueMgDl <= cut) continue;
      const days = daysByHour.get(reading.hour) ?? new Set<string>();
      days.add(reading.dayKey);
      daysByHour.set(reading.hour, days);
    }
    const repeatingHours = [...daysByHour.keys()]
      .filter((hour) => (daysByHour.get(hour)?.size ?? 0) >= minRepeatedDays)
      .sort((a, b) => a - b);

    let run: { fromHour: number; toHour: number; days: number } | null = null;
    for (const hour of repeatingHours) {
      const days = daysByHour.get(hour)?.size ?? 0;
      if (run && hour === run.toHour + 1) {
        run = { fromHour: run.fromHour, toHour: hour, days: Math.max(run.days, days) };
      } else {
        if (run) patterns.push({ kind: 'REPEATED_HIGH_AT_HOUR', ...run, observedDays });
        run = { fromHour: hour, toHour: hour, days };
      }
    }
    if (run) patterns.push({ kind: 'REPEATED_HIGH_AT_HOUR', ...run, observedDays });
  }

  return patterns;
}
