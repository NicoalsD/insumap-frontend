import type { Role } from '@/core/auth/permissions';
import type { ClinicDto } from '@/services/dto/admin';

/** Reserved test domain only (AGENTS.md 3.5). All names are fictitious. */
export const DEMO_CLINIC: ClinicDto = {
  id: 'c1000000-0000-4000-8000-000000000001',
  name: 'Clínica Insumap Norte',
  status: 'ACTIVE',
  is_demo: false,
  simulated: false,
  timezone: 'America/Bogota',
};

export interface FixtureAccount {
  readonly id: string;
  readonly email: string;
  /** Password of a fictitious account in this fixture; it protects nothing. */
  readonly password: string;
  readonly fullName: string;
  readonly role: Role;
  readonly permissions: readonly string[];
  /** Staff verify a TOTP; patients do not. */
  readonly mfaEnabled: boolean;
}

/** Staff member listed by `GET /users` who has no login in the fixture. */
export interface StaffProfile {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;
  readonly role: Role;
}

/** TOTP code the mock MFA accepts (fixture only). */
export const DEMO_TOTP_CODE = '123456';
/** Recovery code the mock MFA accepts (fixture only). */
export const DEMO_RECOVERY_CODE = 'ABCDE-12345';

export const DOCTOR_ACCOUNT: FixtureAccount = {
  id: 'd1000000-0000-4000-8000-000000000001',
  email: 'mauricio.henao@example.test',
  password: 'clave-ficticia-medico',
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
    'clinical_notes.manage',
    'messages.use_assigned',
  ],
};

export const PATIENT_ACCOUNT: FixtureAccount = {
  id: 'a1000003-0000-4000-8000-000000000003',
  email: 'luisa.ortiz@example.test',
  password: 'clave-ficticia-paciente',
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
    'treatment_plans.read_own',
    'records.read_own',
    'records.write_own',
    'reminders.manage_own',
    'messages.use_own',
  ],
};

export const ADMIN_ACCOUNT: FixtureAccount = {
  id: 'b1000000-0000-4000-8000-000000000001',
  email: 'marta.pineda@example.test',
  password: 'clave-ficticia-admin',
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
    'users.read',
  ],
};

/** Staff account without MFA yet: its first login goes through `MFA_ENROLLMENT_REQUIRED`. */
export const ENROLLMENT_ACCOUNT: FixtureAccount = {
  ...DOCTOR_ACCOUNT,
  id: 'd1000000-0000-4000-8000-000000000002',
  email: 'ricardo.sanchez@example.test',
  password: 'clave-ficticia-enrolamiento',
  fullName: 'Ricardo Sánchez Mora',
  mfaEnabled: false,
};

/** Second doctor of the clinic: appears in `GET /users` and shares some patients as non-primary. */
export const SECONDARY_DOCTOR: StaffProfile = {
  id: 'd1000000-0000-4000-8000-000000000003',
  email: 'lorena.vargas@example.test',
  fullName: 'Lorena Patricia Vargas',
  role: 'DOCTOR',
};

export const ACCOUNTS = [DOCTOR_ACCOUNT, PATIENT_ACCOUNT, ADMIN_ACCOUNT, ENROLLMENT_ACCOUNT] as const;

/** Clinic staff as the admin console lists them: accounts above plus staff without a login. */
export const STAFF_DIRECTORY: readonly StaffProfile[] = [
  DOCTOR_ACCOUNT,
  ENROLLMENT_ACCOUNT,
  ADMIN_ACCOUNT,
  SECONDARY_DOCTOR,
];

/** Activation code and birth date the mock accepts on `POST /auth/activation/verify` (fixture only). */
export const DEMO_ACTIVATION = { code: 'K7M2-9PQX-4TRD-8WHN', birthDate: '1992-03-18' } as const;

/**
 * `GET /meta/field-limits` payload. Keys beyond the ones API.md lists (`reason_*`, `note_*`,
 * `message_*`, `reading_*`, `readings_*`) are the ones the frontend expects the API to add (marked as
 * proposed in the docs).
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
  message_max_length: 500,
  reading_min_mg_dl: 20,
  reading_max_mg_dl: 600,
  reading_max_age_days: 14,
  readings_page_size_max: 2000,
};
