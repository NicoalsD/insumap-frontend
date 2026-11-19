import { describe, expect, it } from 'vitest';
import { detailCharts } from './detailCharts';
import { PatientAgpStrategy, type AgpInputBin } from './PatientAgpStrategy';

function bin(timeOfDay: string, p50: number): AgpInputBin {
  return { time_of_day: timeOfDay, p5: p50 - 40, p25: p50 - 15, p50, p75: p50 + 15, p95: p50 + 40 };
}

const target = { low: 70, high: 180 };

describe('PatientAgpStrategy (P19)', () => {
  it('is registered in the detail renderer', () => {
    expect(detailCharts.has(PatientAgpStrategy.KIND)).toBe(true);
  });

  it('returns empty when the data is insufficient, even with bins', () => {
    const model = detailCharts.render(PatientAgpStrategy.KIND, {
      bins: [bin('00:00', 120)],
      target,
      isSufficient: false,
    });
    expect(model).toEqual({ status: 'empty' });
  });

  it('sorts the bins by time of day and places them across the box', () => {
    const model = detailCharts.render(PatientAgpStrategy.KIND, {
      bins: [bin('12:00', 150), bin('00:00', 100), bin('06:00', 120)],
      target,
      isSufficient: true,
    });
    if (model.status !== 'ok') throw new Error('ok model expected');
    expect(model.points.map((point) => point.timeOfDay)).toEqual(['00:00', '06:00', '12:00']);
    expect(model.points.map((point) => point.x)).toEqual([0, 0.5, 1]);
  });

  it('closes the bands and keeps the target range inside the data domain', () => {
    const model = detailCharts.render(PatientAgpStrategy.KIND, {
      bins: [bin('00:00', 120), bin('12:00', 130)],
      target,
      isSufficient: true,
    });
    if (model.status !== 'ok') throw new Error('ok model expected');
    expect(model.outerBand).toHaveLength(4);
    expect(model.innerBand).toHaveLength(4);
    expect(model.domain).toEqual({ min: 70, max: 180 });
    expect(model.targetTopY).toBeLessThan(model.targetBottomY);
  });

  it('marks each tick hour once, on the full hour, even with quarter-hour bins', () => {
    const bins = Array.from({ length: 96 }, (_, index) => {
      const minutes = index * 15;
      const time = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
      return bin(time, 120);
    });
    const model = detailCharts.render(PatientAgpStrategy.KIND, { bins, target, isSufficient: true });
    if (model.status !== 'ok') throw new Error('ok model expected');
    expect(model.ticks.map((tick) => tick.hour)).toEqual([0, 6, 12, 18]);
  });
});
