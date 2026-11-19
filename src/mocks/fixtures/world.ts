import type {
  CareAssignmentDto,
  CredentialInvitationDto,
  ImportBatchDto,
  ImportRowDto,
  PatientAdminDto,
  StaffUserDto,
} from '@/services/dto/admin';
import type { ClinicalNoteDto, MessageDto, TreatmentPlanDto } from '@/services/dto/care';
import type {
  AlertDto,
  GlucoseReadingDto,
  GlycemicMetricsDto,
  MetricsResponseDto,
  PatientOverviewDto,
  RecommendationDto,
  TriageRowDto,
} from '@/services/dto/clinical';
import type { MetricsWindow } from '@/services/dto/common';
import type { TargetProfileDto } from '@/services/dto/targetProfile';
import type { InsulinDoseDto } from '@/services/dto/injection';
import type { InjectionPatientProfile } from '../injectionRules';
import { injectionProfileOf, insulinDoseHistorySeed, PATIENT_INJECTION_SEED } from './injection';
import {
  clinicalNoteSeed,
  messageSeed,
  reminderSeed,
  treatmentPlanSeed,
  type ReminderRecord,
} from './care';

/** Schedule of the seeded plan for patients whose plan is not in `world.plans`. */
const FALLBACK_SCHEDULE = treatmentPlanSeed().schedule;
import { DOCTOR_ACCOUNT, PATIENT_ACCOUNT, SECONDARY_DOCTOR, STAFF_DIRECTORY } from './people';
import { ADULT_STANDARD, OLDER_OR_HIGH_RISK, PREGNANCY_T1D } from './profiles';
import { patientId, uuid } from './ids';

export { patientId };

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const MINUTES_PER_DAY = 1440;

/** CGM cadence of the fixture: one reading every 15 minutes for 14 days (1344 per patient). */
const SLOT_MINUTES = 15;
const SLOTS_PER_DAY = MINUTES_PER_DAY / SLOT_MINUTES;
const READING_DAYS = 14;
const SLOT_COUNT = READING_DAYS * SLOTS_PER_DAY;
/** A fingerstick (SMBG) every four hours; the rest comes from the sensor (CGM). */
const SMBG_EVERY_SLOTS = 16;
/** America/Bogota: UTC-5 all year (no daylight saving). */
const CLINIC_UTC_OFFSET_MIN = -300;
/** Physiological clamp of the generated values; the measurable range is checked on write. */
const MIN_GLUCOSE_MG_DL = 40;
const MAX_GLUCOSE_MG_DL = 380;
/** Nadir of a nocturnal dip, in mg/dL, reached on the nights that dip. */
const NIGHT_NADIR_MG_DL = 60;
/** Local minutes of the three meals (07:30, 12:30, 19:00) and of the two context windows. */
const MEAL_MINUTES = [450, 750, 1140] as const;
const POSTPRANDIAL_LAG_MIN = 30;
const FASTING_WINDOW = [360, 420] as const;
const BEDTIME_WINDOW = [1200, 1260] as const;
const NIGHT_DIP_CENTER_MIN = 180;
const NIGHT_DIP_WIDTH_MIN = 70;

type RiskTier = TriageRowDto['risk_tier'];
/** Shape of the generated glucose curve. The spec's numbers set its level; the pattern sets its shape. */
type GlucosePattern = 'STABLE' | 'NOCTURNAL_HYPO' | 'SUSTAINED_HYPER' | 'SPARSE';
export type AgpResolution = '15min' | 'hour';

const MEAL_PEAK_MG_DL: Record<GlucosePattern, number> = {
  STABLE: 26,
  NOCTURNAL_HYPO: 20,
  SUSTAINED_HYPER: 70,
  SPARSE: 22,
};
const NOISE_MG_DL: Record<GlucosePattern, number> = {
  STABLE: 22,
  NOCTURNAL_HYPO: 12,
  SUSTAINED_HYPER: 18,
  SPARSE: 14,
};

interface PatientSpec {
  readonly n: number;
  readonly fullName: string;
  readonly mrn: string;
  readonly profile: TargetProfileDto;
  readonly risk: RiskTier;
  readonly score: number;
  readonly reasons: readonly { code: string; reason: string }[];
  /** Percent of time per state, very low to very high. Adds up to 100. */
  readonly pct: readonly [number, number, number, number, number];
  readonly mean: number;
  readonly cv: number;
  /** Percent of the 14-day slots that carry a reading. Below the profile's minimum, AGP is insufficient. */
  readonly sufficiency: number;
  readonly lastValue: number;
  readonly lastMinutesAgo: number;
  readonly openAlerts: number;
  readonly pendingRecommendations: number;
  readonly reviewed: boolean;
  readonly pattern: GlucosePattern;
  /** Second doctor of the care team, as a non-primary member. */
  readonly secondaryDoctor: boolean;
}

