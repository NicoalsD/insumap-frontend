import { describe, expect, it } from 'vitest';
import { assertValidThresholds, classifyGlucose, rangeBounds, type GlucoseThresholds } from './thresholds';

// Test-only profile; real values always come from the API target profile.
const t: GlucoseThresholds = { veryLowMgDl: 54, rangeLowMgDl: 70, rangeHighMgDl: 180, veryHighMgDl: 250 };

describe('classifyGlucose', () => {
  it.each([
    [40, 'VERY_LOW'],
    [53, 'VERY_LOW'],
    [54, 'LOW'],
    [69, 'LOW'],
    [70, 'IN_RANGE'],
    [180, 'IN_RANGE'],
    [181, 'HIGH'],
    [250, 'HIGH'],
    [251, 'VERY_HIGH'],
  ] as const)('classifies %s mg/dL as %s', (value, state) => {
    expect(classifyGlucose(value, t)).toBe(state);
  });

  it('follows a different profile without code changes', () => {
    const pregnancy = { ...t, rangeLowMgDl: 63, rangeHighMgDl: 140 };
    expect(classifyGlucose(150, pregnancy)).toBe('HIGH');
    expect(classifyGlucose(65, pregnancy)).toBe('IN_RANGE');
  });
});

describe('assertValidThresholds', () => {
  it('accepts ascending cut points', () => {
    expect(() => {
      assertValidThresholds(t);
    }).not.toThrow();
  });

  it('rejects unordered or non-finite cut points', () => {
    expect(() => {
      assertValidThresholds({ ...t, rangeLowMgDl: 300 });
    }).toThrow();
    expect(() => {
      assertValidThresholds({ ...t, veryHighMgDl: Number.NaN });
    }).toThrow();
  });
});

describe('rangeBounds', () => {
  it('returns five contiguous states with open ends', () => {
    const bounds = rangeBounds(t);
    expect(bounds.map((b) => b.state)).toEqual(['VERY_LOW', 'LOW', 'IN_RANGE', 'HIGH', 'VERY_HIGH']);
    expect(bounds[0]?.minMgDl).toBeNull();
    expect(bounds[4]?.maxMgDl).toBeNull();
    expect(bounds[2]).toEqual({ state: 'IN_RANGE', minMgDl: 70, maxMgDl: 180 });
  });
});
