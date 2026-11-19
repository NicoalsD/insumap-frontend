import type { TimeInRanges } from '../glucose/timeInRanges';
import { RANGE_STATES, type RangeState } from '../glucose/thresholds';
import { chartKind, type ChartRenderStrategy } from './ChartRenderStrategy';

const PERCENT_TOTAL = 100;
/** Narrowest segment (in % of the bar) that still fits its own "NN %" label inside. */
export const DEFAULT_MIN_INLINE_LABEL_PCT = 9;

export interface RangeBandSegment {
  readonly state: RangeState;
  /** Percentage as reported by the API. */
  readonly percent: number;
  /** Width in the bar, normalized so the visible segments add up to 100. */
  readonly widthPct: number;
  /** Whether the percentage fits inside the segment; the legend always shows it. */
  readonly showInlineLabel: boolean;
}

export type RangeBandModel =
  | {
      readonly status: 'ok';
      readonly segments: readonly RangeBandSegment[];
      /** All five states in order, including 0 %, for the text legend. */
      readonly legend: readonly { readonly state: RangeState; readonly percent: number }[];
      readonly lowConfidence: boolean;
    }
  | { readonly status: 'insufficient'; readonly dataSufficiencyPct: number };

/**
 * Stacked time-in-ranges bar (the "range band"). Hides 0 % segments in the bar but keeps them
 * in the legend; refuses to draw when the API reports insufficient data (API.md 8.8).
 *
 * Pattern: P19 Strategy
 */
export class TimeInRangesBandStrategy implements ChartRenderStrategy<TimeInRanges, RangeBandModel> {
  static readonly KIND = chartKind<TimeInRanges, RangeBandModel>('time-in-ranges-band');
  readonly kind = TimeInRangesBandStrategy.KIND;

  constructor(private readonly minInlineLabelPct = DEFAULT_MIN_INLINE_LABEL_PCT) {}

  render(input: TimeInRanges): RangeBandModel {
    if (!input.isSufficient) {
      return { status: 'insufficient', dataSufficiencyPct: input.dataSufficiencyPct };
    }
    const legend = RANGE_STATES.map((state) => ({
      state,
      percent: Math.max(0, input.percentByState[state]),
    }));
    const total = legend.reduce((sum, item) => sum + item.percent, 0);
    const segments = legend
      .filter((item) => item.percent > 0)
      .map((item) => {
        const widthPct = total > 0 ? (item.percent / total) * PERCENT_TOTAL : 0;
        return { ...item, widthPct, showInlineLabel: widthPct >= this.minInlineLabelPct };
      });
    return {
      status: 'ok',
      segments,
      legend,
      lowConfidence: input.confidence === 'LOW_CONFIDENCE',
    };
  }
}