const SPECS: readonly PatientSpec[] = [
  {
    n: 1,
    fullName: 'Camila Restrepo Ossa',
    mrn: 'MRN-10001',
    profile: ADULT_STANDARD,
    risk: 'CRITICAL',
    score: 92,
    reasons: [
      { code: 'RECURRENT_HYPO', reason: 'Dos hipoglucemias en las últimas 24 horas' },
      { code: 'TBR_ABOVE_GOAL', reason: 'Tiempo bajo rango por encima de la meta' },
    ],
    pct: [3, 9, 58, 22, 8],
    mean: 168,
    cv: 41,
    sufficiency: 94,
    lastValue: 58,
    lastMinutesAgo: 12,
    openAlerts: 2,
    pendingRecommendations: 1,
    reviewed: false,
    pattern: 'NOCTURNAL_HYPO',
    secondaryDoctor: false,
  },
  {
    n: 2,
    fullName: 'Andrés Felipe Cardona',
    mrn: 'MRN-10002',
    profile: ADULT_STANDARD,
    risk: 'HIGH',
    score: 78,
    reasons: [
      { code: 'TAR_ABOVE_GOAL', reason: 'Tiempo sobre rango muy por encima de la meta' },
      { code: 'POSTPRANDIAL_SPIKES', reason: 'Picos después de las comidas' },
    ],
    pct: [0, 2, 49, 31, 18],
    mean: 170,
    cv: 33,
    sufficiency: 91,
    lastValue: 268,
    lastMinutesAgo: 25,
    openAlerts: 1,
    pendingRecommendations: 1,
    reviewed: false,
    pattern: 'SUSTAINED_HYPER',
    secondaryDoctor: false,
  },
  {
    n: 3,
    fullName: PATIENT_ACCOUNT.fullName,
    mrn: 'MRN-10003',
    profile: ADULT_STANDARD,
    risk: 'MEDIUM',
    score: 54,
    reasons: [{ code: 'NIGHT_LOWS', reason: 'Valores bajos entre las 2 y las 4 de la madrugada' }],
    pct: [1, 4, 66, 22, 7],
    mean: 172,
    cv: 37,
    sufficiency: 88,
    lastValue: 142,
    lastMinutesAgo: 40,
    openAlerts: 1,
    pendingRecommendations: 0,
    reviewed: false,
    pattern: 'NOCTURNAL_HYPO',
    secondaryDoctor: false,
  },
  {
    n: 4,
    fullName: 'Julián David Mejía',
    mrn: 'MRN-10004',
    profile: OLDER_OR_HIGH_RISK,
    risk: 'MEDIUM',
    score: 47,
    reasons: [{ code: 'HIGH_VARIABILITY', reason: 'Variabilidad glucémica alta' }],
    pct: [0, 1, 58, 33, 8],
    mean: 176,
    cv: 39,
    sufficiency: 86,
    lastValue: 195,
    lastMinutesAgo: 75,
    openAlerts: 0,
    pendingRecommendations: 1,
    reviewed: false,
    pattern: 'STABLE',
    secondaryDoctor: false,
  },
  {
    n: 5,
    fullName: 'Valentina Gómez Arias',
    mrn: 'MRN-10005',
    profile: PREGNANCY_T1D,
    risk: 'LOW',
    score: 28,
    reasons: [{ code: 'NEAR_GOAL', reason: 'Cerca de la meta del perfil de embarazo' }],
    pct: [0, 3, 72, 22, 3],
    mean: 124,
    cv: 31,
    sufficiency: 96,
    lastValue: 118,
    lastMinutesAgo: 18,
    openAlerts: 0,
    pendingRecommendations: 0,
    reviewed: true,
    pattern: 'STABLE',
    secondaryDoctor: false,
  },
  {
    n: 6,
    fullName: 'Sebastián Arango Londoño',
    mrn: 'MRN-10006',
    profile: ADULT_STANDARD,
    risk: 'LOW',
    score: 19,
    reasons: [{ code: 'IN_TARGET', reason: 'Cumple las metas de la ventana' }],
    pct: [0, 1, 82, 15, 2],
    mean: 149,
    cv: 27,
    sufficiency: 97,
    lastValue: 124,
    lastMinutesAgo: 9,
    openAlerts: 0,
    pendingRecommendations: 0,
    reviewed: true,
    pattern: 'STABLE',
    secondaryDoctor: false,
  },
  {
    n: 7,
    fullName: 'Mariana Duque Salcedo',
    mrn: 'MRN-10007',
    profile: ADULT_STANDARD,
    risk: 'MEDIUM',
    score: 41,
    reasons: [{ code: 'INSUFFICIENT_DATA', reason: 'Pocas lecturas en la ventana: faltan datos' }],
    pct: [0, 0, 70, 25, 5],
    mean: 162,
    cv: 30,
    sufficiency: 38,
    lastValue: 171,
    lastMinutesAgo: 300,
    openAlerts: 0,
    pendingRecommendations: 0,
    reviewed: false,
    pattern: 'SPARSE',
    secondaryDoctor: false,
  },
  {
    n: 8,
    fullName: 'Tomás Zuluaga Peña',
    mrn: 'MRN-10008',
    profile: ADULT_STANDARD,
    risk: 'LOW',
    score: 22,
    reasons: [{ code: 'IN_TARGET', reason: 'Cumple las metas de la ventana' }],
    pct: [0, 2, 76, 19, 3],
    mean: 157,
    cv: 29,
    sufficiency: 93,
    lastValue: 133,
    lastMinutesAgo: 55,
    openAlerts: 0,
    pendingRecommendations: 0,
    reviewed: true,
    pattern: 'STABLE',
    secondaryDoctor: false,
  },
  {
    n: 9,
    fullName: 'Daniela Mora Quintero',
    mrn: 'MRN-10009',
    profile: ADULT_STANDARD,
    risk: 'LOW',
    score: 16,
    reasons: [{ code: 'IN_TARGET', reason: 'Cumple las metas de la ventana' }],
    pct: [0, 1, 84, 13, 2],
    mean: 146,
    cv: 28,
    sufficiency: 95,
    lastValue: 128,
    lastMinutesAgo: 22,
    openAlerts: 0,
    pendingRecommendations: 0,
    reviewed: true,
    pattern: 'STABLE',
    secondaryDoctor: false,
  },
  {
    n: 10,
    fullName: 'Felipe Ruiz Bedoya',
    mrn: 'MRN-10010',
    profile: ADULT_STANDARD,
    risk: 'LOW',
    score: 24,
    reasons: [{ code: 'NEAR_GOAL', reason: 'Cerca de la meta del perfil' }],
    pct: [0, 2, 80, 15, 3],
    mean: 155,
    cv: 30,
    sufficiency: 92,
    lastValue: 151,
    lastMinutesAgo: 48,
    openAlerts: 0,
    pendingRecommendations: 0,
    reviewed: false,
    pattern: 'STABLE',
    secondaryDoctor: false,
  },
  {
    n: 11,
    fullName: 'Gloria Estrada Lopera',
    mrn: 'MRN-10011',
    profile: OLDER_OR_HIGH_RISK,
    risk: 'LOW',
    score: 31,
    reasons: [{ code: 'IN_TARGET', reason: 'Cumple las metas de la ventana' }],
    pct: [0, 1, 74, 20, 5],
    mean: 162,
    cv: 32,
    sufficiency: 90,
    lastValue: 160,
    lastMinutesAgo: 33,
    openAlerts: 0,
    pendingRecommendations: 0,
    reviewed: true,
    pattern: 'STABLE',
    secondaryDoctor: false,
  },
  {
    n: 12,
    fullName: 'Santiago Herrera Pulido',
    mrn: 'MRN-10012',
    profile: ADULT_STANDARD,
    risk: 'MEDIUM',
    score: 49,
    reasons: [{ code: 'POSTPRANDIAL_SPIKES', reason: 'Picos después de las comidas' }],
    pct: [0, 2, 68, 24, 6],
    mean: 165,
    cv: 34,
    sufficiency: 89,
    lastValue: 201,
    lastMinutesAgo: 15,
    openAlerts: 1,
    pendingRecommendations: 0,
    reviewed: false,
    pattern: 'STABLE',
    secondaryDoctor: false,
  },
  {
    n: 13,
    fullName: 'Paola Jaramillo Osorio',
    mrn: 'MRN-10013',
    profile: ADULT_STANDARD,
    risk: 'LOW',
    score: 20,
    reasons: [{ code: 'IN_TARGET', reason: 'Cumple las metas de la ventana' }],
    pct: [0, 1, 81, 15, 3],
    mean: 150,
    cv: 26,
    sufficiency: 97,
    lastValue: 117,
    lastMinutesAgo: 62,
    openAlerts: 0,
    pendingRecommendations: 0,
    reviewed: true,
    pattern: 'STABLE',
    secondaryDoctor: false,
  },
  {
    n: 14,
    fullName: 'Ernesto Valencia Trujillo',
    mrn: 'MRN-10014',
    profile: ADULT_STANDARD,
    risk: 'HIGH',
    score: 74,
    reasons: [{ code: 'NIGHT_LOWS', reason: 'Valores bajos entre las 2 y las 4 de la madrugada' }],
    pct: [2, 6, 72, 16, 4],
    mean: 172,
    cv: 38,
    sufficiency: 91,
    lastValue: 86,
    lastMinutesAgo: 95,
    openAlerts: 1,
    pendingRecommendations: 0,
    reviewed: false,
    pattern: 'NOCTURNAL_HYPO',
    secondaryDoctor: true,
  },
  {
    n: 15,
    fullName: 'Rosa Elena Galvis Pérez',
    mrn: 'MRN-10015',
    profile: ADULT_STANDARD,
    risk: 'CRITICAL',
    score: 88,
    reasons: [{ code: 'RECURRENT_HYPO', reason: 'Tres hipoglucemias en las últimas 48 horas' }],
    pct: [4, 8, 60, 20, 8],
    mean: 170,
    cv: 42,
    sufficiency: 93,
    lastValue: 64,
    lastMinutesAgo: 140,
    openAlerts: 2,
    pendingRecommendations: 0,
    reviewed: false,
    pattern: 'NOCTURNAL_HYPO',
    secondaryDoctor: true,
  },
  {
    n: 16,
    fullName: 'Jorge Iván Cano Ríos',
    mrn: 'MRN-10016',
    profile: ADULT_STANDARD,
    risk: 'MEDIUM',
    score: 52,
    reasons: [{ code: 'NIGHT_LOWS', reason: 'Valores bajos entre las 2 y las 4 de la madrugada' }],
    pct: [1, 5, 76, 14, 4],
    mean: 166,
    cv: 36,
    sufficiency: 90,
    lastValue: 99,
    lastMinutesAgo: 210,
    openAlerts: 0,
    pendingRecommendations: 0,
    reviewed: false,
    pattern: 'NOCTURNAL_HYPO',
    secondaryDoctor: false,
  },
  {
    n: 17,
    fullName: 'Marcela Ospina Berrío',
    mrn: 'MRN-10017',
    profile: ADULT_STANDARD,
    risk: 'HIGH',
    score: 81,
    reasons: [{ code: 'TAR_ABOVE_GOAL', reason: 'Tiempo sobre rango muy por encima de la meta' }],
    pct: [0, 1, 38, 40, 21],
    mean: 175,
    cv: 29,
    sufficiency: 92,
    lastValue: 246,
    lastMinutesAgo: 18,
    openAlerts: 2,
    pendingRecommendations: 1,
    reviewed: false,
    pattern: 'SUSTAINED_HYPER',
    secondaryDoctor: true,
  },
  {
    n: 18,
    fullName: 'Hernán Darío Montoya',
    mrn: 'MRN-10018',
    profile: ADULT_STANDARD,
    risk: 'HIGH',
    score: 70,
    reasons: [{ code: 'TAR_ABOVE_GOAL', reason: 'Tiempo sobre rango muy por encima de la meta' }],
    pct: [0, 2, 44, 36, 18],
    mean: 172,
    cv: 31,
    sufficiency: 90,
    lastValue: 233,
    lastMinutesAgo: 55,
    openAlerts: 1,
    pendingRecommendations: 0,
    reviewed: false,
    pattern: 'SUSTAINED_HYPER',
    secondaryDoctor: true,
  },
  {
    n: 19,
    fullName: 'Carolina Vélez Ocampo',
    mrn: 'MRN-10019',
    profile: ADULT_STANDARD,
    risk: 'MEDIUM',
    score: 58,
    reasons: [{ code: 'POSTPRANDIAL_SPIKES', reason: 'Picos después de las comidas' }],
    pct: [0, 1, 55, 31, 13],
    mean: 170,
    cv: 30,
    sufficiency: 95,
    lastValue: 205,
    lastMinutesAgo: 80,
    openAlerts: 0,
    pendingRecommendations: 0,
    reviewed: true,
    pattern: 'SUSTAINED_HYPER',
    secondaryDoctor: false,
  },
  {
    n: 20,
    fullName: 'Óscar Mauricio Tobón',
    mrn: 'MRN-10020',
    profile: ADULT_STANDARD,
    risk: 'MEDIUM',
    score: 44,
    reasons: [{ code: 'INSUFFICIENT_DATA', reason: 'Pocas lecturas en la ventana: faltan datos' }],
    pct: [0, 2, 71, 22, 5],
    mean: 158,
    cv: 35,
    sufficiency: 52,
    lastValue: 149,
    lastMinutesAgo: 420,
    openAlerts: 0,
    pendingRecommendations: 0,
    reviewed: false,
    pattern: 'SPARSE',
    secondaryDoctor: false,
  },
  {
    n: 21,
    fullName: 'Yolanda Patiño Moreno',
    mrn: 'MRN-10021',
    profile: ADULT_STANDARD,
    risk: 'MEDIUM',
    score: 36,
    reasons: [{ code: 'INSUFFICIENT_DATA', reason: 'Pocas lecturas en la ventana: faltan datos' }],
    pct: [0, 1, 76, 19, 4],
    mean: 159,
    cv: 33,
    sufficiency: 61,
    lastValue: 142,
    lastMinutesAgo: 260,
    openAlerts: 0,
    pendingRecommendations: 0,
    reviewed: false,
    pattern: 'SPARSE',
    secondaryDoctor: false,
  },
  {
    n: 22,
    fullName: 'Natalia Correa Lozano',
    mrn: 'MRN-10022',
    profile: PREGNANCY_T1D,
    risk: 'MEDIUM',
    score: 46,
    reasons: [{ code: 'NEAR_GOAL', reason: 'Cerca de la meta del perfil de embarazo' }],
    pct: [0, 3, 64, 27, 6],
    mean: 128,
    cv: 31,
    sufficiency: 94,
    lastValue: 139,
    lastMinutesAgo: 36,
    openAlerts: 0,
    pendingRecommendations: 0,
    reviewed: false,
    pattern: 'STABLE',
    secondaryDoctor: true,
  },
  {
    n: 23,
    fullName: 'Teresa de Jesús Vargas Hoyos',
    mrn: 'MRN-10023',
    profile: OLDER_OR_HIGH_RISK,
    risk: 'HIGH',
    score: 73,
    reasons: [{ code: 'NIGHT_LOWS', reason: 'Valores bajos entre las 2 y las 4 de la madrugada' }],
    pct: [1, 4, 63, 24, 8],
    mean: 168,
    cv: 40,
    sufficiency: 90,
    lastValue: 96,
    lastMinutesAgo: 110,
    openAlerts: 1,
    pendingRecommendations: 0,
    reviewed: false,
    pattern: 'NOCTURNAL_HYPO',
    secondaryDoctor: false,
  },
  {
    n: 24,
    fullName: 'Sergio Andrés Lalinde',
    mrn: 'MRN-10024',
    profile: ADULT_STANDARD,
    risk: 'LOW',
    score: 18,
    reasons: [{ code: 'IN_TARGET', reason: 'Cumple las metas de la ventana' }],
    pct: [0, 1, 83, 14, 2],
    mean: 143,
    cv: 25,
    sufficiency: 98,
    lastValue: 122,
    lastMinutesAgo: 7,
    openAlerts: 0,
    pendingRecommendations: 0,
    reviewed: true,
    pattern: 'STABLE',
    secondaryDoctor: false,
  },
];

