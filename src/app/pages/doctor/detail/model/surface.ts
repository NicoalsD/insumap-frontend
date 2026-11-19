import { HOURS_PER_DAY } from '../constants';
import type { LocalReading } from './readings';

/** x, y and z of one vertex, and r, g and b of one color. */
const VALUES_PER_VERTEX = 3;

/** Summary of the readings of one clock hour on one day. */
export interface SurfaceCell {
  readonly mean: number;
  readonly min: number;
  readonly max: number;
}

export interface SurfaceGrid {
  /** `YYYY-MM-DD` of each row, oldest first. */
  readonly dayKeys: readonly string[];
  /** `cells[day][hour]`; `null` where the sensor has no reading in that hour. */
  readonly cells: readonly (readonly (SurfaceCell | null)[])[];
  /** Lowest and highest reading of the window: the height domain of the surface. */
  readonly min: number;
  readonly max: number;
}

/** Triangle mesh ready for a `BufferGeometry`. Colors are linear RGB in 0 to 1. */
export interface SurfaceMesh {
  readonly positions: Float32Array;
  readonly colors: Float32Array;
  readonly indices: Uint32Array;
}

/**
 * Height of a glucose value on the surface: linear from the lowest to the highest value of the
 * domain (the window's readings and the target cut points together), scaled to `heightScale`.
 * A flat domain gives height 0.
 *
 * Pattern: none (plain function; tested in surface.test.ts).
 */
export function heightOfValue(
  value: number,
  domain: { readonly min: number; readonly max: number },
  heightScale: number,
): number {
  const span = domain.max - domain.min;
  return span > 0 ? ((value - domain.min) / span) * heightScale : 0;
}

/**
 * Day by hour grid of the window. Each cell is the mean, minimum and maximum of the readings in one
 * hour of one day. `null` when the window has no readings at all.
 *
 * Pattern: none (plain function; tested in surface.test.ts).
 */
export function buildSurfaceGrid(readings: readonly LocalReading[]): SurfaceGrid | null {
  if (readings.length === 0) return null;
  const dayKeys = [...new Set(readings.map((reading) => reading.dayKey))].sort();
  const dayIndex = new Map(dayKeys.map((key, index) => [key, index]));
  const buckets: { values: number[] }[][] = dayKeys.map(() =>
    Array.from({ length: HOURS_PER_DAY }, () => ({ values: [] })),
  );
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const reading of readings) {
    const day = dayIndex.get(reading.dayKey);
    const bucket = day === undefined ? undefined : buckets[day]?.[reading.hour];
    if (!bucket) continue;
    bucket.values.push(reading.valueMgDl);
    min = Math.min(min, reading.valueMgDl);
    max = Math.max(max, reading.valueMgDl);
  }
  const cells = buckets.map((row) =>
    row.map((bucket): SurfaceCell | null => {
      if (bucket.values.length === 0) return null;
      const sum = bucket.values.reduce((total, value) => total + value, 0);
      return {
        mean: sum / bucket.values.length,
        min: Math.min(...bucket.values),
        max: Math.max(...bucket.values),
      };
    }),
  );
  return { dayKeys, cells, min, max };
}

/**
 * Triangle mesh of the grid: one vertex per (day, hour), height from `heightOf`, color from
 * `colorOf`. Only the quads whose four corners have a reading become triangles, so a gap in the
 * sensor data stays a gap in the surface.
 *
 * Pattern: none (plain function; tested in surface.test.ts).
 */
export function buildSurfaceMesh(
  grid: SurfaceGrid,
  options: {
    readonly heightOf: (value: number) => number;
    readonly colorOf: (value: number) => readonly [number, number, number];
    readonly cellSpacing: number;
  },
): SurfaceMesh {
  const days = grid.dayKeys.length;
  const vertexAt = (day: number, hour: number) => day * HOURS_PER_DAY + hour;
  const vertexCount = days * HOURS_PER_DAY;
  const positions = new Float32Array(vertexCount * VALUES_PER_VERTEX);
  const colors = new Float32Array(vertexCount * VALUES_PER_VERTEX);
  for (let day = 0; day < days; day += 1) {
    for (let hour = 0; hour < HOURS_PER_DAY; hour += 1) {
      const cell = grid.cells[day]?.[hour] ?? null;
      const vertex = vertexAt(day, hour);
      const value = cell?.mean ?? grid.min;
      positions.set(
        [hour * options.cellSpacing, cell ? options.heightOf(cell.mean) : 0, day * options.cellSpacing],
        vertex * VALUES_PER_VERTEX,
      );
      colors.set(options.colorOf(value), vertex * VALUES_PER_VERTEX);
    }
  }

  const triangles: number[] = [];
  const hasCell = (day: number, hour: number) => grid.cells[day]?.[hour] != null;
  for (let day = 0; day < days - 1; day += 1) {
    for (let hour = 0; hour < HOURS_PER_DAY - 1; hour += 1) {
      if (!hasCell(day, hour) || !hasCell(day, hour + 1) || !hasCell(day + 1, hour) || !hasCell(day + 1, hour + 1)) {
        continue;
      }
      const a = vertexAt(day, hour);
      const b = vertexAt(day, hour + 1);
      const c = vertexAt(day + 1, hour);
      const d = vertexAt(day + 1, hour + 1);
      triangles.push(a, c, b, b, c, d);
    }
  }
  return { positions, colors, indices: new Uint32Array(triangles) };
}
