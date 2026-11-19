import type { PatientRowViewModel } from './PatientAdminViewModelAdapter';

/**
 * Patients without a valid credential: imported with none, or invited whose code expired or was
 * revoked. Active and suspended or deactivated accounts are not in the queue (API.md 8.4).
 */
export function isInCredentialQueue(patient: PatientRowViewModel): boolean {
  if (!patient.canIssue) return false;
  if (patient.accountStatus === 'IMPORTED') return true;
  return patient.accountStatus === 'INVITED' && patient.invitationStatus !== 'PENDING';
}

export type HistoryState = 'issued' | 'used' | 'expired' | 'revoked' | 'other';

/**
 * Last known state of the patient's credential. The API keeps only the current invitation, so the
 * history is one row per patient, not a log of every issue.
 */
export function historyStateOf(patient: PatientRowViewModel): HistoryState | null {
  if (patient.accountStatus === 'ACTIVE') return 'used';
  if (patient.invitationStatus === null) return null;
  switch (patient.invitationStatus) {
    case 'PENDING':
      return 'issued';
    case 'EXPIRED':
      return 'expired';
    case 'REVOKED':
      return 'revoked';
    default:
      return 'other';
  }
}

export function credentialHistory(patients: readonly PatientRowViewModel[]): readonly PatientRowViewModel[] {
  return patients.filter((patient) => historyStateOf(patient) !== null);
}
