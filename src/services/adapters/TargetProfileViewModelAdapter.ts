import type { GlucoseThresholds } from '@/core/glucose/thresholds';
import { assertValidThresholds } from '@/core/glucose/thresholds';
import type { TargetProfileDto } from '../dto/targetProfile';
import type { ViewModelAdapter } from './ViewModelAdapter';

export interface TargetProfileViewModel {
  readonly id: string;
  readonly code: string;
  readonly label: string;
  readonly version: number;
  /** The four cut points every chart and badge classifies with. */
  readonly thresholds: GlucoseThresholds;
  readonly goals: {
    readonly tirMinPct: number;
    readonly tbrL1MaxPct: number;
    readonly tbrL2MaxPct: number;
    readonly tarL1MaxPct: number;
    readonly tarL2MaxPct: number;
    readonly cvMaxPct: number;
    readonly minDataSufficiencyPct: number;
  };
}

/**
 * Maps the API target profile (snake_case, API.md 8.7) to the thresholds and goals the UI reads.
 * Refuses a profile whose cut points are not strictly ascending.
 *
 * Pattern: P06 Adapter
 */
export class TargetProfileViewModelAdapter
  implements ViewModelAdapter<TargetProfileDto, TargetProfileViewModel>
{
  adapt(dto: TargetProfileDto): TargetProfileViewModel {
    const thresholds: GlucoseThresholds = {
      veryLowMgDl: dto.very_low_mg_dl,
      rangeLowMgDl: dto.range_low_mg_dl,
      rangeHighMgDl: dto.range_high_mg_dl,
      veryHighMgDl: dto.very_high_mg_dl,
    };
    assertValidThresholds(thresholds);
    return {
      id: dto.id,
      code: dto.code,
      label: dto.label,
      version: dto.version,
      thresholds,
      goals: {
        tirMinPct: dto.tir_min_pct,
        tbrL1MaxPct: dto.tbr_l1_max_pct,
        tbrL2MaxPct: dto.tbr_l2_max_pct,
        tarL1MaxPct: dto.tar_l1_max_pct,
        tarL2MaxPct: dto.tar_l2_max_pct,
        cvMaxPct: dto.cv_max_pct,
        minDataSufficiencyPct: dto.min_data_sufficiency_pct,
      },
    };
  }
}
