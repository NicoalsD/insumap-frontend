/**
 * Glucose range classification against the patient's target profile.
 * The numbers always come from the API (target profile); this module holds no clinical value.
 */

/** Range states in ascending glucose order (International TIR consensus). */
export const RANGE_STATES = ['VERY_LOW', 'LOW', 'IN_RANGE', 'HIGH', 'VERY_HIGH'] as const;
export type RangeState = (typeof RANGE_STATES)[number];

/** Cut points of a target profile, in mg/dL, as received from the API. */
export interface GlucoseThresholds {
  /** Below this value the reading is VERY_LOW (`very_low_mg_dl`). */
  readonly veryLowMgDl: number;
  /** Below this value the reading is LOW (`range_low_mg_dl`). */
  readonly rangeLowMgDl: number;
  /** Up to and including this value the reading is IN_RANGE (`range_high_mg_dl`). */
  readonly rangeHighMgDl: number;
  /** Up to and including this value the reading is HIGH (`very_high_mg_dl`). */
  readonly veryHighMgDl: number;
}

/** Lower and upper bound of a state; `null` means open-ended. */
export interface RangeBounds {
  readonly state: RangeState;
  readonly minMgDl: number | null;
  readonly maxMgDl: number | null;
}

/** Throws if the cut points are not strictly ascending (a broken profile must never render). */
export function assertValidThresholds(t: GlucoseThresholds): void {
  const ordered = [t.veryLowMgDl, t.rangeLowMgDl, t.rangeHighMgDl, t.veryHighMgDl];
  const ascending = ordered.every((value, i) => i === 0 || value > (ordered[i - 1] ?? value));
  if (!ordered.every(Number.isFinite) || !ascending) {
    throw new Error('Target profile thresholds must be finite and strictly ascending');
  }
}

/**
 * Classifies a reading. Lower bounds are inclusive for LOW and IN_RANGE (`value >= cut`),
 * upper bounds inclusive for IN_RANGE and HIGH (`value <= cut`), as in the consensus
 * definitions (TBR "< 70", TAR "> 180").
 */
export function classifyGlucose(valueMgDl: number, t: GlucoseThresholds): RangeState {
  if (valueMgDl < t.veryLowMgDl) return 'VERY_LOW';
  if (valueMgDl < t.rangeLowMgDl) return 'LOW';
  if (valueMgDl <= t.rangeHighMgDl) return 'IN_RANGE';
  if (valueMgDl <= t.veryHighMgDl) return 'HIGH';
  return 'VERY_HIGH';
}

/** The five states with their bounds, for legends ("54 a 69 mg/dL"). */
export function rangeBounds(t: GlucoseThresholds): readonly RangeBounds[] {
  return [
    { state: 'VERY_LOW', minMgDl: null, maxMgDl: t.veryLowMgDl },
    { state: 'LOW', minMgDl: t.veryLowMgDl, maxMgDl: t.rangeLowMgDl },
    { state: 'IN_RANGE', minMgDl: t.rangeLowMgDl, maxMgDl: t.rangeHighMgDl },
    { state: 'HIGH', minMgDl: t.rangeHighMgDl, maxMgDl: t.veryHighMgDl },
    { state: 'VERY_HIGH', minMgDl: t.veryHighMgDl, maxMgDl: null },
  ];
}
