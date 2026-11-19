import { describe, expect, it } from 'vitest';
import type { CareAssignmentDto, PatientAdminDto } from '@/services/dto/admin';
import { CareAssignmentViewModelAdapter } from './CareAssignmentViewModelAdapter';
import { doctorLoads, doctorNameMap, loadShare } from './careTeamSummary';
import { credentialHistory, historyStateOf, isInCredentialQueue } from './credentialStatus';
import { PatientAdminViewModelAdapter, type PatientRowViewModel } from './PatientAdminViewModelAdapter';
import {
  countPatients,
  matchesPatientFilters,
  needsFullRoster,
  serverFilterFor,
  type PatientFilters,
} from './patientFilters';

const DOCTOR = 'd0000000-0000-4000-8000-000000000001';
const PATIENT_ID = 'a0000000-0000-4000-8000-000000000001';

function dto(overrides: Partial<PatientAdminDto>): PatientAdminDto {
  return {
    id: PATIENT_ID,
    full_name: 'Camila Restrepo',
    mrn: 'MRN-1',
    document_last4: '0001',
    account_status: 'ACTIVE',
    primary_doctor_id: DOCTOR,
    assigned_doctor_count: 1,
    invitation_status: null,
    simulated: false,
    ...overrides,
  };
}

function row(overrides: Partial<PatientRowViewModel>): PatientRowViewModel {
  return { ...new PatientAdminViewModelAdapter().adapt(dto({})), ...overrides };
}

const ALL: PatientFilters = { view: 'all', accountStatus: 'ALL', doctorId: '', search: '' };

describe('PatientAdminViewModelAdapter', () => {
  it('resolves the primary doctor name from the map and marks issuable states', () => {
    const adapter = new PatientAdminViewModelAdapter(new Map([[DOCTOR, 'Mauricio Henao']]));
    const active = adapter.adapt(dto({}));
    expect(active.primaryDoctorName).toBe('Mauricio Henao');
    expect(active.canIssue).toBe(true);
    expect(adapter.adapt(dto({ account_status: 'SUSPENDED' })).canIssue).toBe(false);
    expect(adapter.adapt(dto({ account_status: 'DEACTIVATED' })).canIssue).toBe(false);
  });

  it('leaves the doctor name empty when the patient has no primary doctor', () => {
    const view = new PatientAdminViewModelAdapter(new Map([[DOCTOR, 'Mauricio Henao']])).adapt(
      dto({ primary_doctor_id: null, assigned_doctor_count: 0 }),
    );
    expect(view.primaryDoctorName).toBeNull();
  });
});

describe('CareAssignmentViewModelAdapter', () => {
  const assignment: CareAssignmentDto = {
    id: 'c1',
    patient_id: PATIENT_ID,
    doctor_id: DOCTOR,
    is_primary: true,
    started_at: '2026-10-01T10:00:00.000Z',
    ended_at: null,
    end_reason: null,
  };

  it('takes the patient name from the roster when the assignment omits it', () => {
    const adapter = new CareAssignmentViewModelAdapter(new Map([[PATIENT_ID, 'Camila Restrepo']]));
    expect(adapter.adapt(assignment).patientName).toBe('Camila Restrepo');
    expect(adapter.adapt({ ...assignment, patient_name: 'Otra Persona' }).patientName).toBe('Otra Persona');
    expect(new CareAssignmentViewModelAdapter().adapt(assignment).patientName).toBeNull();
  });
});

