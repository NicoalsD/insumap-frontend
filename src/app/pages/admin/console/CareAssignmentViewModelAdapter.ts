import type { CareAssignmentDto } from '@/services/dto/admin';
import type { ViewModelAdapter } from '@/services/adapters/ViewModelAdapter';

export interface CareAssignmentViewModel {
  readonly id: string;
  readonly patientId: string;
  /** Null when neither the assignment nor the patient list gives a name. */
  readonly patientName: string | null;
  readonly doctorId: string;
  readonly doctorName: string | null;
  readonly isPrimary: boolean;
  readonly startedAt: string;
}

/**
 * Active care-team assignment for the admin tables. Names come from the assignment when the API
 * sends them, otherwise from maps built out of the patient roster.
 *
 * Pattern: P06 Adapter
 */
export class CareAssignmentViewModelAdapter
  implements ViewModelAdapter<CareAssignmentDto, CareAssignmentViewModel>
{
  constructor(private readonly patientNames: ReadonlyMap<string, string> = new Map()) {}

  adapt(dto: CareAssignmentDto): CareAssignmentViewModel {
    return {
      id: dto.id,
      patientId: dto.patient_id,
      patientName: dto.patient_name ?? this.patientNames.get(dto.patient_id) ?? null,
      doctorId: dto.doctor_id,
      doctorName: dto.doctor_name ?? null,
      isPrimary: dto.is_primary,
      startedAt: dto.started_at,
    };
  }
}
