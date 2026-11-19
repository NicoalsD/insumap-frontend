import { describe, expect, it } from 'vitest';
import { localTime, minutesOfTimeOfDay } from './localTime';

describe('localTime', () => {
  it('places an instant on the clinic calendar, not on UTC', () => {
    // 03:30 UTC on 2 Nov is 22:30 on 1 Nov in America/Bogota (UTC-5, no daylight saving).
    const local = localTime(new Date('2026-11-02T03:30:00Z'), 'America/Bogota');
    expect(local).toEqual({ dayKey: '2026-11-01', hour: 22, minuteOfDay: 22 * 60 + 30 });
  });

  it('never reports hour 24 at midnight', () => {
    const local = localTime(new Date('2026-11-02T05:00:00Z'), 'America/Bogota');
    expect(local.hour).toBe(0);
    expect(local.dayKey).toBe('2026-11-02');
  });
});

describe('minutesOfTimeOfDay', () => {
  it('reads HH:MM as minutes after midnight', () => {
    expect(minutesOfTimeOfDay('22:00')).toBe(22 * 60);
    expect(minutesOfTimeOfDay('06:15')).toBe(6 * 60 + 15);
  });
});
