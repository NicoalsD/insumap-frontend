import type { TimeInRanges } from '@/core/glucose/timeInRanges';
import type { MetricsResponseDto } from '../dto/clinical';
import { TargetProfileViewModelAdapter, type TargetProfileViewModel } from './TargetProfileViewModelAdapter';
import type { ViewModelAdapter } from './ViewModelAdapter';

const HOURS_PER_DAY = 24;

export interface MetricsViewModel {
  readonly profile: TargetProfileViewModel;
  readonly timeInRanges: TimeInRanges;
  readonly tirPct: number;
  readonly tbrPct: number;
  readonly tarPct: number;
  readonly meanGlucoseMgDl: number;
  /** Null for SMBG patients, which have no GMI. */
  readonly gmiPct: number | null;
  readonly cvPct: number | null;
  readonly hypoEventsCount: number;
  /** TIR change against the previous window, in percentage points; null when not requested. */
  readonly tirDeltaPct: number | null;
  readonly periodFrom: Date;
  readonly periodTo: Date;
}

/** `"14d"` is 14, `"24h"` is 1; anything else is null. */
export function windowToDays(window: string): number | null {
  const match = /^(\d+)([hd])$/.exec(window);
  if (!match) return null;
  const amount = Number(match[1]);
  return match[2] === 'd' ? amount : Math.max(1, Math.round(amount / HOURS_PER_DAY));
}

/**
 * Metrics of a window as the screens use them. The API names the very-low and very-high
 * shares by level: `tbr_l2` is below the very-low cut point, `tar_l2` above the very-high one.
 *
 * Pattern: P06 Adapter
 */
export class MetricsViewModelAdapter implements ViewModelAdapter<MetricsResponseDto, MetricsViewModel> {
  constructor(private readonly profiles = new TargetProfileViewModelAdapter()) {}

  adapt(dto: MetricsResponseDto): MetricsViewModel {
    const { metrics } = dto;
    return {
      profile: this.profiles.adapt(dto.target_profile),
      timeInRanges: {
        percentByState: {
          VERY_LOW: metrics.tbr_l2_pct,
          LOW: metrics.tbr_l1_pct,
          IN_RANGE: metrics.tir_pct,
          HIGH: metrics.tar_l1_pct,
          VERY_HIGH: metrics.tar_l2_pct,
        },
        dataSufficiencyPct: dto.data_sufficiency_pct,
        isSufficient: dto.is_sufficient,
        confidence: dto.confidence,
        windowDays: windowToDays(dto.window),
      },
      tirPct: metrics.tir_pct,
      tbrPct: metrics.tbr_pct,
      tarPct: metrics.tar_pct,
      meanGlucoseMgDl: metrics.mean_glucose_mg_dl,
      gmiPct: metrics.gmi_pct,
      cvPct: metrics.cv_pct,
      hypoEventsCount: metrics.hypo_events_count,
      tirDeltaPct: dto.tir_delta_pct ?? null,
      periodFrom: new Date(dto.period_from),
      periodTo: new Date(dto.period_to),
    };
  }
}
