import { HOURS_PER_DAY } from '../constants';
import type { SurfaceGrid } from './surface';

/** A text label in scene coordinates, drawn over the canvas. */
export interface SurfaceLabel {
  readonly position: readonly [number, number, number];
  readonly text: string;
  readonly kind: 'hour' | 'day' | 'value' | 'axis' | 'target';
}

/** Half of a span: the midpoint of an axis or a wall. */
const HALF = 0.5;
/** Labels on the back and side walls sit at twice the wall offset. */
const WALL_STEPS = 2;

/** Hours with a label on the hour axis, and the end of the day. */
const AXIS_STEP_HOURS = 6;
export const AXIS_HOURS: readonly number[] = Array.from(
  { length: HOURS_PER_DAY / AXIS_STEP_HOURS },
  (_, index) => index * AXIS_STEP_HOURS,
);
/** The end of the day sits at the last hour column plus one step. */
const END_OF_DAY = HOURS_PER_DAY;

export interface SurfaceLabelOptions {
  readonly grid: SurfaceGrid;
  readonly cellSpacing: number;
  /** Lower and upper cut points of the target range, in mg/dL. */
  readonly target: { readonly low: number; readonly high: number };
  /** Height of a value in scene units (the same mapping as the surface). */
  readonly heightOf: (value: number) => number;
  readonly text: {
    readonly hour: (hour: number) => string;
    readonly day: (dayKey: string) => string;
    readonly value: (valueMgDl: number) => string;
    readonly hourAxis: string;
    readonly dayAxis: string;
    readonly target: string;
  };
  /** Distance from the floor edge to the labels on the walls, in scene units. */
  readonly offset: number;
}

/**
 * Labels of the surface: hour ticks (0, 6, 12, 18 and 24 h), the first and last day, the target
 * cut points on the left wall, the target plane and the two axis titles. Pure: no DOM, no three.js.
 *
 * Pattern: none (plain function; tested in surfaceLabels.test.ts).
 */
export function buildSurfaceLabels(options: SurfaceLabelOptions): SurfaceLabel[] {
  const { grid, cellSpacing, target, heightOf, text, offset } = options;
  const lastDay = Math.max(0, grid.dayKeys.length - 1);
  const width = (HOURS_PER_DAY - 1) * cellSpacing;
  const depth = lastDay * cellSpacing;
  const hourLabels: SurfaceLabel[] = [...AXIS_HOURS, END_OF_DAY].map((hour) => ({
    position: [Math.min(hour, HOURS_PER_DAY - 1) * cellSpacing, 0, -offset],
    text: text.hour(hour),
    kind: 'hour',
  }));
  const dayKeys = grid.dayKeys.length > 1 ? [0, lastDay] : [0];
  const dayLabels: SurfaceLabel[] = dayKeys.map((day) => ({
    position: [-offset, 0, day * cellSpacing],
    text: text.day(grid.dayKeys[day] ?? ''),
    kind: 'day',
  }));
  const valueLabels: SurfaceLabel[] = [target.low, target.high].map((value) => ({
    position: [-offset, heightOf(value), 0],
    text: text.value(value),
    kind: 'value',
  }));
  return [
    ...hourLabels,
    ...dayLabels,
    ...valueLabels,
    { position: [width * HALF, 0, -offset * WALL_STEPS], text: text.hourAxis, kind: 'axis' },
    { position: [-offset * WALL_STEPS, 0, depth * HALF], text: text.dayAxis, kind: 'axis' },
    { position: [width, heightOf(target.high), 0], text: text.target, kind: 'target' },
  ];
}
