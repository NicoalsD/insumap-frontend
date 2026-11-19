/**
 * Permission codes of `iam.permissions` as `GET /auth/current-user` returns them (API.md section 8).
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
  treatmentPlanReadOwn: 'treatment_plans.read_own',
  remindersManageOwn: 'reminders.manage_own',
  clinicalNotesManage: 'clinical_notes.manage',
  messagesUseOwn: 'messages.use_own',
  messagesUseAssigned: 'messages.use_assigned',
  usersRead: 'users.read',
  recordsWriteOwn: 'records.write_own',
  recordsReadOwn: 'records.read_own',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export type Role = 'DOCTOR' | 'PATIENT' | 'CLINIC_ADMIN' | 'PLATFORM_ADMIN';
