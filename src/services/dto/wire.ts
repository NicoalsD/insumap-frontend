import { z } from 'zod';
import { instant, uuid, windowSchema } from './common';
import { glycemicMetricsSchema, type PatientOverviewDto, type TriageRowDto } from './clinical';
import { targetProfileSchema, type TargetProfileDto } from './targetProfile';
import { injectionSpotSchema, insulinKindSchema, siteCodeSchema, type InsulinDoseDto } from './injection';
import type { TreatmentPlanDto } from './care';
import { staffUserSchema } from './admin';

/**
 * Shapes the API really sends (read from its OpenAPI), each one turned into the DTO the screens
 * use. Keeping the translation here means a contract change touches one file, not the UI.
 */

const MINUTES_PER_HOUR = 60;
const TIME_PART_WIDTH = 2;
/** `HH:MM` of a `HH:MM:SS` time. */
const HHMM_LENGTH = 5;

const offsetInstant = z.iso.datetime({ offset: true });

/** Cut points and goals of a profile as `target` (overview) and `target_profile` (metrics) carry them. */
const thresholdFields = {
  population: z.string().optional(),
  range_low_mg_dl: z.number(),
  range_high_mg_dl: z.number(),
  very_low_mg_dl: z.number(),
  very_high_mg_dl: z.number(),
  tir_min_pct: z.number(),
  tbr_l1_max_pct: z.number(),
  tbr_l2_max_pct: z.number(),
  tar_l1_max_pct: z.number(),
  tar_l2_max_pct: z.number(),
  cv_max_pct: z.number(),
  min_data_sufficiency_pct: z.number(),
  min_days: z.number().int(),
  night_start: z.string().optional(),
  night_end: z.string().optional(),
};

function profileOf(id: string, code: string, version: number, rest: Omit<TargetProfileDto, 'id' | 'code' | 'version' | 'label'>): TargetProfileDto {
  // The API names profiles by code only; the code is the label until the catalog sends one.
  return { id, code, version, label: code, ...rest };
}

/** With too little data the API sends null shares; the screens show "insufficient" and read zeros. */
const nullableShare = z.number().nullable().transform((value) => value ?? 0);
const wireGlycemicSchema = z.object({
  tir_pct: nullableShare,
  tbr_l1_pct: nullableShare,
  tbr_l2_pct: nullableShare,
  tbr_pct: nullableShare,
  tar_l1_pct: nullableShare,
  tar_l2_pct: nullableShare,
  tar_pct: nullableShare,
  mean_glucose_mg_dl: nullableShare,
  gmi_pct: z.number().nullable(),
  cv_pct: z.number().nullable(),
  hypo_events_count: z.number().int(),
});

const wireMetricsSchema = z
  .object({
    window: windowSchema,
    period_from: offsetInstant,
    period_to: offsetInstant,
    timezone: z.string(),
    target_profile: z.object({ id: uuid, code: z.string(), version: z.number().int(), ...thresholdFields }),
    data_sufficiency_pct: z.number(),
    is_sufficient: z.boolean(),
    confidence: z.enum(['NORMAL', 'LOW_CONFIDENCE']),
    metrics: wireGlycemicSchema,
    previous: z.unknown().optional().transform((value) => {
      const parsed = glycemicMetricsSchema.safeParse(value);
      return parsed.success ? parsed.data : undefined;
    }),
    tir_delta_pct: z.number().nullish(),
  })
  .transform(({ target_profile: p, previous, tir_delta_pct: delta, ...rest }) => {
    const { id, code, version, ...thresholds } = p;
    return {
      ...rest,
      target_profile: profileOf(id, code, version, thresholds),
      ...(previous ? { previous } : {}),
      ...(delta === null || delta === undefined ? {} : { tir_delta_pct: delta }),
    };
  });
export { wireMetricsSchema as metricsResponseSchema };

const wireReadingSchema = z.object({
  id: uuid,
  value_mg_dl: z.number(),
  measured_at: instant,
  source: z.enum(['MANUAL', 'SMBG', 'CGM']),
  context: z.string().nullable(),
});

const wireOverviewSchema = z.object({
  patient_id: uuid,
  timezone: z.string(),
  target: z.object({
    profile_id: uuid,
    profile_code: z.string(),
    profile_version: z.number().int(),
    ...thresholdFields,
  }),
  recent_readings: z.array(wireReadingSchema),
  active_plan: z.object({ id: uuid, version: z.number().int(), status: z.string() }).nullable(),
  open_alerts: z.array(z.object({ id: uuid, alert_type: z.string(), priority: z.string(), status: z.string(), opened_at: instant })),
  simulated: z.boolean().default(false),
  sex: z.enum(['FEMALE', 'MALE', 'OTHER', 'UNKNOWN']).default('UNKNOWN'),
  bmi: z.number().nullable().default(null),
  pregnancy_status: z.enum(['NONE', 'PREGNANT', 'UNKNOWN']).default('UNKNOWN'),
});

