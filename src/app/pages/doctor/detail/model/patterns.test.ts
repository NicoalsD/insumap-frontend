import { describe, expect, it } from 'vitest';
import type { LocalReading } from './readings';
import { detectPatterns, type PatternRules } from './patterns';

/** A reading at a given local day and minute, with a value; the state is not used by the detector. */
function reading(dayKey: string, hour: number, minute: number, valueMgDl: number): LocalReading {
  return {
    valueMgDl,
    dayKey,
    hour,
    minuteOfDay: hour * 60 + minute,
    state: 'IN_RANGE',
    source: 'CGM',
    measuredAt: new Date(0),
  };
}

const NIGHT_RULES: PatternRules = {
  rangeLowMgDl: 70,
  postprandialMaxMgDl: 180,
  night: { start: '22:00', end: '06:00' },
};

describe('detectPatterns (pure, profile thresholds)', () => {
  it('reports a night hypoglycemia that repeats on enough days, and counts days, not readings', () => {
    const readings = [
      reading('2026-11-01', 3, 0, 60),
      reading('2026-11-01', 3, 15, 58),
      reading('2026-11-02', 2, 30, 62),
      reading('2026-11-03', 4, 0, 65),
      reading('2026-11-04', 12, 0, 65), // daytime low: not in the night window
      reading('2026-11-04', 3, 0, 100),
    ];
    expect(detectPatterns(readings, NIGHT_RULES)).toEqual([
      { kind: 'NIGHT_HYPO', days: 3, observedDays: 4 },
    ]);
  });

  it('does not report a night hypoglycemia that repeats on fewer days than the rule', () => {
    const readings = [reading('2026-11-01', 3, 0, 60), reading('2026-11-02', 3, 0, 60)];
    expect(detectPatterns(readings, NIGHT_RULES)).toEqual([]);
  });

  it('uses the profile low cut point: a value at the cut point is not a hypoglycemia', () => {
    const readings = ['2026-11-01', '2026-11-02', '2026-11-03'].map((day) => reading(day, 3, 0, 70));
    expect(detectPatterns(readings, NIGHT_RULES)).toEqual([]);
  });

  it('handles a night window that crosses midnight and excludes its end', () => {
    const readings = [
      reading('2026-11-01', 6, 0, 60), // the end is excluded
      reading('2026-11-02', 5, 59, 60),
      reading('2026-11-03', 23, 0, 60),
      reading('2026-11-04', 23, 0, 60),
      reading('2026-11-05', 23, 0, 60),
    ];
    expect(detectPatterns(readings, NIGHT_RULES)).toEqual([
      { kind: 'NIGHT_HYPO', days: 4, observedDays: 5 },
    ]);
  });

  it('turns the night pattern off when the profile has no night window', () => {
    const readings = ['2026-11-01', '2026-11-02', '2026-11-03'].map((day) => reading(day, 3, 0, 40));
    expect(detectPatterns(readings, { ...NIGHT_RULES, night: null })).toEqual([]);
  });

  it('groups consecutive repeating hours into one run and reports the busiest day count', () => {
    const readings: LocalReading[] = [];
    for (const day of ['2026-11-01', '2026-11-02', '2026-11-03']) {
      readings.push(reading(day, 13, 0, 210), reading(day, 14, 0, 200));
    }
    readings.push(reading('2026-11-04', 14, 0, 230)); // 14 h peaks on a 4th day: the run reports its busiest hour
    expect(detectPatterns(readings, NIGHT_RULES)).toEqual([
      { kind: 'REPEATED_HIGH_AT_HOUR', fromHour: 13, toHour: 14, days: 4, observedDays: 4 },
    ]);
  });

  it('reports separate runs for hours that do not touch', () => {
    const readings: LocalReading[] = [];
    for (const day of ['2026-11-01', '2026-11-02', '2026-11-03']) {
      readings.push(reading(day, 8, 0, 200), reading(day, 20, 0, 200));
    }
    expect(detectPatterns(readings, NIGHT_RULES)).toEqual([
      { kind: 'REPEATED_HIGH_AT_HOUR', fromHour: 8, toHour: 8, days: 3, observedDays: 3 },
      { kind: 'REPEATED_HIGH_AT_HOUR', fromHour: 20, toHour: 20, days: 3, observedDays: 3 },
    ]);
  });

  it('turns the postprandial pattern off when the profile has no postprandial maximum', () => {
    const readings: LocalReading[] = [];
    for (const day of ['2026-11-01', '2026-11-02', '2026-11-03']) readings.push(reading(day, 13, 0, 300));
    expect(detectPatterns(readings, { ...NIGHT_RULES, postprandialMaxMgDl: null })).toEqual([]);
  });

  it('returns nothing for no readings', () => {
    expect(detectPatterns([], NIGHT_RULES)).toEqual([]);
  });

  it('honours an explicit minimum of repeated days from the caller', () => {
    const readings = ['2026-11-01', '2026-11-02'].map((day) => reading(day, 3, 0, 60));
    expect(detectPatterns(readings, { ...NIGHT_RULES, minRepeatedDays: 2 })).toEqual([
      { kind: 'NIGHT_HYPO', days: 2, observedDays: 2 },
    ]);
  });
});
