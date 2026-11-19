import { z } from 'zod';
import { calendarDate, instant, pageOf, simulatedFlag, uuid } from './common';

/**
 * Injection sites (BRIEF-injection, decision of 2026-11-19): the app tells the patient WHERE to
 * inject and shows it on the 3D body. The API never computes or suggests units.
 */
export const SITE_CODES = [
  'ABDOMEN_RIGHT',
  'ABDOMEN_LEFT',
  'THIGH_RIGHT',
  'THIGH_LEFT',
  'ARM_RIGHT',
  'ARM_LEFT',
  'BUTTOCK_RIGHT',
  'BUTTOCK_LEFT',
] as const;
export const siteCodeSchema = z.enum(SITE_CODES);
export type SiteCode = z.infer<typeof siteCodeSchema>;

/** Points per site: separated by at least 2.5 cm inside the zone; the spot rotates before it repeats. */
export const SPOTS_PER_SITE = 4;
export const injectionSpotSchema = z.number().int().min(1).max(SPOTS_PER_SITE);

export const INJECTION_SITE_STATES = ['SUGGESTED', 'ALLOWED', 'RECENT', 'AVOID'] as const;
export const injectionSiteStateSchema = z.enum(INJECTION_SITE_STATES);
export type InjectionSiteState = z.infer<typeof injectionSiteStateSchema>;

export const INJECTION_REASON_CODES = [
  'PLAN_RESTRICTED',
  'LIPOHYPERTROPHY_REPORTED',
  'PREGNANCY_AVOID_ABDOMEN_CENTER',
  'LEAN_AVOID_LIMBS',
  'RECENTLY_USED',
  'FASTEST_ABSORPTION',
  'STEADY_ABSORPTION',
  'ROTATE_NEXT',
] as const;
export const injectionReasonCodeSchema = z.enum(INJECTION_REASON_CODES);
export type InjectionReasonCode = z.infer<typeof injectionReasonCodeSchema>;

/** Needle note: a 4 mm needle, with or without a skin pinch (lean, under 18, or an arm or thigh at low BMI). */
export const NEEDLE_NOTES = ['NEEDLE_4MM_PINCH_OPTIONAL', 'NEEDLE_4MM_PINCH_UP'] as const;
export const needleNoteSchema = z.enum(NEEDLE_NOTES);
export type NeedleNote = z.infer<typeof needleNoteSchema>;

export const INSULIN_KINDS = ['BASAL', 'BOLUS', 'CORRECTION', 'MIXED'] as const;
export const insulinKindSchema = z.enum(INSULIN_KINDS);
export type InsulinKind = z.infer<typeof insulinKindSchema>;

/** Patient sex and pregnancy as the record holds them (the rules read both). */
export const PATIENT_SEXES = ['FEMALE', 'MALE', 'OTHER', 'UNKNOWN'] as const;
export const patientSexSchema = z.enum(PATIENT_SEXES);
export type PatientSex = z.infer<typeof patientSexSchema>;

export const PREGNANCY_STATUSES = ['NONE', 'PREGNANT', 'UNKNOWN'] as const;
export const pregnancyStatusSchema = z.enum(PREGNANCY_STATUSES);
export type PregnancyStatus = z.infer<typeof pregnancyStatusSchema>;

/** One suggestion: the single site and spot the patient should use now. */
export const injectionSuggestionSchema = z.object({
  site: siteCodeSchema,
  spot: injectionSpotSchema,
  reason_codes: z.array(injectionReasonCodeSchema),
  needle_note: needleNoteSchema,
  pinch_up: z.boolean(),
});
export type InjectionSuggestionDto = z.infer<typeof injectionSuggestionSchema>;

export const injectionSiteStatusSchema = z.object({
  site: siteCodeSchema,
  state: injectionSiteStateSchema,
  reason_code: injectionReasonCodeSchema.nullable(),
  last_used_at: instant.nullable(),
  last_spot: injectionSpotSchema.nullable(),
});
export type InjectionSiteStatusDto = z.infer<typeof injectionSiteStatusSchema>;

/**
 * `GET /patients/own/injection-sites?kind=` (BRIEF-injection). `suggestion` is null only when no
 * site is safe for this patient and kind; the app then asks the patient to talk to the doctor.
 */
export const injectionSitesResponseSchema = z.object({
  kind: insulinKindSchema,
  suggestion: injectionSuggestionSchema.nullable(),
  sites: z.array(injectionSiteStatusSchema),
  rules_version: z.string(),
});
export type InjectionSitesDto = z.infer<typeof injectionSitesResponseSchema>;

/**
 * Insulin dose as the API returns it (API.md, `POST /insulin-doses`): `kind` and `units` name the dose;
 * the product (catalogue G10), the active plan and the simulated flag are null or false when unknown.
 */
export const insulinDoseSchema = z.object({
  id: uuid,
  insulin_product_id: uuid.nullable().default(null),
  kind: insulinKindSchema,
  units: z.number(),
  administered_at: instant,
  treatment_plan_id: uuid.nullable().default(null),
  injection_site: siteCodeSchema.nullable(),
  injection_spot: injectionSpotSchema.nullable(),
  simulated: simulatedFlag,
});
export type InsulinDoseDto = z.infer<typeof insulinDoseSchema>;
export const insulinDosePageSchema = pageOf(insulinDoseSchema);

/**
 * Body of `POST /insulin-doses` (API.md). `kind` is BASAL, BOLUS, CORRECTION or MIXED; the API only
 * records what the patient reports and never computes a dose. A spot without a site makes no sense.
 */
export const insulinDoseCreateSchema = z
  .object({
    insulin_product_id: uuid.nullable().optional(),
    kind: insulinKindSchema,
    units: z.number().positive(),
    administered_at: z.iso.datetime({ offset: true }),
    injection_site: siteCodeSchema.nullable().optional(),
    injection_spot: injectionSpotSchema.nullable().optional(),
  })
  .refine((body) => body.injection_spot == null || body.injection_site != null, {
    path: ['injection_spot'],
    message: 'injection_spot requires injection_site',
  });
export type InsulinDoseCreateDto = z.input<typeof insulinDoseCreateSchema>;

/** Patient-level injection data of the overview (see `patientOverviewSchema`). */
export const injectionPatientFieldsSchema = z.object({
  sex: patientSexSchema.default('UNKNOWN'),
  birth_date: calendarDate.nullable().default(null),
  bmi: z.number().nullable().default(null),
  pregnancy_status: pregnancyStatusSchema.default('UNKNOWN'),
});
