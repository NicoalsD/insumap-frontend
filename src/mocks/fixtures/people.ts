import type { Role } from '@/core/auth/permissions';
import type { ClinicDto } from '@/services/dto/admin';

/** Reserved test domain only (AGENTS.md 3.5). All names are fictitious. */
export const DEMO_CLINIC: ClinicDto = {
  id: 'c1000000-0000-4000-8000-000000000001',
  name: 'Clínica Demo Insumap',
  status: 'ACTIVE',
  is_demo: true,
  simulated: true,
  timezone: 'America/Bogota',
};

export interface FixtureAccount {
  readonly id: string;
  readonly email: string;
  /** Demo-only password of a fictitious account; it protects nothing. */
  readonly password: string;
  readonly fullName: string;
  readonly role: Role;
  readonly permissions: readonly string[];
  /** Staff verify a TOTP; patients do not. */
  readonly mfaEnabled: boolean;
}

/** TOTP code the mock MFA accepts (fixture only). */
export const DEMO_TOTP_CODE = '123456';
/** Recovery code the mock MFA accepts (fixture only). */
export const DEMO_RECOVERY_CODE = 'ABCDE-12345';

export const DOCTOR_ACCOUNT: FixtureAccount = {
  id: 'd1000000-0000-4000-8000-000000000001',
  email: 'mauricio.henao@example.test',
  password: 'demo-password-doctor',
  fullName: 'Mauricio Henao Vélez',
  role: 'DOCTOR',
  mfaEnabled: true,
  permissions: [
    'dashboard.read_assigned',
    'patients.read_assigned',
    'metrics.read_assigned',
    'alerts.read_assigned',
    'alerts.acknowledge',
    'alerts.resolve',
    'recommendations.read_assigned',
    'recommendations.decide',
    'ai.forecasts.read_assigned',
    'care_team.read',
    'clinics.read',
  ],
};

export const PATIENT_ACCOUNT: FixtureAccount = {
  id: 'a1000003-0000-4000-8000-000000000003',
  email: 'luisa.ortiz@example.test',
  password: 'demo-password-patient',
  fullName: 'Luisa Fernanda Ortiz',
  role: 'PATIENT',
  mfaEnabled: false,
  permissions: [
    'patients.read_own',
    'metrics.read_own',
    'alerts.read_own',
    'alerts.acknowledge_own',
    'glucose.read_own',
    'glucose.write_own',
  ],
};

export const ADMIN_ACCOUNT: FixtureAccount = {
  id: 'b1000000-0000-4000-8000-000000000001',
  email: 'marta.pineda@example.test',
  password: 'demo-password-admin',
  fullName: 'Marta Lucía Pineda',
  role: 'CLINIC_ADMIN',
  mfaEnabled: true,
  permissions: [
    'patients.import',
    'patients.read_roster',
    'import_batches.read',
    'credentials.issue',
    'care_team.read',
    'clinics.read',
  ],
};

/** Staff account without MFA yet: its first login goes through `MFA_ENROLLMENT_REQUIRED`. */
export const ENROLLMENT_ACCOUNT: FixtureAccount = {
  ...DOCTOR_ACCOUNT,
  id: 'd1000000-0000-4000-8000-000000000002',
  email: 'ricardo.sanchez@example.test',
  password: 'demo-password-enrollment',
  fullName: 'Ricardo Sánchez Mora',
  mfaEnabled: false,
};

export const ACCOUNTS = [DOCTOR_ACCOUNT, PATIENT_ACCOUNT, ADMIN_ACCOUNT, ENROLLMENT_ACCOUNT] as const;

/** Activation code and birth date the mock accepts on `POST /auth/activation/verify` (fixture only). */
export const DEMO_ACTIVATION = { code: 'K7M2-9PQX-4TRD-8WHN', birthDate: '1992-03-18' } as const;

/**
 * `GET /meta/field-limits` payload. Keys beyond the ones API.md lists (`reason_*`, `note_*`,
 * `birth_date_*`) are the ones the frontend expects the API to add (marked as proposed in the docs).
 */
export const FIELD_LIMITS: Readonly<Record<string, number>> = {
  request_id_max_length: 64,
  email_max_length: 254,
  password_min_length: 12,
  password_max_length: 128,
  max_request_body_bytes: 1048576,
  page_size_default: 20,
  page_size_max: 100,
  reason_min_length: 10,
  reason_max_length: 500,
  note_max_length: 500,
};