/** Imported patient without a doctor or readings yet: appears in the roster only (API.md 8.4). */
const IMPORTED_N = 25;

const round = (value: number, digits = 1): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

/** Deterministic pseudo-random in [0, 1): the same patient and slot always give the same value. */
function unit(n: number, k: number, salt: number): number {
  const x = Math.sin(n * 12.9898 + k * 78.233 + salt * 37.719) * 43758.5453;
  return x - Math.floor(x);
}

/** Minutes since local midnight in the clinic's time zone. */
function localMinutes(ms: number): number {
  const minutes = Math.floor(ms / MINUTE_MS) + CLINIC_UTC_OFFSET_MIN;
  return ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

const bump = (x: number, center: number, width: number): number =>
  Math.exp(-((x - center) ** 2) / (2 * width ** 2));

/** Share of values that satisfy `inside`, rounded to one decimal; 0 when there is no value. */
function shareOf(values: readonly number[], inside: (value: number) => boolean): number {
  if (values.length === 0) return 0;
  return round((100 * values.filter(inside).length) / values.length);
}

/**
 * Window metrics computed from the readings inside the window, with the thresholds of the patient's
 * profile. Sufficiency and the sufficiency flag come from the spec, as the sensor coverage does.
 */
function metricsFrom(
  spec: PatientSpec,
  readings: readonly GlucoseReadingDto[],
  window: MetricsWindow,
  now: Date,
): MetricsResponseDto {
  const days = { '24h': 1, '7d': 7, '14d': 14, '30d': 30 }[window];
  const from = now.getTime() - days * DAY_MS;
  const values = readings
    .filter((r) => Date.parse(r.measured_at) >= from)
    .map((r) => r.value_mg_dl);
  const profile = spec.profile;
  const mean =
    values.length === 0 ? spec.mean : values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance =
    values.length === 0 ? 0 : values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const tbrL1 = shareOf(values, (v) => v < profile.range_low_mg_dl && v >= profile.very_low_mg_dl);
  const tbrL2 = shareOf(values, (v) => v < profile.very_low_mg_dl);
  const tarL1 = shareOf(
    values,
    (v) => v > profile.range_high_mg_dl && v <= profile.very_high_mg_dl,
  );
  const tarL2 = shareOf(values, (v) => v > profile.very_high_mg_dl);
  // An episode starts when a reading drops under the range; consecutive lows count once.
  let episodes = 0;
  let inLow = false;
  for (const value of values) {
    const low = value < profile.range_low_mg_dl;
    if (low && !inLow) episodes += 1;
    inLow = low;
  }
  const metrics: GlycemicMetricsDto = {
    tir_pct: shareOf(values, (v) => v >= profile.range_low_mg_dl && v <= profile.range_high_mg_dl),
    tbr_l1_pct: tbrL1,
    tbr_l2_pct: tbrL2,
    tbr_pct: round(tbrL1 + tbrL2),
    tar_l1_pct: tarL1,
    tar_l2_pct: tarL2,
    tar_pct: round(tarL1 + tarL2),
    mean_glucose_mg_dl: round(mean),
    gmi_pct: round(3.31 + 0.02392 * mean, 2),
    cv_pct: mean > 0 ? round((100 * Math.sqrt(variance)) / mean) : spec.cv,
    hypo_events_count: episodes,
  };
  return {
    window,
    period_from: new Date(from).toISOString(),
    period_to: now.toISOString(),
    timezone: 'America/Bogota',
    target_profile: profile,
    data_sufficiency_pct: spec.sufficiency,
    is_sufficient: spec.sufficiency >= profile.min_data_sufficiency_pct,
    confidence: spec.sufficiency >= 90 ? 'NORMAL' : 'LOW_CONFIDENCE',
    metrics,
    tir_delta_pct: spec.risk === 'CRITICAL' || spec.risk === 'HIGH' ? -6 : 3,
  };
}

/** Glucose at slot `k` (0 is the latest) from the spec's shape: daily curve, meals, night dips, noise. */
function valueAt(spec: PatientSpec, k: number, minuteOfDay: number): number {
  const diurnal = 12 * Math.sin(((minuteOfDay - 480) / MINUTES_PER_DAY) * 2 * Math.PI);
  const meals = MEAL_MINUTES.reduce(
    (sum, meal) =>
      sum + MEAL_PEAK_MG_DL[spec.pattern] * bump(minuteOfDay, meal + POSTPRANDIAL_LAG_MIN, 40),
    0,
  );
  // Nocturnal patients dip every night between about 2 and 4 a.m.
  const nightDip =
    spec.pattern === 'NOCTURNAL_HYPO'
      ? -(spec.mean - NIGHT_NADIR_MG_DL) *
        bump(minuteOfDay, NIGHT_DIP_CENTER_MIN, NIGHT_DIP_WIDTH_MIN)
      : 0;
  const noise = NOISE_MG_DL[spec.pattern] * (unit(spec.n, k, 1) * 2 - 1);
  const value = spec.mean + diurnal + meals + nightDip + noise;
  return Math.round(Math.min(MAX_GLUCOSE_MG_DL, Math.max(MIN_GLUCOSE_MG_DL, value)));
}

function generateReadings(spec: PatientSpec, now: Date): GlucoseReadingDto[] {
  const latest = now.getTime() - spec.lastMinutesAgo * MINUTE_MS;
  const readings: GlucoseReadingDto[] = [];
  for (let k = 0; k < SLOT_COUNT; k += 1) {
    // Sparse patients miss slots: the sufficiency percent is what the AGP and the triage report.
    if (k > 0 && unit(spec.n, k, 2) * 100 >= spec.sufficiency) continue;
    const at = latest - k * SLOT_MINUTES * MINUTE_MS;
    const minute = localMinutes(at);
    const inWindow = (window: readonly [number, number]) =>
      minute >= window[0] && minute < window[1];
    const context = inWindow(FASTING_WINDOW)
      ? 'FASTING'
      : inWindow(BEDTIME_WINDOW)
        ? 'BEDTIME'
        : null;
    const id = spec.n * 10_000 + k;
    readings.push({
      id: uuid('e1', id),
      client_reading_id: uuid('c2', id),
      value_mg_dl: k === 0 ? spec.lastValue : valueAt(spec, k, minute),
      measured_at: new Date(at).toISOString(),
      source: k > 0 && k % SMBG_EVERY_SLOTS === 0 ? 'SMBG' : 'CGM',
      context,
      status: 'ACCEPTED',
      issue_codes: [],
      simulated: false,
    });
  }
  return readings;
}

function percentile(sorted: readonly number[], p: number): number {
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank))] ?? 0;
}

