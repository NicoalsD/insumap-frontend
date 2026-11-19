import type { PatientAdminDto } from '@/services/dto/admin';
import type { ViewModelAdapter } from '@/services/adapters/ViewModelAdapter';

export type AccountStatus = PatientAdminDto['account_status'];
export type InvitationStatus = string | null;

export const ACCOUNT_STATUSES = ['IMPORTED', 'INVITED', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED'] as const;

/** Row of the administrative patient list: administrative fields only, never clinical data. */
export interface PatientRowViewModel {
  readonly id: string;
  readonly fullName: string;
  readonly mrn: string;
  readonly documentLast4: string;
  readonly accountStatus: AccountStatus;
  readonly invitationStatus: InvitationStatus;
  readonly primaryDoctorId: string | null;
  /** Name of the primary doctor, when the staff directory knows it. */
  readonly primaryDoctorName: string | null;
  readonly assignedDoctorCount: number;
  /** Whether the console can issue or resend a credential for this account state (API.md 8.4). */
  readonly canIssue: boolean;
}

const ISSUABLE: readonly AccountStatus[] = ['IMPORTED', 'INVITED', 'ACTIVE'];

/**
 * Turns the administrative patient DTO into a row. The doctor name comes from a map the screens
 * build from care-team assignments; the patient record only carries the doctor id.
 *
 * Pattern: P06 Adapter
 */
export class PatientAdminViewModelAdapter implements ViewModelAdapter<PatientAdminDto, PatientRowViewModel> {
  constructor(private readonly doctorNames: ReadonlyMap<string, string> = new Map()) {}

  adapt(dto: PatientAdminDto): PatientRowViewModel {
    const primaryDoctorName =
      dto.primary_doctor_id === null ? null : (this.doctorNames.get(dto.primary_doctor_id) ?? null);
    return {
      id: dto.id,
      fullName: dto.full_name,
      mrn: dto.mrn,
      documentLast4: dto.document_last4,
      accountStatus: dto.account_status,
      invitationStatus: dto.invitation_status,
      primaryDoctorId: dto.primary_doctor_id,
      primaryDoctorName,
      assignedDoctorCount: dto.assigned_doctor_count,
      canIssue: ISSUABLE.includes(dto.account_status),
    };
  }
}
