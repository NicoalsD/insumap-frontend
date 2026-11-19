import { chartKind, type ChartRenderStrategy } from '@/core/charts/ChartRenderStrategy';
import { AGP_TICK_EVERY_HOURS, MINUTES_PER_HOUR } from '../constants';
import { minutesOfTimeOfDay } from '../model/localTime';

export interface AgpInputBin {
  readonly time_of_day: string;
  readonly p5: number;
  readonly p25: number;
  readonly p50: number;
  readonly p75: number;
  readonly p95: number;
}

export interface PatientAgpInput {
  readonly bins: readonly AgpInputBin[];
  /** Target range of the patient's profile (`range_low_mg_dl`, `range_high_mg_dl`). */
  readonly target: { readonly low: number; readonly high: number };
  readonly isSufficient: boolean;
}

/** One time of the day with its percentiles and its place in the 0 to 1 box. */
export interface AgpPoint {
  readonly x: number;
  readonly y: number;
  readonly timeOfDay: string;
  readonly minuteOfDay: number;
  readonly p5: number;
  readonly p25: number;
  readonly p50: number;
  readonly p75: number;
  readonly p95: number;
}

export type PatientAgpModel =
  | { readonly status: 'empty' }
  | {
      readonly status: 'ok';
      /** Median line, left to right. */
      readonly median: readonly { readonly x: number; readonly y: number }[];
      /** Closed polygon of the 5 to 95 % band. */
      readonly outerBand: readonly { readonly x: number; readonly y: number }[];
      /** Closed polygon of the 25 to 75 % band. */
      readonly innerBand: readonly { readonly x: number; readonly y: number }[];
      readonly targetTopY: number;
      readonly targetBottomY: number;
      readonly ticks: readonly { readonly x: number; readonly hour: number }[];
      readonly points: readonly AgpPoint[];
      readonly domain: { readonly min: number; readonly max: number };
    };

const MIDDLE_Y = 0.5;
const PERCENT = 100;

/**
 * Maps the 24-hour profile to a normalized box: x is the share of the day, y the share of the
 * glucose domain (top is high). The domain comes from the data and the target, never a fixed axis.
 * Insufficient data or no bins gives `empty`, so the screen says so instead of drawing a guess.
 *
 * Pattern: P19 Strategy
 */
export class PatientAgpStrategy implements ChartRenderStrategy<PatientAgpInput, PatientAgpModel> {
  static readonly KIND = chartKind<PatientAgpInput, PatientAgpModel>('patient-agp');
  readonly kind = PatientAgpStrategy.KIND;

  render(input: PatientAgpInput): PatientAgpModel {
    if (!input.isSufficient || input.bins.length === 0) return { status: 'empty' };
    const bins = [...input.bins].sort(
      (a, b) => minutesOfTimeOfDay(a.time_of_day) - minutesOfTimeOfDay(b.time_of_day),
    );
    const min = Math.min(input.target.low, ...bins.map((bin) => bin.p5));
    const max = Math.max(input.target.high, ...bins.map((bin) => bin.p95));
    const span = max - min;
    const yOf = (value: number) => (span > 0 ? 1 - (value - min) / span : MIDDLE_Y);
    const lastIndex = Math.max(1, bins.length - 1);

    const points: AgpPoint[] = bins.map((bin, index) => ({
      x: index / lastIndex,
      y: yOf(bin.p50),
      timeOfDay: bin.time_of_day,
      minuteOfDay: minutesOfTimeOfDay(bin.time_of_day),
      p5: bin.p5,
      p25: bin.p25,
      p50: bin.p50,
      p75: bin.p75,
      p95: bin.p95,
    }));
    const at = (point: AgpPoint, value: number) => ({ x: point.x, y: yOf(value) });
    const median = points.map((point) => at(point, point.p50));
    const outerBand = [...points.map((point) => at(point, point.p95)), ...points.map((point) => at(point, point.p5)).reverse()];
    const innerBand = [...points.map((point) => at(point, point.p75)), ...points.map((point) => at(point, point.p25)).reverse()];
    const tickEveryMinutes = AGP_TICK_EVERY_HOURS * MINUTES_PER_HOUR;
    const ticks = points
      .filter((point) => point.minuteOfDay % tickEveryMinutes === 0)
      .map((point) => ({ x: point.x, hour: Math.floor(point.minuteOfDay / MINUTES_PER_HOUR) }));

    return {
      status: 'ok',
      median,
      outerBand,
      innerBand,
      targetTopY: yOf(input.target.high),
      targetBottomY: yOf(input.target.low),
      ticks,
      points,
      domain: { min, max },
    };
  }
}

/** Percent of the 0 to 1 box, for CSS `left` values. */
export const asPercent = (fraction: number): string => `${String(fraction * PERCENT)}%`;