const pad2 = (value: number): string => String(value).padStart(2, '0');

/** Everything the mock API serves, built from one clock so "last reading" is always recent. */
export interface FixtureWorld {
  readonly now: Date;
  readonly specs: readonly PatientSpec[];
  alerts: AlertDto[];
  recommendations: RecommendationDto[];
  imports: Map<string, { batch: ImportBatchDto; rows: ImportRowDto[] }>;
  invitations: Map<string, CredentialInvitationDto>;
  patientAdmin: PatientAdminDto[];
  careAssignments: CareAssignmentDto[];
  /** Readings the patient registered through `POST /readings`, keyed by patient id. */
  readonly ownReadings: Map<string, GlucoseReadingDto[]>;
  /** Active treatment plan per patient id. */
  readonly plans: Map<string, TreatmentPlanDto>;
  /** Reminders per patient id; the lock comes from the plan. */
  readonly reminders: Map<string, ReminderRecord[]>;
  /** Clinical notes per patient id, oldest first. */
  readonly notes: Map<string, ClinicalNoteDto[]>;
  /** Insulin doses per patient id, oldest first. Doses posted by the patient are appended. */
  readonly insulinDoses: Map<string, InsulinDoseDto[]>;
  /** Rules profile (sex, birth date, BMI, pregnancy, lipohypertrophy) of a patient, or null if unknown. */
  injectionProfile(patientId: string): InjectionPatientProfile | null;
  /** Patient-doctor thread per patient id, oldest first. */
  readonly messages: Map<string, MessageDto[]>;
  nextId(prefix: string): string;
  isAssigned(patientId: string): boolean;
  staffUsers(): StaffUserDto[];
  findOwnReading(patientId: string, clientReadingId: string): GlucoseReadingDto | undefined;
  addOwnReading(patientId: string, reading: GlucoseReadingDto): GlucoseReadingDto;
  triage(window: MetricsWindow): TriageRowDto[];
  overview(patientId: string, window: MetricsWindow): PatientOverviewDto | null;
  metrics(patientId: string, window: MetricsWindow): MetricsResponseDto | null;
  /** Newest first: own registered readings merged with the sensor history. */
  readings(patientId: string): GlucoseReadingDto[] | null;
  agp(
    patientId: string,
    resolution: AgpResolution,
  ): {
    bins: { time_of_day: string; p5: number; p25: number; p50: number; p75: number; p95: number }[];
    target_range: { low: number; high: number };
    data_sufficiency_pct: number;
    is_sufficient: boolean;
  } | null;
}