describe('patient counters and filters', () => {
  const roster = [
    row({ id: '1', accountStatus: 'ACTIVE', assignedDoctorCount: 1 }),
    row({ id: '2', fullName: 'Andrés Cardona', mrn: 'MRN-2', accountStatus: 'INVITED', invitationStatus: 'EXPIRED', assignedDoctorCount: 0, primaryDoctorId: null }),
    row({ id: '3', fullName: 'Sofía Vélez', mrn: 'MRN-3', accountStatus: 'IMPORTED', assignedDoctorCount: 0, primaryDoctorId: null }),
    row({ id: '4', fullName: 'Luisa Ortiz', mrn: 'MRN-4', accountStatus: 'INVITED', invitationStatus: 'PENDING', primaryDoctorId: DOCTOR }),
  ];

  it('counts active, pending activation, expired credentials and patients without doctor', () => {
    expect(countPatients(roster)).toEqual({ active: 1, pending: 3, expired: 1, noDoctor: 2 });
  });

  it('applies the view, the status, the doctor and the search together', () => {
    const match = (f: Partial<PatientFilters>) => roster.filter((p) => matchesPatientFilters(p, { ...ALL, ...f })).map((p) => p.id);
    expect(match({ view: 'pending' })).toEqual(['2', '3', '4']);
    expect(match({ view: 'expired' })).toEqual(['2']);
    expect(match({ view: 'noDoctor' })).toEqual(['2', '3']);
    expect(match({ accountStatus: 'INVITED', doctorId: DOCTOR })).toEqual(['4']);
    expect(match({ search: '  luisa ' })).toEqual(['4']);
    expect(match({ search: 'MRN-3' })).toEqual(['3']);
  });

  it('sends only the filters the API applies, and asks for every page when the client filters need them', () => {
    expect(serverFilterFor({ ...ALL, view: 'active' })).toEqual({ accountStatus: 'ACTIVE', withoutDoctor: false });
    expect(serverFilterFor({ ...ALL, view: 'noDoctor' })).toEqual({ withoutDoctor: true });
    expect(serverFilterFor({ ...ALL, accountStatus: 'SUSPENDED' })).toEqual({ accountStatus: 'SUSPENDED', withoutDoctor: false });
    expect(needsFullRoster(ALL)).toBe(false);
    expect(needsFullRoster({ ...ALL, search: 'a' })).toBe(true);
    expect(needsFullRoster({ ...ALL, view: 'expired' })).toBe(true);
  });
});

describe('credential queue and history', () => {
  it('queues imported patients and invited ones whose code is no longer pending', () => {
    expect(isInCredentialQueue(row({ accountStatus: 'IMPORTED' }))).toBe(true);
    expect(isInCredentialQueue(row({ accountStatus: 'INVITED', invitationStatus: 'EXPIRED' }))).toBe(true);
    expect(isInCredentialQueue(row({ accountStatus: 'INVITED', invitationStatus: 'PENDING' }))).toBe(false);
    expect(isInCredentialQueue(row({ accountStatus: 'ACTIVE' }))).toBe(false);
    expect(isInCredentialQueue(row({ accountStatus: 'SUSPENDED' }))).toBe(false);
  });

  it('derives the last known state of each credential from the roster', () => {
    expect(historyStateOf(row({ accountStatus: 'ACTIVE' }))).toBe('used');
    expect(historyStateOf(row({ accountStatus: 'INVITED', invitationStatus: 'PENDING' }))).toBe('issued');
    expect(historyStateOf(row({ accountStatus: 'INVITED', invitationStatus: 'EXPIRED' }))).toBe('expired');
    expect(historyStateOf(row({ accountStatus: 'INVITED', invitationStatus: 'REVOKED' }))).toBe('revoked');
    expect(historyStateOf(row({ accountStatus: 'INVITED', invitationStatus: 'SOMETHING_NEW' }))).toBe('other');
    expect(historyStateOf(row({ accountStatus: 'IMPORTED', invitationStatus: null }))).toBeNull();
    expect(credentialHistory([row({ accountStatus: 'IMPORTED' }), row({ accountStatus: 'ACTIVE' })])).toHaveLength(1);
  });
});

describe('care team summary', () => {
  const assign = (patientId: string, doctorId: string, doctorName: string | null) => ({
    id: `${patientId}-${doctorId}`,
    patientId,
    patientName: null,
    doctorId,
    doctorName,
    isPrimary: true,
    startedAt: '2026-10-01T10:00:00.000Z',
  });

  it('counts distinct patients per doctor, largest load first', () => {
    const loads = doctorLoads([
      assign('p1', 'dA', 'Ana'),
      assign('p2', 'dA', 'Ana'),
      assign('p2', 'dA', 'Ana'),
      assign('p3', 'dB', 'Beto'),
    ]);
    expect(loads).toEqual([
      { doctorId: 'dA', doctorName: 'Ana', patientCount: 2 },
      { doctorId: 'dB', doctorName: 'Beto', patientCount: 1 },
    ]);
  });

  it('maps doctor ids to names and computes bar shares without dividing by zero', () => {
    expect(doctorNameMap([assign('p1', 'dA', 'Ana'), assign('p2', 'dB', null)])).toEqual(new Map([['dA', 'Ana']]));
    expect(loadShare(1, 4)).toBe(0.25);
    expect(loadShare(0, 0)).toBe(0);
  });
});
