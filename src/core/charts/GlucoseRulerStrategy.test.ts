import { describe, expect, it } from 'vitest';
import { rulerPosition, rulerValue } from './GlucoseRulerStrategy';

describe('ruler position and value', () => {
  const t = { veryLowMgDl: 54, rangeLowMgDl: 70, rangeHighMgDl: 180, veryHighMgDl: 250 };

  it('gives each band a fifth of the ruler, whatever its width in mg/dL', () => {
    expect(rulerPosition(54, t)).toBe(20);
    expect(rulerPosition(70, t)).toBe(40);
    expect(rulerPosition(180, t)).toBe(60);
    expect(rulerPosition(250, t)).toBe(80);
    expect(rulerPosition(10, t)).toBe(0);
    expect(rulerPosition(900, t)).toBe(100);
  });

  it('turns a position back into the same mg/dL', () => {
    for (const value of [40, 54, 62, 70, 125, 180, 200, 250, 300]) {
      expect(rulerValue(rulerPosition(value, t), t)).toBe(value);
    }
  });
});
