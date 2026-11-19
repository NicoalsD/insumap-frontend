import { describe, expect, it } from 'vitest';
import { FIELD_LIMITS } from '@/mocks/fixtures/people';
import { buildReadingBody, checkValueText, checkWhen, needsUrgentNotice, stateOf } from './recordingModel';

const thresholds = {
  veryLowMgDl: 54,
  rangeLowMgDl: 70,
  rangeHighMgDl: 180,
  veryHighMgDl: 250,
};

describe('checkValueText', () => {
  it('accepts whole numbers inside the API limits', () => {
    expect(checkValueText('132', FIELD_LIMITS)).toEqual({ ok: true, value: 132 });
  });

  it('asks for a value, and rejects decimals and letters', () => {
    expect(checkValueText('  ', FIELD_LIMITS)).toMatchObject({ ok: false });
    expect(checkValueText('12.5', FIELD_LIMITS)).toMatchObject({ ok: false });
    expect(checkValueText('abc', FIELD_LIMITS)).toMatchObject({ ok: false });
  });

  it('refuses values outside the limits the API publishes', () => {
    const low = checkValueText('5', FIELD_LIMITS);
    const high = checkValueText('9999', FIELD_LIMITS);
    expect(low.ok).toBe(false);
    expect(high.ok).toBe(false);
    if (!low.ok) expect(low.error).toContain('20');
  });
});

describe('checkWhen', () => {
  const now = new Date('2026-11-19T15:00:00.000Z');

  it('uses the instant of the screen when the patient chose now', () => {
    expect(checkWhen('now', '', now, FIELD_LIMITS)).toEqual({ ok: true, measuredAt: now.toISOString() });
  });

  it('refuses a missing, future or too old picked time', () => {
    expect(checkWhen('pick', '', now, FIELD_LIMITS)).toMatchObject({ ok: false });
    expect(checkWhen('pick', '2026-11-19T18:00', now, FIELD_LIMITS)).toMatchObject({ ok: false });
    expect(checkWhen('pick', '2026-10-01T08:00', now, FIELD_LIMITS)).toMatchObject({ ok: false });
  });
});

describe('buildReadingBody', () => {
  it('builds the POST body that readingCreateSchema accepts', () => {
    const body = buildReadingBody({
      clientReadingId: 'c-1',
      valueMgDl: 132,
      measuredAt: '2026-11-19T15:00:00.000Z',
      context: 'FASTING',
      limits: FIELD_LIMITS,
    });
    expect(body).toEqual({
      client_reading_id: 'c-1',
      value_mg_dl: 132,
      measured_at: '2026-11-19T15:00:00.000Z',
      source: 'MANUAL',
      context: 'FASTING',
    });
  });

  it('flags only the very low and very high states for the doctor notice', () => {
    expect(needsUrgentNotice(stateOf(45, thresholds))).toBe(true);
    expect(needsUrgentNotice(stateOf(300, thresholds))).toBe(true);
    expect(needsUrgentNotice(stateOf(120, thresholds))).toBe(false);
  });
});