/** `GET /patients/{id}/overview` and `/patients/own/overview`. The API sends no patient name. */
export const overviewResponseSchema = wireOverviewSchema.transform((wire): PatientOverviewDto => {
  const { profile_id, profile_code, profile_version, ...thresholds } = wire.target;
  return {
    patient: { id: wire.patient_id, full_name: '', sex: wire.sex, birth_date: null, bmi: wire.bmi, pregnancy_status: wire.pregnancy_status },
    target_profile: profileOf(profile_id, profile_code, profile_version, thresholds),
    timezone: wire.timezone,
    latest_readings: wire.recent_readings.map((reading) => ({
      id: reading.id,
      client_reading_id: reading.id,
      value_mg_dl: reading.value_mg_dl,
      measured_at: reading.measured_at,
      source: reading.source,
      context: reading.context,
      status: 'ACCEPTED' as const,
      issue_codes: [],
      corrects_id: null,
      simulated: wire.simulated,
    })),
    active_plan: wire.active_plan
      ? { id: wire.active_plan.id, name: '', version: wire.active_plan.version, summary: '', schedule: [] }
      : null,
    open_alerts: wire.open_alerts.map((alert) => ({
      id: alert.id,
      patient_id: wire.patient_id,
      type: alert.alert_type as PatientOverviewDto['open_alerts'][number]['type'],
      level: null,
      priority: alert.priority,
      status: alert.status as PatientOverviewDto['open_alerts'][number]['status'],
      opened_at: alert.opened_at,
      rule_id: null,
      is_fallback: false,
      simulated: wire.simulated,
    })),
    pending_recommendations: [],
    latest_forecast: null,
    simulated: wire.simulated,
  };
});

const wireTriageRowSchema = z.object({
  patient_id: uuid,
  full_name: z.string(),
  risk_tier: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  risk_score: z.number(),
  flags: z.array(z.object({ code: z.string(), reason: z.string() })),
  open_alerts_count: z.number().int(),
  tir_pct: z.number().nullable(),
  last_reading: z.object({ value_mg_dl: z.number(), measured_at: instant }).nullable(),
  reviewed_at: instant.nullable(),
  is_fallback: z.boolean().default(false),
  simulated: z.boolean().default(false),
});

/** `GET /dashboard/triage`: one row per assigned patient with the summary only. */
export const triagePageSchema = z.object({
  items: z.array(wireTriageRowSchema).transform((rows): TriageRowDto[] => rows),
  next_cursor: z.string().nullable(),
});

/** `GET /patients/{id}/metrics/agp`: bins by minute of the day, shown as `HH:MM`. */
export const agpResponseSchema = z.object({
  bins: z.array(z.object({ minute_of_day: z.number().int(), p5: z.number(), p25: z.number(), p50: z.number(), p75: z.number(), p95: z.number() })).transform((bins) =>
    bins.map(({ minute_of_day: minute, ...percentiles }) => ({
      time_of_day: `${String(Math.floor(minute / MINUTES_PER_HOUR)).padStart(TIME_PART_WIDTH, '0')}:${String(minute % MINUTES_PER_HOUR).padStart(TIME_PART_WIDTH, '0')}`,
      ...percentiles,
    })),
  ),
  target_range: z.object({ low: z.number(), high: z.number() }),
  data_sufficiency_pct: z.number(),
  is_sufficient: z.boolean(),
});

const wireUserSchema = z.object({
  id: uuid,
  email: z.string().nullable(),
  full_name: z.string(),
  role: staffUserSchema.shape.role,
  is_active: z.boolean(),
});
export type WireUser = z.infer<typeof wireUserSchema>;
/** `GET /users`. The care-team counts come from `/care-team/assignments`, joined by the client. */
export const usersPageSchema = z.object({ items: z.array(wireUserSchema), next_cursor: z.string().nullable() });

const wirePlanItemSchema = z.object({
  name: z.string(),
  insulin_kind: insulinKindSchema.nullable(),
  dose_units: z.string().nullable(),
  time_of_day: z.string().nullable(),
  injection_sites: z.array(siteCodeSchema).nullable(),
});
/** `GET /patients/own/treatment-plan` and `GET /treatment-plans/{id}`. */
export const planResponseSchema = z
  .object({
    id: uuid,
    version: z.number().int(),
    notes: z.string().nullable(),
    updated_at: instant,
    items: z.array(wirePlanItemSchema),
  })
  .transform(
    (plan): TreatmentPlanDto => ({
      id: plan.id,
      name: '',
      version: plan.version,
      summary: plan.notes ?? '',
      updated_at: plan.updated_at,
      schedule: plan.items.map((item) => ({
        time_of_day: item.time_of_day === null ? '' : item.time_of_day.slice(0, HHMM_LENGTH),
        label: item.name,
        dose_units: item.dose_units === null ? null : Number(item.dose_units),
        insulin_kind: item.insulin_kind,
        injection_sites: item.injection_sites,
      })),
    }),
  );

export type { TargetProfileDto };
export { targetProfileSchema };

/** `GET /patients/{id}/timeline?event_types=INSULIN`: the doctor's dose history, one event per dose. */
export const insulinTimelineSchema = z.object({
  items: z
    .array(
      z.object({
        id: uuid,
        occurred_at: instant,
        data: z.object({
          insulin_kind: insulinKindSchema,
          units: z.number(),
          injection_site: siteCodeSchema.nullable().default(null),
          injection_spot: injectionSpotSchema.nullable().default(null),
        }),
      }),
    )
    .transform((events): InsulinDoseDto[] =>
      events.map((event) => ({
        id: event.id,
        insulin_product_id: null,
        kind: event.data.insulin_kind,
        units: event.data.units,
        administered_at: event.occurred_at,
        treatment_plan_id: null,
        injection_site: event.data.injection_site,
        injection_spot: event.data.injection_spot,
        simulated: false,
      })),
    ),
  next_cursor: z.string().nullable(),
});
