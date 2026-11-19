import { describe, expect, it } from 'vitest';
import type { LocalReading } from './readings';
import { buildSurfaceGrid, buildSurfaceMesh, heightOfValue } from './surface';

function reading(dayKey: string, hour: number, valueMgDl: number): LocalReading {
  return { valueMgDl, dayKey, hour, minuteOfDay: hour * 60, state: 'IN_RANGE', source: 'CGM', measuredAt: new Date(0) };
}

describe('buildSurfaceGrid', () => {
  it('returns null without readings', () => {
    expect(buildSurfaceGrid([])).toBeNull();
  });

  it('summarizes each day and hour with mean, minimum and maximum, oldest day first', () => {
    const grid = buildSurfaceGrid([
      reading('2026-11-02', 8, 100),
      reading('2026-11-01', 8, 80),
      reading('2026-11-01', 8, 120),
      reading('2026-11-01', 9, 150),
    ]);
    expect(grid?.dayKeys).toEqual(['2026-11-01', '2026-11-02']);
    expect(grid?.cells[0]?.[8]).toEqual({ mean: 100, min: 80, max: 120 });
    expect(grid?.cells[0]?.[9]).toEqual({ mean: 150, min: 150, max: 150 });
    expect(grid?.cells[1]?.[8]).toEqual({ mean: 100, min: 100, max: 100 });
    expect(grid?.cells[1]?.[9]).toBeNull();
    expect(grid?.min).toBe(80);
    expect(grid?.max).toBe(150);
  });
});

describe('heightOfValue', () => {
  it('maps the domain linearly onto the height scale', () => {
    const domain = { min: 50, max: 250 };
    expect(heightOfValue(50, domain, 2)).toBe(0);
    expect(heightOfValue(150, domain, 2)).toBe(1);
    expect(heightOfValue(250, domain, 2)).toBe(2);
  });

  it('gives height 0 for a flat domain', () => {
    expect(heightOfValue(100, { min: 100, max: 100 }, 2)).toBe(0);
  });
});

describe('buildSurfaceMesh', () => {
  const options = {
    heightOf: (value: number) => value / 100,
    colorOf: (value: number) => [value > 150 ? 1 : 0, 0, 0] as const,
    cellSpacing: 0.25,
  };

  it('makes two triangles per quad whose four corners have readings', () => {
    const readings = [
      reading('2026-11-01', 0, 100),
      reading('2026-11-01', 1, 110),
      reading('2026-11-02', 0, 120),
      reading('2026-11-02', 1, 130),
    ];
    const grid = buildSurfaceGrid(readings);
    if (!grid) throw new Error('grid expected');
    const mesh = buildSurfaceMesh(grid, options);
    expect(mesh.indices.length).toBe(6);
    expect(mesh.positions.length).toBe(24 * 2 * 3);
  });

  it('leaves a gap where a corner has no reading', () => {
    const grid = buildSurfaceGrid([reading('2026-11-01', 0, 100), reading('2026-11-02', 0, 100)]);
    if (!grid) throw new Error('grid expected');
    expect(buildSurfaceMesh(grid, options).indices.length).toBe(0);
  });

  it('places a vertex at hour times spacing, height and day times spacing', () => {
    const grid = buildSurfaceGrid([reading('2026-11-01', 3, 200), reading('2026-11-02', 3, 200)]);
    if (!grid) throw new Error('grid expected');
    const mesh = buildSurfaceMesh(grid, options);
    const vertex = (day: number, hour: number) => (day * 24 + hour) * 3;
    expect(mesh.positions[vertex(1, 3)]).toBeCloseTo(3 * 0.25);
    expect(mesh.positions[vertex(1, 3) + 1]).toBeCloseTo(2);
    expect(mesh.positions[vertex(1, 3) + 2]).toBeCloseTo(1 * 0.25);
    expect(mesh.colors[vertex(1, 3)]).toBe(1);
  });
});
