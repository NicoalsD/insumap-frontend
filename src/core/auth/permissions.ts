/**
 * Permission codes of `iam.permissions` as `GET /auth/me` returns them (API.md section 8).
 * They are identifiers, not clinical values. Route guards use them for UX only: the server decides.
 */
export const PERMISSIONS = {
  triageRead: 'dashboard.read_assigned',
  patientRead: 'patients.read_assigned',
  patientReadOwn: 'patients.read_own',
  metricsRead: 'metrics.read_assigned',
  metricsReadOwn: 'metrics.read_own',
  alertsRead: 'alerts.read_assigned',
  alertsReadOwn: 'alerts.read_own',
  alertsAcknowledge: 'alerts.acknowledge',
  alertsResolve: 'alerts.resolve',
  recommendationsRead: 'recommendations.read_assigned',
  recommendationsDecide: 'recommendations.decide',
  glucoseWriteOwn: 'glucose.write_own',
  glucoseReadOwn: 'glucose.read_own',
  patientsImport: 'patients.import',
  patientsRoster: 'patients.read_roster',
  importBatchesRead: 'import_batches.read',
  credentialsIssue: 'credentials.issue',
  careTeamRead: 'care_team.read',
  clinicRead: 'clinics.read',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export type Role = 'DOCTOR' | 'PATIENT' | 'CLINIC_ADMIN' | 'PLATFORM_ADMIN';
