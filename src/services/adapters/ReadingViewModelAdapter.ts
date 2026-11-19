import { classifyGlucose, type GlucoseThresholds, type RangeState } from '@/core/glucose/thresholds';
import type { GlucoseReadingDto } from '../dto/clinical';
import type { ViewModelAdapter } from './ViewModelAdapter';

export interface ReadingViewModel {
  readonly id: string;
  readonly valueMgDl: number;
  readonly measuredAt: Date;
  readonly source: GlucoseReadingDto['source'];
  readonly context: string | null;
  readonly state: RangeState;
  /** The API keeps suspicious readings as FLAGGED; the UI shows them, never hides them. */
  readonly flagged: boolean;
  readonly corrected: boolean;
  readonly simulated: boolean;
}

/**
 * Glucose reading classified against the thresholds of the patient's target profile.
 *
 * Pattern: P06 Adapter
 */
export class ReadingViewModelAdapter implements ViewModelAdapter<GlucoseReadingDto, ReadingViewModel> {
  constructor(private readonly thresholds: GlucoseThresholds) {}

  adapt(dto: GlucoseReadingDto): ReadingViewModel {
    return {
      id: dto.id,
      valueMgDl: dto.value_mg_dl,
      measuredAt: new Date(dto.measured_at),
      source: dto.source,
      context: dto.context,
      state: classifyGlucose(dto.value_mg_dl, this.thresholds),
      flagged: dto.status === 'FLAGGED',
      corrected: dto.status === 'CORRECTED',
      simulated: dto.simulated,
    };
  }
}
