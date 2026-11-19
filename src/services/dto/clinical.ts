import { z } from 'zod';
import type { FieldLimitsDto } from './meta';
import { instant, pageOf, simulatedFlag, uuid, windowSchema } from './common';
import { treatmentScheduleItemSchema, type TreatmentScheduleItemDto } from './care';
import { targetProfileSchema } from './targetProfile';
import { injectionPatientFieldsSchema } from './injection';

/** Window metrics (API.md 8.8). `gmi`/`cv` are null for SMBG patients (no AGP). */
export const glycemicMetricsSchema = z.object({
  tir_pct: z.number(),
  tbr_l1_pct: z.number(),
  tbr_l2_pct: z.number(),
  tbr_pct: z.number(),
  tar_l1_pct: z.number(),
  tar_l2_pct: z.number(),
  tar_pct: z.number(),
  mean_glucose_mg_dl: z.number(),
  gmi_pct: z.number().nullable(),
  cv_pct: z.number().nullable(),
  hypo_events_count: z.number().int(),
});
export type GlycemicMetricsDto = z.infer<typeof glycemicMetricsSchema>;

/** `GET /patients/{id}/metrics` and `GET /patients/own/metrics`. */
export const metricsResponseSchema = z.object({
  window: windowSchema,
  period_from: instant,
  period_to: instant,
  timezone: z.string(),
  target_profile: targetProfileSchema,
  data_sufficiency_pct: z.number(),
  is_sufficient: z.boolean(),
  confidence: z.enum(['NORMAL', 'LOW_CONFIDENCE']),
  metrics: glycemicMetricsSchema,
  previous: glycemicMetricsSchema.optional(),
  tir_delta_pct: z.number().optional(),
});
export type MetricsResponseDto = z.infer<typeof metricsResponseSchema>;

/** `GET /patients/{id}/metrics/agp`. Empty `bins` with `is_sufficient: false` when data is short. */
export const agpResponseSchema = z.object({
  bins: z.array(
    z.object({
      /** Local time of day `HH:MM` (proposed name, API.md 8.8 lists the percentiles only). */
      time_of_day: z.string(),
      p5: z.number(),
      p25: z.number(),
      p50: z.number(),
      p75: z.number(),
      p95: z.number(),
    }),
  ),
  target_range: z.object({ low: z.number(), high: z.number() }),
  data_sufficiency_pct: z.number(),
  is_sufficient: z.boolean(),
});

export const READING_SOURCES = ['MANUAL', 'SMBG', 'CGM'] as const;
/** Measurement contexts. The enumeration is not in API.md yet (G8); these values are proposed. */
export const READING_CONTEXTS = [
  'FASTING',
  'BEFORE_MEAL',
  'AFTER_MEAL',
  'BEDTIME',
  'EXERCISE',
  'OTHER',
] as const;

/** `GET /readings`, `GET /patients/{id}/readings`. */
export const glucoseReadingSchema = z.object({
  id: uuid,
  client_reading_id: z.string(),
  value_mg_dl: z.number(),
  measured_at: instant,
  source: z.enum(READING_SOURCES),
  context: z.string().nullable(),
  status: z.enum(['ACCEPTED', 'FLAGGED', 'CORRECTED']),
  issue_codes: z.array(z.string()),
  corrects_id: z.string().nullable().optional(),
  simulated: simulatedFlag,
});
export type GlucoseReadingDto = z.infer<typeof glucoseReadingSchema>;
export const glucoseReadingPageSchema = pageOf(glucoseReadingSchema);

/** Upper bound from a published field limit; a limit the API does not send adds no rule. */
const limitOf = (limits: FieldLimitsDto, key: string): number =>
  limits[key] ?? Number.MAX_SAFE_INTEGER;

/**
 * Body of `POST /readings` (API.md 8.6). Lengths come from `GET /meta/field-limits`; the value is
 * only checked for shape here, the measurable range is the server's decision (`GLUCOSE_OUT_OF_RANGE`).
 */
export function readingCreateSchema(limits: FieldLimitsDto) {
  return z.object({
    client_reading_id: z.string().min(1).max(limitOf(limits, 'request_id_max_length')),
    value_mg_dl: z.number().positive(),
    measured_at: z.iso.datetime({ offset: true }),
    source: z.enum(READING_SOURCES).default('MANUAL'),
    context: z.enum(READING_CONTEXTS).nullable().optional(),
    note: z.string().max(limitOf(limits, 'note_max_length')).optional(),
  });
}
/** Request body of `POST /readings`: the input shape, before defaults. */
export type ReadingCreateDto = z.input<ReturnType<typeof readingCreateSchema>>;

export const ALERT_TYPES = ['HYPOGLYCEMIA', 'HYPERGLYCEMIA', 'ADHERENCE', 'PREDICTIVE'] as const;
export const ALERT_STATUSES = ['OPEN', 'ACKNOWLEDGED', 'ESCALATED', 'RESOLVED'] as const;

