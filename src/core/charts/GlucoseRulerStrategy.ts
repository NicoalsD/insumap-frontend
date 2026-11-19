import {
  assertValidThresholds,
  classifyGlucose,
  RANGE_STATES,
  type GlucoseThresholds,
  type RangeState,
} from '../glucose/thresholds';
import { chartKind, type ChartRenderStrategy } from './ChartRenderStrategy';

const PERCENT_TOTAL = 100;
const BAND_WIDTH_PCT = PERCENT_TOTAL / RANGE_STATES.length;

export interface GlucoseRulerInput {
  readonly valueMgDl: number;
  readonly thresholds: GlucoseThresholds;
}

export interface GlucoseRulerModel {
  readonly state: RangeState;
  /** Five equal-width bands in ascending order; the profile gives cut points, not axis ends. */
  readonly bands: readonly { readonly state: RangeState; readonly startPct: number; readonly widthPct: number }[];
  /** Marker position along the ruler, 0 to 100. */
  readonly markerPct: number;
  /** Set when the value lies beyond the drawn scale and the marker is pinned to an end. */
  readonly clamped: 'below' | 'above' | null;
  readonly cutPoints: readonly number[];
}

/**
 * Places one reading on the patient's target range. Each state gets an equal-width band so the
 * ruler needs no invented axis minimum or maximum; inside a band the value is placed
 * proportionally. The open-ended bands mirror the width of their bounded neighbor.
 *
 * Pattern: P19 Strategy
 */
export class GlucoseRulerStrategy implements ChartRenderStrategy<GlucoseRulerInput, GlucoseRulerModel> {
  static readonly KIND = chartKind<GlucoseRulerInput, GlucoseRulerModel>('glucose-ruler');
  readonly kind = GlucoseRulerStrategy.KIND;

  render({ valueMgDl, thresholds: t }: GlucoseRulerInput): GlucoseRulerModel {
    assertValidThresholds(t);
    const state = classifyGlucose(valueMgDl, t);
    const lowSpan = t.rangeLowMgDl - t.veryLowMgDl;
    const highSpan = t.veryHighMgDl - t.rangeHighMgDl;
    const spans: Record<RangeState, [number, number]> = {
      VERY_LOW: [t.veryLowMgDl - lowSpan, t.veryLowMgDl],
      LOW: [t.veryLowMgDl, t.rangeLowMgDl],
      IN_RANGE: [t.rangeLowMgDl, t.rangeHighMgDl],
      HIGH: [t.rangeHighMgDl, t.veryHighMgDl],
      VERY_HIGH: [t.veryHighMgDl, t.veryHighMgDl + highSpan],
    };
    const index = RANGE_STATES.indexOf(state);
    const [min, max] = spans[state];
    const raw = (valueMgDl - min) / (max - min);
    const fraction = Math.min(1, Math.max(0, raw));
    const clamped = raw < 0 ? 'below' : raw > 1 ? 'above' : null;
    return {
      state,
      bands: RANGE_STATES.map((s, i) => ({ state: s, startPct: i * BAND_WIDTH_PCT, widthPct: BAND_WIDTH_PCT })),
      markerPct: (index + fraction) * BAND_WIDTH_PCT,
      clamped,
      cutPoints: [t.veryLowMgDl, t.rangeLowMgDl, t.rangeHighMgDl, t.veryHighMgDl],
    };
  }
}

/** The ruler's five equal bands as mg/dL spans, from the profile's cut points. */
function rulerSpans(t: GlucoseThresholds): readonly (readonly [number, number])[] {
  const lowSpan = t.rangeLowMgDl - t.veryLowMgDl;
  const highSpan = t.veryHighMgDl - t.rangeHighMgDl;
  return [
    [t.veryLowMgDl - lowSpan, t.veryLowMgDl],
    [t.veryLowMgDl, t.rangeLowMgDl],
    [t.rangeLowMgDl, t.rangeHighMgDl],
    [t.rangeHighMgDl, t.veryHighMgDl],
    [t.veryHighMgDl, t.veryHighMgDl + highSpan],
  ];
}

/**
 * Where a value sits on the ruler, 0 to 100 (each band is a fifth, whatever its mg/dL width), so a
 * slider over the ruler gives the narrow low bands as much room as the wide high ones.
 */
export function rulerPosition(valueMgDl: number, t: GlucoseThresholds): number {
  const spans = rulerSpans(t);
  const first = spans[0];
  const last = spans[spans.length - 1];
  if (!first || !last) return 0;
  if (valueMgDl <= first[0]) return 0;
  if (valueMgDl >= last[1]) return PERCENT_TOTAL;
  const index = spans.findIndex(([low, high]) => valueMgDl >= low && valueMgDl < high);
  const [low, high] = spans[index] ?? first;
  return (index + (valueMgDl - low) / (high - low)) * BAND_WIDTH_PCT;
}

/** The mg/dL value at a ruler position (the inverse of `rulerPosition`), rounded to whole mg/dL. */
export function rulerValue(position: number, t: GlucoseThresholds): number {
  const spans = rulerSpans(t);
  const clamped = Math.min(PERCENT_TOTAL, Math.max(0, position));
  const index = Math.min(spans.length - 1, Math.floor(clamped / BAND_WIDTH_PCT));
  const [low, high] = spans[index] ?? [0, 0];
  const fraction = (clamped - index * BAND_WIDTH_PCT) / BAND_WIDTH_PCT;
  return Math.round(low + fraction * (high - low));
}
