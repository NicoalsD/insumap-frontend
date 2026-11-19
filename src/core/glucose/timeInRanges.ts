import type { RangeState } from './thresholds';

/** Percentage of time per range state for a window, plus whether the data can be trusted. */
export interface TimeInRanges {
  readonly percentByState: Readonly<Record<RangeState, number>>;
  /** Share of expected readings present in the window, 0 to 100. */
  readonly dataSufficiencyPct: number;
  /** False when the API says the data is insufficient: never show percentages then. */
  readonly isSufficient: boolean;
  readonly confidence: 'NORMAL' | 'LOW_CONFIDENCE';
  readonly windowDays: number | null;
}
