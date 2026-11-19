import { chartKind, type ChartRenderStrategy } from '@/core/charts/ChartRenderStrategy';

export interface AgpBin {
  readonly time_of_day: string;
  readonly p5: number;
  readonly p25: number;
  readonly p50: number;
  readonly p75: number;
  readonly p95: number;
}

export interface AgpBandInput {
  readonly bins: readonly AgpBin[];
  readonly targetLowMgDl: number;
  readonly targetHighMgDl: number;
  readonly isSufficient: boolean;
}

/** Points in a 0 to 1 box: x is the share of the day, y is the share of the glucose domain (top = high). */
export interface AgpPoint {
  readonly x: number;
  readonly y: number;
}

export type AgpBandModel =
  | { readonly status: 'empty' }
  | {
      readonly status: 'ok';
      readonly median: readonly AgpPoint[];
      /** Closed polygon: the 75th percentile forward, the 25th back. */
      readonly band: readonly AgpPoint[];
      readonly targetTopY: number;
      readonly targetBottomY: number;
      readonly ticks: readonly { readonly x: number; readonly hour: number }[];
      readonly domain: { readonly min: number; readonly max: number };
    };

const TICK_EVERY_HOURS = 6;
/** Height used when the glucose domain has no span (all values equal). */
const MIDDLE_Y = 0.5;

const hourOf = (timeOfDay: string): number => Number(timeOfDay.split(':')[0]);
const isWholeHour = (timeOfDay: string): boolean => timeOfDay.endsWith(':00');

/**
 * Maps the 24-hour AGP profile to a normalized geometry. The glucose domain comes from the data
 * and the patient's target, never from a fixed axis. Empty or insufficient data gives `empty`.
 *
 * Pattern: P19 Strategy
 */
export class AgpBandStrategy implements ChartRenderStrategy<AgpBandInput, AgpBandModel> {
  static readonly KIND = chartKind<AgpBandInput, AgpBandModel>('agp-band');
  readonly kind = AgpBandStrategy.KIND;

  render(input: AgpBandInput): AgpBandModel {
    if (!input.isSufficient || input.bins.length === 0) return { status: 'empty' };
    const bins = [...input.bins].sort((a, b) => hourOf(a.time_of_day) - hourOf(b.time_of_day));
    const min = Math.min(input.targetLowMgDl, ...bins.map((bin) => bin.p5));
    const max = Math.max(input.targetHighMgDl, ...bins.map((bin) => bin.p95));
    const span = max - min;
    const yOf = (value: number) => (span > 0 ? 1 - (value - min) / span : MIDDLE_Y);
    const lastIndex = Math.max(1, bins.length - 1);
    const xAt = (index: number) => index / lastIndex;
    const xOf = (bin: AgpBin) => xAt(bins.indexOf(bin));

    const median = bins.map((bin) => ({ x: xOf(bin), y: yOf(bin.p50) }));
    const upper = bins.map((bin) => ({ x: xOf(bin), y: yOf(bin.p75) }));
    const lower = bins.map((bin) => ({ x: xOf(bin), y: yOf(bin.p25) })).reverse();
    const ticks = bins
      .filter((bin) => isWholeHour(bin.time_of_day) && hourOf(bin.time_of_day) % TICK_EVERY_HOURS === 0)
      .map((bin) => ({ x: xOf(bin), hour: hourOf(bin.time_of_day) }));

    return {
      status: 'ok',
      median,
      band: [...upper, ...lower],
      targetTopY: yOf(input.targetHighMgDl),
      targetBottomY: yOf(input.targetLowMgDl),
      ticks,
      domain: { min, max },
    };
  }
}