/** `GET /alerts`. Status values beyond OPEN/ACKNOWLEDGED/RESOLVED are proposed (API.md leaves them open). */
export const alertSchema = z.object({
  id: uuid,
  patient_id: uuid,
  type: z.enum(ALERT_TYPES),
  level: z.number().int().nullable(),
  priority: z.string(),
  status: z.enum(ALERT_STATUSES),
  opened_at: instant,
  rule_id: z.string().nullable(),
  is_fallback: z.boolean().default(false),
  simulated: simulatedFlag,
  /** Display name of the patient, for the doctor's alert panel (proposed). */
  patient_name: z.string().optional(),
});
export type AlertDto = z.infer<typeof alertSchema>;
export const alertPageSchema = pageOf(alertSchema);

export const RECOMMENDATION_STATUSES = [
  'PROPOSED',
  'APPROVED',
  'APPROVED_WITH_CHANGES',
  'REJECTED',
  'APPLIED',
  'EXPIRED',
] as const;

const aiExplanationSchema = z.object({
  summary: z.string(),
  factors: z.array(z.string()),
  data_refs: z.array(z.string()),
});

export const recommendationProposalSchema = z.object({
  action: z.enum(['INCREASE', 'DECREASE']),
  current_dose: z.number(),
  proposed_dose: z.number(),
  delta_units: z.number(),
  requires_doctor_approval: z.literal(true),
});

/** `GET /recommendations`. The AI only proposes: the doctor decides. */
export const recommendationSchema = z.object({
  id: uuid,
  patient_id: uuid,
  status: z.enum(RECOMMENDATION_STATUSES),
  proposal: recommendationProposalSchema.nullable(),
  explanation: aiExplanationSchema,
  model_version: z.string(),
  is_fallback: z.boolean(),
  fallback_reason: z.string().nullable().optional(),
  unavailable_reason: z.string().nullable().optional(),
  expires_at: instant,
  created_at: instant,
  draft_plan_id: z.string().nullable().optional(),
  decision_reason: z.string().nullable().optional(),
  simulated: simulatedFlag,
});
export type RecommendationDto = z.infer<typeof recommendationSchema>;
export const recommendationPageSchema = pageOf(recommendationSchema);

/** `GET /dashboard/triage` row. Last reading and band percentages are proposed additions to the summary metrics. */
export const triageRowSchema = z.object({
  patient_id: uuid,
  full_name: z.string(),
  risk_tier: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  risk_score: z.number(),
  flags: z.array(z.object({ code: z.string(), reason: z.string() })),
  open_alerts_count: z.number().int(),
  pending_recommendations_count: z.number().int(),
  metrics: metricsResponseSchema,
  last_reading: z.object({ value_mg_dl: z.number(), measured_at: instant }).nullable(),
  reviewed_at: instant.nullable(),
  is_fallback: z.boolean().default(false),
  simulated: simulatedFlag,
});
export type TriageRowDto = z.infer<typeof triageRowSchema>;
export const triagePageSchema = pageOf(triageRowSchema);

/**
 * Active plan inside the overview. `schedule` carries the insulin items of the plan, as
 * `GET /patients/own/treatment-plan` does; it defaults to [] when the API omits it.
 */
const activePlanSchema = z.object({
  id: uuid,
  name: z.string(),
  version: z.number().int(),
  summary: z.string(),
  schedule: z.array(treatmentScheduleItemSchema).default([]),
});

const forecastSchema = z.object({
  mode: z.enum(['SHORT_TERM', 'OVERNIGHT']),
  generated_at: instant,
  trend: z.enum(['FALLING', 'STABLE', 'RISING']),
  is_fallback: z.boolean(),
  fallback_reason: z.string().nullable(),
});

/** `GET /patients/{id}/overview` (doctor). Reading the file never calls the AI. */
export const patientOverviewSchema = z.object({
  patient: z.object({ id: uuid, full_name: z.string() }).extend(injectionPatientFieldsSchema.shape),
  target_profile: targetProfileSchema,
  latest_readings: z.array(glucoseReadingSchema),
  metrics: metricsResponseSchema,
  active_plan: activePlanSchema.nullable(),
  open_alerts: z.array(alertSchema),
  pending_recommendations: z.array(recommendationSchema),
  latest_forecast: forecastSchema.nullable(),
  simulated: simulatedFlag,
  data_source: z.literal('SIMULATED').optional(),
});
/**
 * Overview as the app builds it. `active_plan.schedule` is optional in the type (the schema defaults it
 * to [] when parsing), so the app's literals do not have to spell it out; its items keep required fields.
 */
type ActivePlanDto = Omit<z.infer<typeof activePlanSchema>, 'schedule'> & {
  schedule?: TreatmentScheduleItemDto[];
};
export type PatientOverviewDto = Omit<z.infer<typeof patientOverviewSchema>, 'active_plan'> & {
  active_plan: ActivePlanDto | null;
};

/** `GET /patients/own/overview`: no recommendations and no forecast, the patient never sees AI doses. */
export const ownOverviewSchema = patientOverviewSchema.omit({
  pending_recommendations: true,
  latest_forecast: true,
});
export type OwnOverviewDto = Omit<z.infer<typeof ownOverviewSchema>, 'active_plan'> & {
  active_plan: ActivePlanDto | null;
};
