import { z } from 'zod';
import { instant, pageOf, uuid } from './common';

/** `HH:MM` local time of day (API.md 8.7 leaves the schedule shape open; this is the proposal). */
const timeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/**
 * `GET /patients/own/treatment-plan` (API.md 8.7): the active plan in plain language. Doses are the
 * ones the plan prescribes; the AI never adds one here, so there is no recommendation field.
 */
export const treatmentScheduleItemSchema = z.object({
  time_of_day: timeOfDaySchema,
  label: z.string(),
  /** Prescribed units, or null when the plan gives no fixed dose (for example, meal bolus by carbohydrates). */
  dose_units: z.number().nullable(),
});
export type TreatmentScheduleItemDto = z.infer<typeof treatmentScheduleItemSchema>;

export const treatmentPlanSchema = z.object({
  id: uuid,
  name: z.string(),
  version: z.number().int(),
  summary: z.string(),
  updated_at: instant.optional(),
  schedule: z.array(treatmentScheduleItemSchema),
});
export type TreatmentPlanDto = z.infer<typeof treatmentPlanSchema>;

/** `GET /reminders` and `PATCH /reminders/{id}` for the signed-in patient (API.md 8.7). */
export const reminderSchema = z.object({
  id: uuid,
  label: z.string(),
  time_of_day: timeOfDaySchema,
  enabled: z.boolean(),
});
export type ReminderDto = z.infer<typeof reminderSchema>;
export const reminderPageSchema = pageOf(reminderSchema);

/** Body of `PATCH /reminders/{id}`: only what the plan allows the patient to change. */
export const reminderUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  time_of_day: timeOfDaySchema.optional(),
});
export type ReminderUpdateDto = z.input<typeof reminderUpdateSchema>;

/** `GET` and `POST /patients/{id}/clinical-notes` (API.md 8.11). Notes are append-only. */
export const clinicalNoteSchema = z.object({
  id: uuid,
  body: z.string(),
  author_name: z.string(),
  created_at: instant,
});
export type ClinicalNoteDto = z.infer<typeof clinicalNoteSchema>;
export const clinicalNotePageSchema = pageOf(clinicalNoteSchema);

/** `GET /messages` and `POST /messages` (API.md 8.12). The thread is append-only. */
export const MESSAGE_SENDER_ROLES = ['PATIENT', 'DOCTOR'] as const;

export const messageSchema = z.object({
  id: uuid,
  sender_role: z.enum(MESSAGE_SENDER_ROLES),
  body: z.string(),
  sent_at: instant,
  read_at: instant.nullable(),
});
export type MessageDto = z.infer<typeof messageSchema>;
/** The list carries the permanent "not an emergency channel" notice next to the messages (RF-85). */
export const messagePageSchema = pageOf(messageSchema).extend({
  emergency_notice: z.string().optional(),
});
export type MessagePageDto = z.infer<typeof messagePageSchema>;

/** Body of `POST /messages`. `patient_id` is only read from doctors. */
export interface MessageCreateDto {
  readonly body: string;
  readonly patient_id?: string;
}
