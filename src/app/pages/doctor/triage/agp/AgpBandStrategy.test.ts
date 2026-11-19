import { describe, expect, it } from 'vitest';
import { AgpBandStrategy, type AgpBin } from './AgpBandStrategy';

const strategy = new AgpBandStrategy();

function bins(count: number): AgpBin[] {
  return Array.from({ length: count }, (_, index) => {
    const hour = String(index).padStart(2, '0');
    return { time_of_day: `${hour}:00`, p5: 60, p25: 90 + index, p50: 120 + index, p75: 150 + index, p95: 220 };
  });
}

describe('AgpBandStrategy (P19 Strategy)', () => {
  it('draws nothing when the data is insufficient or empty', () => {
    expect(strategy.render({ bins: bins(24), targetLowMgDl: 70, targetHighMgDl: 180, isSufficient: false })).toEqual({
      status: 'empty',
    });
    expect(strategy.render({ bins: [], targetLowMgDl: 70, targetHighMgDl: 180, isSufficient: true })).toEqual({
      status: 'empty',
    });
  });

  it('places the median and the 25 to 75 band inside a 0 to 1 box, top is high glucose', () => {
    const model = strategy.render({ bins: bins(24), targetLowMgDl: 70, targetHighMgDl: 180, isSufficient: true });
    expect(model.status).toBe('ok');
    if (model.status !== 'ok') return;
    expect(model.median).toHaveLength(24);
    expect(model.median[0]?.x).toBe(0);
    expect(model.median.at(-1)?.x).toBe(1);
    for (const point of [...model.median, ...model.band]) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(1);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(1);
    }
    // The 75th percentile is above the 25th: the band polygon is closed on both sides.
    expect(model.band).toHaveLength(48);
    expect(model.band[0]?.y).toBeLessThan(model.band[47]?.y ?? 0);
  });

  it('marks the target range on the same scale and labels every sixth hour', () => {
    const model = strategy.render({ bins: bins(24), targetLowMgDl: 70, targetHighMgDl: 180, isSufficient: true });
    if (model.status !== 'ok') throw new Error('expected a drawn chart');
    expect(model.targetTopY).toBeLessThan(model.targetBottomY);
    expect(model.ticks.map((tick) => tick.hour)).toEqual([0, 6, 12, 18]);
    expect(model.domain.min).toBe(60);
    expect(model.domain.max).toBe(220);
  });

  it('sorts bins by time of day before drawing', () => {
    const shuffled = [...bins(24)].reverse();
    const model = strategy.render({ bins: shuffled, targetLowMgDl: 70, targetHighMgDl: 180, isSufficient: true });
    if (model.status !== 'ok') throw new Error('expected a drawn chart');
    expect(model.ticks[0]?.hour).toBe(0);
  });

  it('labels each whole hour once, even when the profile has quarter-hour bins', () => {
    const quarters: AgpBin[] = Array.from({ length: 96 }, (_, index) => {
      const hour = String(Math.floor(index / 4)).padStart(2, '0');
      const minute = String((index % 4) * 15).padStart(2, '0');
      return { time_of_day: `${hour}:${minute}`, p5: 60, p25: 90, p50: 120, p75: 150, p95: 220 };
    });
    const model = strategy.render({ bins: quarters, targetLowMgDl: 70, targetHighMgDl: 180, isSufficient: true });
    if (model.status !== 'ok') throw new Error('expected a drawn chart');
    expect(model.ticks.map((tick) => tick.hour)).toEqual([0, 6, 12, 18]);
    expect(new Set(model.ticks.map((tick) => tick.x)).size).toBe(model.ticks.length);
  });
});
