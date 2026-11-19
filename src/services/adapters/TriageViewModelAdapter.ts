import { classifyGlucose, type RangeState } from '@/core/glucose/thresholds';
import type { TriageRowDto } from '../dto/clinical';
import { MetricsViewModelAdapter, type MetricsViewModel } from './MetricsViewModelAdapter';
import type { ViewModelAdapter } from './ViewModelAdapter';

export type RiskTier = TriageRowDto['risk_tier'];

export interface TriageRowViewModel {
  readonly patientId: string;
  readonly fullName: string;
  readonly riskTier: RiskTier;
  readonly riskScore: number;
  /** Human-readable reasons, already in the language of the API. */
  readonly reasons: readonly { readonly code: string; readonly text: string }[];
  readonly openAlertsCount: number;
  readonly pendingRecommendationsCount: number;
  readonly metrics: MetricsViewModel;
  readonly lastReading: {
    readonly valueMgDl: number;
    readonly measuredAt: Date;
    readonly state: RangeState;
  } | null;
  readonly reviewedAt: Date | null;
  readonly isFallback: boolean;
  readonly simulated: boolean;
}

/**
 * One triage row: classifies the last reading with the patient's own thresholds.
 *
 * Pattern: P06 Adapter
 */
export class TriageViewModelAdapter implements ViewModelAdapter<TriageRowDto, TriageRowViewModel> {
  constructor(private readonly metricsAdapter = new MetricsViewModelAdapter()) {}

  adapt(dto: TriageRowDto): TriageRowViewModel {
    const metrics = this.metricsAdapter.adapt(dto.metrics);
    return {
      patientId: dto.patient_id,
      fullName: dto.full_name,
      riskTier: dto.risk_tier,
      riskScore: dto.risk_score,
      reasons: dto.flags.map((flag) => ({ code: flag.code, text: flag.reason })),
      openAlertsCount: dto.open_alerts_count,
      pendingRecommendationsCount: dto.pending_recommendations_count,
      metrics,
      lastReading: dto.last_reading && {
        valueMgDl: dto.last_reading.value_mg_dl,
        measuredAt: new Date(dto.last_reading.measured_at),
        state: classifyGlucose(dto.last_reading.value_mg_dl, metrics.profile.thresholds),
      },
      reviewedAt: dto.reviewed_at === null ? null : new Date(dto.reviewed_at),
      isFallback: dto.is_fallback,
      simulated: dto.simulated,
    };
  }
}
