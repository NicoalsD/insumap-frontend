import type { RecommendationDto } from '../dto/clinical';
import type { ViewModelAdapter } from './ViewModelAdapter';

export interface RecommendationViewModel {
  readonly id: string;
  readonly patientId: string;
  readonly status: RecommendationDto['status'];
  /** Only a PROPOSED, unexpired suggestion can be decided. */
  readonly canDecide: boolean;
  readonly proposal: {
    readonly action: 'INCREASE' | 'DECREASE';
    readonly currentDose: number;
    readonly proposedDose: number;
    readonly deltaUnits: number;
  } | null;
  readonly summary: string;
  readonly factors: readonly string[];
  readonly modelVersion: string;
  readonly isFallback: boolean;
  readonly unavailableReason: string | null;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

/**
 * AI recommendation for the doctor. It always stays a suggestion pending the doctor's decision.
 *
 * Pattern: P06 Adapter
 */
export class RecommendationViewModelAdapter
  implements ViewModelAdapter<RecommendationDto, RecommendationViewModel>
{
  constructor(private readonly now: () => Date = () => new Date()) {}

  adapt(dto: RecommendationDto): RecommendationViewModel {
    const expiresAt = new Date(dto.expires_at);
    return {
      id: dto.id,
      patientId: dto.patient_id,
      status: dto.status,
      canDecide: dto.status === 'PROPOSED' && expiresAt.getTime() > this.now().getTime(),
      proposal: dto.proposal && {
        action: dto.proposal.action,
        currentDose: dto.proposal.current_dose,
        proposedDose: dto.proposal.proposed_dose,
        deltaUnits: dto.proposal.delta_units,
      },
      summary: dto.explanation.summary,
      factors: dto.explanation.factors,
      modelVersion: dto.model_version,
      isFallback: dto.is_fallback,
      unavailableReason: dto.unavailable_reason ?? null,
      expiresAt,
      createdAt: new Date(dto.created_at),
    };
  }
}
