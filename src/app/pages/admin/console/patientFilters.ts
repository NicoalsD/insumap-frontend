import type { AccountStatus, PatientRowViewModel } from './PatientAdminViewModelAdapter';

export type PatientView = 'all' | 'active' | 'pending' | 'expired' | 'noDoctor';
export const PATIENT_VIEWS: readonly PatientView[] = ['all', 'active', 'pending', 'expired', 'noDoctor'];

export interface PatientFilters {
  readonly view: PatientView;
  /** `'ALL'` or one account status. */
  readonly accountStatus: AccountStatus | 'ALL';
  /** Doctor id, or `''` for any doctor. */
  readonly doctorId: string;
  /** Free text, matched against name and MRN. Never sent to the server or written to the URL. */
  readonly search: string;
}

export interface PatientCounts {
  readonly active: number;
  readonly pending: number;
  readonly expired: number;
  readonly noDoctor: number;
}

/** A patient still waiting to activate: imported, or invited and not yet activated (API.md 8.4). */
export function isPendingActivation(patient: PatientRowViewModel): boolean {
  return patient.accountStatus === 'IMPORTED' || patient.accountStatus === 'INVITED';
}

export function isCredentialExpired(patient: PatientRowViewModel): boolean {
  return patient.invitationStatus === 'EXPIRED';
}

export function hasNoDoctor(patient: PatientRowViewModel): boolean {
  return patient.assignedDoctorCount === 0;
}

/** Counters of the header. Computed over the full roster, since the API returns no totals. */
export function countPatients(patients: readonly PatientRowViewModel[]): PatientCounts {
  return {
    active: patients.filter((p) => p.accountStatus === 'ACTIVE').length,
    pending: patients.filter(isPendingActivation).length,
    expired: patients.filter(isCredentialExpired).length,
    noDoctor: patients.filter(hasNoDoctor).length,
  };
}

/** Whether a filter needs rows that the server has not sent yet, so every page must be loaded first. */
export function needsFullRoster(filters: PatientFilters): boolean {
  return filters.search !== '' || filters.doctorId !== '' || filters.view === 'pending' || filters.view === 'expired';
}

/** The subset of filters the API applies itself. The client re-checks everything in `matchesPatientFilters`. */
export function serverFilterFor(filters: PatientFilters): {
  readonly accountStatus?: AccountStatus;
  readonly withoutDoctor: boolean;
} {
  const accountStatus =
    filters.accountStatus !== 'ALL' ? filters.accountStatus : filters.view === 'active' ? 'ACTIVE' : undefined;
  return {
    ...(accountStatus === undefined ? {} : { accountStatus }),
    withoutDoctor: filters.view === 'noDoctor',
  };
}

export function matchesPatientFilters(patient: PatientRowViewModel, filters: PatientFilters): boolean {
  if (filters.accountStatus !== 'ALL' && patient.accountStatus !== filters.accountStatus) return false;
  if (filters.doctorId !== '' && patient.primaryDoctorId !== filters.doctorId) return false;
  switch (filters.view) {
    case 'all':
      break;
    case 'active':
      if (patient.accountStatus !== 'ACTIVE') return false;
      break;
    case 'pending':
      if (!isPendingActivation(patient)) return false;
      break;
    case 'expired':
      if (!isCredentialExpired(patient)) return false;
      break;
    case 'noDoctor':
      if (!hasNoDoctor(patient)) return false;
      break;
  }
  const term = filters.search.trim().toLocaleLowerCase('es-CO');
  if (term === '') return true;
  return (
    patient.fullName.toLocaleLowerCase('es-CO').includes(term) || patient.mrn.toLocaleLowerCase('es-CO').includes(term)
  );
}
