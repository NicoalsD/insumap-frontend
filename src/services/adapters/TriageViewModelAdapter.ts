import { classifyGlucose, type RangeState } from '@/core/glucose/thresholds';
import type { TriageRowDto } from '../dto/clinical';
import type { GlucoseThresholds } from '@/core/glucose/thresholds';

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
  /** Share of the window in range; null when the data is not enough. */
  readonly tirPct: number | null;
  /** Cut points of the clinic's default profile, which classify the last reading. */
  readonly thresholds: GlucoseThresholds;
  readonly lastReading: {
    readonly valueMgDl: number;
    readonly measuredAt: Date;
    readonly state: RangeState;
  } | null;
  readonly reviewedAt: Date | null;
  readonly isFallback: boolean;
  readonly simulated: boolean;
}

/** What a row needs besides the API row: the thresholds and the count of pending suggestions. */
export interface TriageContext {
  readonly thresholds: GlucoseThresholds;
  readonly pendingRecommendationsCount: number;
}

/**
 * One triage row: classifies the last reading with the clinic's default thresholds (the list
 * carries no per-patient profile).
 *
 * Pattern: P06 Adapter
 */
export class TriageViewModelAdapter {
  adapt(dto: TriageRowDto, context: TriageContext): TriageRowViewModel {
    return {
      patientId: dto.patient_id,
      fullName: dto.full_name,
      riskTier: dto.risk_tier,
      riskScore: dto.risk_score,
      reasons: dto.flags.map((flag) => ({ code: flag.code, text: flag.reason })),
      openAlertsCount: dto.open_alerts_count,
      pendingRecommendationsCount: context.pendingRecommendationsCount,
      tirPct: dto.tir_pct,
      thresholds: context.thresholds,
      lastReading: dto.last_reading && {
        valueMgDl: dto.last_reading.value_mg_dl,
        measuredAt: new Date(dto.last_reading.measured_at),
        state: classifyGlucose(dto.last_reading.value_mg_dl, context.thresholds),
      },
      reviewedAt: dto.reviewed_at === null ? null : new Date(dto.reviewed_at),
      isFallback: dto.is_fallback,
      simulated: dto.simulated,
    };
  }
}