export function createWorld(now: Date = new Date()): FixtureWorld {
  const specOf = (id: string) => SPECS.find((s) => patientId(s.n) === id);
  const generated = new Map<number, GlucoseReadingDto[]>();
  const generatedFor = (spec: PatientSpec): GlucoseReadingDto[] => {
    let readings = generated.get(spec.n);
    if (!readings) {
      readings = generateReadings(spec, now);
      generated.set(spec.n, readings);
    }
    return readings;
  };
  let counter = 0;

  const alerts: AlertDto[] = SPECS.flatMap((spec) =>
    Array.from({ length: spec.openAlerts }, (_, i): AlertDto => {
      const hypo =
        spec.lastValue < spec.profile.range_low_mg_dl ||
        spec.reasons[0]?.code === 'NIGHT_LOWS' ||
        i === 1;
      return {
        id: uuid('a1', spec.n * 10 + i),
        patient_id: patientId(spec.n),
        patient_name: spec.fullName,
        type: hypo ? 'HYPOGLYCEMIA' : 'HYPERGLYCEMIA',
        level: hypo ? (spec.risk === 'CRITICAL' ? 2 : 1) : null,
        priority: spec.risk === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
        status: 'OPEN',
        opened_at: new Date(
          now.getTime() - (spec.lastMinutesAgo + i * 90) * MINUTE_MS,
        ).toISOString(),
        rule_id: uuid('b2', 1),
        is_fallback: false,
        simulated: false,
      };
    }),
  );

  const proposalFor = (current: number, delta: number, action: 'INCREASE' | 'DECREASE') => ({
    action,
    current_dose: current,
    proposed_dose: current + (action === 'INCREASE' ? delta : -delta),
    delta_units: delta,
    requires_doctor_approval: true as const,
  });
  const recommendations: RecommendationDto[] = SPECS.filter(
    (s) => s.pendingRecommendations > 0,
  ).map((spec, i) => {
    const decrease = spec.n === 1;
    return {
      id: uuid('f2', spec.n),
      patient_id: patientId(spec.n),
      status: 'PROPOSED',
      proposal: proposalFor(
        decrease ? 18 : 22,
        decrease ? 2 : 1,
        decrease ? 'DECREASE' : 'INCREASE',
      ),
      explanation: {
        summary: decrease
          ? 'Hipoglucemias repetidas en la madrugada sugieren reducir la insulina basal.'
          : 'El tiempo sobre rango se mantiene por encima de la meta con la dosis actual.',
        factors: decrease
          ? [
              'Dos lecturas por debajo del corte bajo en 24 horas',
              'Tendencia descendente nocturna en la AGP',
            ]
          : [
              'Tiempo sobre rango por encima de la meta del perfil',
              'Picos después de la cena en siete de catorce días',
            ],
        data_refs: [`window:14d`, `profile:${spec.profile.code}`],
      },
      model_version: 'baseline-rules-0.1',
      is_fallback: i === 2,
      fallback_reason: i === 2 ? 'AI_TIMEOUT' : null,
      expires_at: new Date(now.getTime() + 3 * DAY_MS).toISOString(),
      created_at: new Date(now.getTime() - 2 * HOUR_MS).toISOString(),
      simulated: false,
    };
  });

  const careAssignments: CareAssignmentDto[] = SPECS.flatMap((spec) => {
    const base = {
      patient_id: patientId(spec.n),
      started_at: new Date(now.getTime() - 90 * DAY_MS).toISOString(),
      ended_at: null,
      end_reason: null,
      patient_name: spec.fullName,
    };
    const primary: CareAssignmentDto = {
      ...base,
      id: uuid('ca', spec.n),
      doctor_id: DOCTOR_ACCOUNT.id,
      is_primary: true,
      doctor_name: DOCTOR_ACCOUNT.fullName,
    };
    if (!spec.secondaryDoctor) return [primary];
    return [
      primary,
      {
        ...base,
        id: uuid('cb', spec.n),
        doctor_id: SECONDARY_DOCTOR.id,
        is_primary: false,
        doctor_name: SECONDARY_DOCTOR.fullName,
      },
    ];
  });

  const patientAdmin: PatientAdminDto[] = [
    ...SPECS.map((spec): PatientAdminDto => ({
      id: patientId(spec.n),
      full_name: spec.fullName,
      mrn: spec.mrn,
      document_last4: String(1000 + spec.n * 37).slice(-4),
      account_status: spec.n === 7 ? 'INVITED' : 'ACTIVE',
      primary_doctor_id: DOCTOR_ACCOUNT.id,
      assigned_doctor_count: spec.secondaryDoctor ? 2 : 1,
      invitation_status: spec.n === 7 ? 'PENDING' : null,
      simulated: false,
    })),
    {
      id: patientId(IMPORTED_N),
      full_name: 'Isabela Naranjo Cruz',
      mrn: 'MRN-10025',
      document_last4: '4412',
      account_status: 'IMPORTED',
      primary_doctor_id: null,
      assigned_doctor_count: 0,
      invitation_status: null,
      simulated: false,
    },
  ];

  const injectionFieldsOf = (n: number) => {
    const seed = PATIENT_INJECTION_SEED[n];
    return {
      sex: seed?.sex ?? 'UNKNOWN',
      birth_date: seed?.birth_date ?? null,
      bmi: seed?.bmi ?? null,
      pregnancy_status: seed?.pregnancy_status ?? 'UNKNOWN',
    } as const;
  };

  /** Active plan of the overview: its insulin items only (the schedule of the treatment plan, minus the checks). */
  const planSummaryOf = (id: string, spec: PatientSpec) => {
    const plan = world.plans.get(id);
    const schedule = (plan?.schedule ?? FALLBACK_SCHEDULE).filter(
      (item) => item.insulin_kind !== null,
    );
    if (plan)
      return {
        id: plan.id,
        name: plan.name,
        version: plan.version,
        summary: plan.summary,
        schedule,
      };
    return {
      id: uuid('d3', spec.n),
      name: 'Basal-bolo adulto',
      version: 4,
      summary: 'Insulina basal nocturna y bolos con las comidas principales.',
      schedule,
    };
  };

  const clinicalNotes = clinicalNoteSeed(now, DOCTOR_ACCOUNT.fullName);
  const notes = new Map<string, ClinicalNoteDto[]>();
  for (const { patientN, note } of clinicalNotes) {
    notes.set(patientId(patientN), [...(notes.get(patientId(patientN)) ?? []), note]);
  }

  const world: FixtureWorld = {
    now,
    specs: SPECS,
    alerts,
    recommendations,
    imports: new Map(),
    invitations: new Map(),
    patientAdmin,
    careAssignments,
    ownReadings: new Map(),
    plans: new Map([[PATIENT_ACCOUNT.id, treatmentPlanSeed()]]),
    reminders: new Map([[PATIENT_ACCOUNT.id, reminderSeed()]]),
    notes,
    messages: new Map([[PATIENT_ACCOUNT.id, messageSeed(now)]]),
    insulinDoses: new Map([
      [patientId(3), insulinDoseHistorySeed(now, 0)],
      [patientId(1), insulinDoseHistorySeed(now, 1)],
    ]),
    injectionProfile: (id) => {
      const spec = specOf(id);
      return spec ? injectionProfileOf(spec.n, now) : null;
    },
    nextId: (prefix) => {
      counter += 1;
      return uuid(prefix, counter);
    },
    isAssigned: (id) => specOf(id) !== undefined,
    staffUsers: () =>
      STAFF_DIRECTORY.map((person) => ({
        id: person.id,
        full_name: person.fullName,
        email: person.email,
        role: person.role,
        status: 'ACTIVE',
        patients_count: careAssignments.filter(
          (a) => a.doctor_id === person.id && a.ended_at === null,
        ).length,
      })),
    findOwnReading: (id, clientReadingId) =>
      world.ownReadings.get(id)?.find((reading) => reading.client_reading_id === clientReadingId),
    addOwnReading(id, reading) {
      world.ownReadings.set(id, [reading, ...(world.ownReadings.get(id) ?? [])]);
      return reading;
    },
    metrics(id, window) {
      const spec = specOf(id);
      return spec ? metricsFrom(spec, generatedFor(spec), window, now) : null;
    },
    readings(id) {
      const spec = specOf(id);
      if (!spec) return null;
      const own = world.ownReadings.get(id) ?? [];
      return [...own, ...generatedFor(spec)].sort((a, b) =>
        b.measured_at.localeCompare(a.measured_at),
      );
    },
    triage(window) {
      return [...SPECS]
        .sort((a, b) => b.score - a.score)
        .map((spec) => ({
          patient_id: patientId(spec.n),
          full_name: spec.fullName,
          risk_tier: spec.risk,
          risk_score: spec.score,
          flags: [...spec.reasons],
          open_alerts_count: world.alerts.filter(
            (a) => a.patient_id === patientId(spec.n) && a.status === 'OPEN',
          ).length,
          pending_recommendations_count: world.recommendations.filter(
            (r) => r.patient_id === patientId(spec.n) && r.status === 'PROPOSED',
          ).length,
          metrics: metricsFrom(spec, generatedFor(spec), window, now),
          last_reading: {
            value_mg_dl: spec.lastValue,
            measured_at: new Date(now.getTime() - spec.lastMinutesAgo * MINUTE_MS).toISOString(),
          },
          reviewed_at: spec.reviewed ? new Date(now.getTime() - 5 * HOUR_MS).toISOString() : null,
          is_fallback: false,
          simulated: false,
        }));
    },
    overview(id, window) {
      const spec = specOf(id);
      if (!spec) return null;
      return {
        patient: { id, full_name: spec.fullName, ...injectionFieldsOf(spec.n) },
        target_profile: spec.profile,
        latest_readings: (world.readings(id) ?? []).slice(0, 12),
        metrics: metricsFrom(spec, generatedFor(spec), window, now),
        active_plan: planSummaryOf(id, spec),
        open_alerts: world.alerts.filter((a) => a.patient_id === id && a.status !== 'RESOLVED'),
        pending_recommendations: world.recommendations.filter(
          (r) => r.patient_id === id && r.status === 'PROPOSED',
        ),
        latest_forecast: {
          mode: 'SHORT_TERM',
          generated_at: now.toISOString(),
          trend: spec.lastValue < spec.profile.range_low_mg_dl ? 'FALLING' : 'STABLE',
          is_fallback: true,
          fallback_reason: 'AI_TIMEOUT',
        },
        simulated: false,
      };
    },
    agp(id, resolution) {
      const spec = specOf(id);
      if (!spec) return null;
      const sufficient = spec.sufficiency >= spec.profile.min_data_sufficiency_pct;
      const binMinutes = resolution === 'hour' ? MINUTES_PER_DAY / 24 : SLOT_MINUTES;
      const buckets = new Map<number, number[]>();
      if (sufficient) {
        for (const reading of generatedFor(spec)) {
          const bucket = Math.floor(localMinutes(Date.parse(reading.measured_at)) / binMinutes);
          buckets.set(bucket, [...(buckets.get(bucket) ?? []), reading.value_mg_dl]);
        }
      }
      return {
        bins: [...buckets.keys()]
          .sort((a, b) => a - b)
          .map((bucket) => {
            const values = (buckets.get(bucket) ?? []).sort((a, b) => a - b);
            const start = bucket * binMinutes;
            return {
              time_of_day: `${pad2(Math.floor(start / 60))}:${pad2(start % 60)}`,
              p5: percentile(values, 5),
              p25: percentile(values, 25),
              p50: percentile(values, 50),
              p75: percentile(values, 75),
              p95: percentile(values, 95),
            };
          }),
        target_range: { low: spec.profile.range_low_mg_dl, high: spec.profile.range_high_mg_dl },
        data_sufficiency_pct: spec.sufficiency,
        is_sufficient: sufficient,
      };
    },
  };
  return world;
}
