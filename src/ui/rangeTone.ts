import type { RangeState } from '@/core/glucose/thresholds';
import type { BadgeTone } from './Badge';

/** Badge tone for a glucose range state: `rangeTone('IN_RANGE')` is `'range-in-range'`. */
export function rangeTone(state: RangeState): BadgeTone {
  return `range-${state.toLowerCase().replaceAll('_', '-')}` as BadgeTone;
}
