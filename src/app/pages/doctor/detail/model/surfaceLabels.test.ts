import { describe, expect, it } from 'vitest';
import { buildSurfaceLabels } from './surfaceLabels';
import type { SurfaceGrid } from './surface';

const grid: SurfaceGrid = {
  dayKeys: ['2026-11-01', '2026-11-02', '2026-11-03'],
  cells: [],
  min: 50,
  max: 250,
};

const text = {
  hour: (hour: number) => `${hour} h`,
  day: (key: string) => `día ${key}`,
  value: (value: number) => `${value} mg/dL`,
  hourAxis: 'Hora del día',
  dayAxis: 'Día',
  target: 'Rango objetivo',
};

describe('buildSurfaceLabels', () => {
  const labels = buildSurfaceLabels({
    grid,
    cellSpacing: 0.25,
    target: { low: 70, high: 180 },
    heightOf: (value) => value / 100,
    text,
    offset: 0.3,
  });

  it('labels the hours 0, 6, 12, 18 and 24 h along the floor', () => {
    const hours = labels.filter((label) => label.kind === 'hour').map((label) => label.text);
    expect(hours).toEqual(['0 h', '6 h', '12 h', '18 h', '24 h']);
  });

  it('labels the first and the last day only', () => {
    const days = labels.filter((label) => label.kind === 'day').map((label) => label.text);
    expect(days).toEqual(['día 2026-11-01', 'día 2026-11-03']);
  });

  it('places the target cut points on the wall at their heights', () => {
    const values = labels.filter((label) => label.kind === 'value');
    expect(values.map((label) => label.text)).toEqual(['70 mg/dL', '180 mg/dL']);
    expect(values[0]?.position[1]).toBeCloseTo(0.7);
    expect(values[1]?.position[1]).toBeCloseTo(1.8);
  });

  it('marks the target plane with its own text and the two axis titles', () => {
    expect(labels.some((label) => label.kind === 'target' && label.text === 'Rango objetivo')).toBe(true);
    expect(labels.filter((label) => label.kind === 'axis').map((label) => label.text)).toEqual(['Hora del día', 'Día']);
  });

  it('gives a single day one label, not two at the same place', () => {
    const single = buildSurfaceLabels({
      grid: { ...grid, dayKeys: ['2026-11-01'] },
      cellSpacing: 0.25,
      target: { low: 70, high: 180 },
      heightOf: (value) => value / 100,
      text,
      offset: 0.3,
    });
    expect(single.filter((label) => label.kind === 'day')).toHaveLength(1);
  });
});
