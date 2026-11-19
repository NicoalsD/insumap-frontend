import { z } from 'zod';
import { instant, pageOf, roleSchema, simulatedFlag, uuid } from './common';

export const clinicSchema = z.object({
  id: uuid,
  name: z.string(),
  status: z.enum(['ACTIVE', 'SUSPENDED']),
  /** Optional contract flag (API.md 1.2), never shown in the UI. */
  is_demo: z.boolean().default(false),
  simulated: simulatedFlag,
  timezone: z.string(),
});
export type ClinicDto = z.infer<typeof clinicSchema>;

export const IMPORT_SOURCES = ['FHIR', 'CSV'] as const;
export const IMPORT_ROW_STATUSES = ['VALID', 'WARNING', 'ERROR', 'SKIPPED_DUPLICATE'] as const;

const importTotalsSchema = z.object({
  valid: z.number().int(),
  warning: z.number().int(),
  error: z.number().int(),
  skipped_duplicate: z.number().int(),
});

/** `POST /imports/fhir|csv` (preview) and `GET /imports/{id}`. Status values are still undefined in API.md. */
export const importBatchSchema = z.object({
  batch_id: uuid,
  source: z.enum(IMPORT_SOURCES),
  status: z.string(),
  created_by: z.string().optional(),
  created_at: instant.optional(),
  totals: importTotalsSchema,
  simulated: simulatedFlag,
});
export type ImportBatchDto = z.infer<typeof importBatchSchema>;
export const importBatchPageSchema = pageOf(importBatchSchema);

/** `GET /imports/{id}/rows`: per-row validation, never the raw row. */
export const importRowSchema = z.object({
  row_number: z.number().int(),
  status: z.enum(IMPORT_ROW_STATUSES),
  issue_codes: z.array(z.string()),
  patient_id: z.string().nullable(),
});
export type ImportRowDto = z.infer<typeof importRowSchema>;
export const importRowPageSchema = pageOf(importRowSchema);

/** `POST /patients/{id}/credential-invitations`. `activation_code` appears once, only for PRINT. */
export const credentialInvitationSchema = z.object({
  invitation_id: uuid,
  purpose: z.enum(['PATIENT_ACTIVATION', 'PASSWORD_RESET']),
  status: z.literal('PENDING'),
  channel: z.enum(['PRINT', 'EMAIL']),
  expires_at: instant,
  delivery_status: z.string(),
  activation_code: z.string().optional(),
});
export type CredentialInvitationDto = z.infer<typeof credentialInvitationSchema>;

/** Administrative patient view: never clinical data (API.md 8.4). */
export const patientAdminSchema = z.object({
  id: uuid,
  full_name: z.string(),
  mrn: z.string(),
  document_last4: z.string(),
  account_status: z.enum(['IMPORTED', 'INVITED', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED']),
  primary_doctor_id: z.string().nullable(),
  assigned_doctor_count: z.number().int(),
  invitation_status: z.string().nullable(),
  simulated: simulatedFlag,
});
export type PatientAdminDto = z.infer<typeof patientAdminSchema>;
export const patientAdminPageSchema = pageOf(patientAdminSchema);

export const careAssignmentSchema = z.object({
  id: uuid,
  patient_id: uuid,
  doctor_id: uuid,
  is_primary: z.boolean(),
  started_at: instant,
  ended_at: instant.nullable(),
  end_reason: z.string().nullable(),
  /** Display names for the admin table (proposed; the API returns ids only). */
  patient_name: z.string().optional(),
  doctor_name: z.string().optional(),
});
export type CareAssignmentDto = z.infer<typeof careAssignmentSchema>;
export const careAssignmentPageSchema = pageOf(careAssignmentSchema);

/** `GET /users?role=` (API.md 8.3): clinic staff for the admin console. Never clinical data. */
export const staffUserSchema = z.object({
  id: uuid,
  full_name: z.string(),
  email: z.string(),
  role: roleSchema,
  status: z.enum(['ACTIVE', 'INACTIVE']),
  /** Active care-team assignments of this staff member (primary or not). */
  patients_count: z.number().int(),
});
export type StaffUserDto = z.infer<typeof staffUserSchema>;
export const staffUserPageSchema = pageOf(staffUserSchema);
