import type {
  CareAssignmentDto,
  CredentialInvitationDto,
  ImportBatchDto,
  ImportRowDto,
  PatientAdminDto,
} from '@/services/dto/admin';
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
import { DOCTOR_ACCOUNT, PATIENT_ACCOUNT } from './people';
import { ADULT_STANDARD, OLDER_OR_HIGH_RISK, PREGNANCY_T1D } from './profiles';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

type RiskTier = TriageRowDto['risk_tier'];

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
  readonly sufficiency: number;
  readonly lastValue: number;
  readonly lastMinutesAgo: number;
  readonly openAlerts: number;
  readonly pendingRecommendations: number;
  readonly reviewed: boolean;
}

const SPECS: readonly PatientSpec[] = [
  {
    n: 1, fullName: 'Camila Restrepo Ossa', mrn: 'MRN-10001', profile: ADULT_STANDARD, risk: 'CRITICAL', score: 92,
    reasons: [{ code: 'RECURRENT_HYPO', reason: 'Dos hipoglucemias en las últimas 24 horas' }, { code: 'TBR_ABOVE_GOAL', reason: 'Tiempo bajo rango por encima de la meta' }],
    pct: [3, 9, 58, 22, 8], mean: 168, cv: 41, sufficiency: 94, lastValue: 58, lastMinutesAgo: 12, openAlerts: 2, pendingRecommendations: 1, reviewed: false,
  },
  {
    n: 2, fullName: 'Andrés Felipe Cardona', mrn: 'MRN-10002', profile: ADULT_STANDARD, risk: 'HIGH', score: 78,
    reasons: [{ code: 'TAR_ABOVE_GOAL', reason: 'Tiempo sobre rango muy por encima de la meta' }, { code: 'POSTPRANDIAL_SPIKES', reason: 'Picos después de las comidas' }],
    pct: [0, 2, 49, 31, 18], mean: 204, cv: 33, sufficiency: 91, lastValue: 268, lastMinutesAgo: 25, openAlerts: 1, pendingRecommendations: 1, reviewed: false,
  },
  {
    n: 3, fullName: PATIENT_ACCOUNT.fullName, mrn: 'MRN-10003', profile: ADULT_STANDARD, risk: 'MEDIUM', score: 54,
    reasons: [{ code: 'NIGHT_LOWS', reason: 'Valores bajos entre las 2 y las 4 de la madrugada' }],
    pct: [1, 4, 66, 22, 7], mean: 158, cv: 37, sufficiency: 88, lastValue: 142, lastMinutesAgo: 40, openAlerts: 1, pendingRecommendations: 0, reviewed: false,
  },
  {
    n: 4, fullName: 'Julián David Mejía', mrn: 'MRN-10004', profile: OLDER_OR_HIGH_RISK, risk: 'MEDIUM', score: 47,
    reasons: [{ code: 'HIGH_VARIABILITY', reason: 'Variabilidad glucémica alta' }],
    pct: [0, 1, 58, 33, 8], mean: 176, cv: 39, sufficiency: 86, lastValue: 195, lastMinutesAgo: 75, openAlerts: 0, pendingRecommendations: 1, reviewed: false,
  },
  {
    n: 5, fullName: 'Valentina Gómez Arias', mrn: 'MRN-10005', profile: PREGNANCY_T1D, risk: 'LOW', score: 28,
    reasons: [{ code: 'NEAR_GOAL', reason: 'Cerca de la meta del perfil de embarazo' }],
    pct: [0, 3, 72, 22, 3], mean: 131, cv: 31, sufficiency: 96, lastValue: 118, lastMinutesAgo: 18, openAlerts: 0, pendingRecommendations: 0, reviewed: true,
  },
  {
    n: 6, fullName: 'Sebastián Arango Londoño', mrn: 'MRN-10006', profile: ADULT_STANDARD, risk: 'LOW', score: 19,
    reasons: [{ code: 'IN_TARGET', reason: 'Cumple las metas de la ventana' }],
    pct: [0, 1, 82, 15, 2], mean: 139, cv: 27, sufficiency: 97, lastValue: 124, lastMinutesAgo: 9, openAlerts: 0, pendingRecommendations: 0, reviewed: true,
  },
  {
    n: 7, fullName: 'Mariana Duque Salcedo', mrn: 'MRN-10007', profile: ADULT_STANDARD, risk: 'MEDIUM', score: 41,
    reasons: [{ code: 'INSUFFICIENT_DATA', reason: 'Pocas lecturas en la ventana: faltan datos' }],
    pct: [0, 0, 70, 25, 5], mean: 162, cv: 30, sufficiency: 38, lastValue: 171, lastMinutesAgo: 300, openAlerts: 0, pendingRecommendations: 0, reviewed: false,
  },
  {
    n: 8, fullName: 'Tomás Zuluaga Peña', mrn: 'MRN-10008', profile: ADULT_STANDARD, risk: 'LOW', score: 22,
    reasons: [{ code: 'IN_TARGET', reason: 'Cumple las metas de la ventana' }],
    pct: [0, 2, 76, 19, 3], mean: 147, cv: 29, sufficiency: 93, lastValue: 133, lastMinutesAgo: 55, openAlerts: 0, pendingRecommendations: 0, reviewed: true,
  },
];

const uuid = (prefix: string, n: number): string =>
  `${prefix}0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const patientId = (n: number): string => `a1${String(n).padStart(6, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;

const round = (value: number, digits = 1): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

function metricsFor(spec: PatientSpec, window: MetricsWindow, now: Date): MetricsResponseDto {
  const [vl, l, ir, h, vh] = spec.pct;
  const days = { '24h': 1, '7d': 7, '14d': 14, '30d': 30 }[window];
  const metrics: GlycemicMetricsDto = {
    tir_pct: ir,
    tbr_l1_pct: l,
    tbr_l2_pct: vl,
    tbr_pct: vl + l,
    tar_l1_pct: h,
    tar_l2_pct: vh,
    tar_pct: h + vh,
    mean_glucose_mg_dl: spec.mean,
    gmi_pct: round(3.31 + 0.02392 * spec.mean, 2),
    cv_pct: spec.cv,
    hypo_events_count: vl + l > 5 ? 4 : vl + l > 2 ? 2 : 0,
  };
  return {
    window,
    period_from: new Date(now.getTime() - days * DAY_MS).toISOString(),
    period_to: now.toISOString(),
    timezone: 'America/Bogota',
    target_profile: spec.profile,
    data_sufficiency_pct: spec.sufficiency,
    is_sufficient: spec.sufficiency >= spec.profile.min_data_sufficiency_pct,
    confidence: spec.sufficiency >= 90 ? 'NORMAL' : 'LOW_CONFIDENCE',
    metrics,
    tir_delta_pct: spec.risk === 'CRITICAL' || spec.risk === 'HIGH' ? -6 : 3,
  };
}

function readingsFor(spec: PatientSpec, now: Date): GlucoseReadingDto[] {
  const count = 32;
  const last = now.getTime() - spec.lastMinutesAgo * MINUTE_MS;
  const readings: GlucoseReadingDto[] = [];
  for (let i = 0; i < count; i += 1) {
    const isLast = i === 0;
    const wave = Math.sin((i + spec.n) * 0.85) * 38 + Math.cos(i * 0.31) * 14;
    const value = isLast ? spec.lastValue : Math.max(48, Math.round(spec.mean + wave));
    readings.push({
      id: uuid('e1', spec.n * 100 + i),
      client_reading_id: uuid('c2', spec.n * 100 + i),
      value_mg_dl: value,
      measured_at: new Date(last - i * 3 * HOUR_MS).toISOString(),
      source: i % 4 === 3 ? 'SMBG' : 'CGM',
      context: i % 5 === 0 ? 'FASTING' : null,
      status: 'ACCEPTED',
      issue_codes: [],
      simulated: true,
    });
  }
  return readings;
}

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
  triage(window: MetricsWindow): TriageRowDto[];
  overview(patientId: string, window: MetricsWindow): PatientOverviewDto | null;
  metrics(patientId: string, window: MetricsWindow): MetricsResponseDto | null;
  readings(patientId: string): GlucoseReadingDto[] | null;
  agp(patientId: string): {
    bins: { time_of_day: string; p5: number; p25: number; p50: number; p75: number; p95: number }[];
    target_range: { low: number; high: number };
    data_sufficiency_pct: number;
    is_sufficient: boolean;
  } | null;
}

export function createWorld(now: Date = new Date()): FixtureWorld {
  const alerts: AlertDto[] = SPECS.flatMap((spec) =>
    Array.from({ length: spec.openAlerts }, (_, i): AlertDto => {
      const hypo = spec.lastValue < spec.profile.range_low_mg_dl || spec.reasons[0]?.code === 'NIGHT_LOWS' || i === 1;
      return {
        id: uuid('a1', spec.n * 10 + i),
        patient_id: patientId(spec.n),
        patient_name: spec.fullName,
        type: hypo ? 'HYPOGLYCEMIA' : 'HYPERGLYCEMIA',
        level: hypo ? (spec.risk === 'CRITICAL' ? 2 : 1) : null,
        priority: spec.risk === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
        status: 'OPEN',
        opened_at: new Date(now.getTime() - (spec.lastMinutesAgo + i * 90) * MINUTE_MS).toISOString(),
        rule_id: uuid('b2', 1),
        is_fallback: false,
        simulated: true,
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
  const recommendations: RecommendationDto[] = SPECS.filter((s) => s.pendingRecommendations > 0).map((spec, i) => {
    const decrease = spec.n === 1;
    return {
      id: uuid('f2', spec.n),
      patient_id: patientId(spec.n),
      status: 'PROPOSED',
      proposal: proposalFor(decrease ? 18 : 22, decrease ? 2 : 1, decrease ? 'DECREASE' : 'INCREASE'),
      explanation: {
        summary: decrease
          ? 'Hipoglucemias repetidas en la madrugada sugieren reducir la insulina basal.'
          : 'El tiempo sobre rango se mantiene por encima de la meta con la dosis actual.',
        factors: decrease
          ? ['Dos lecturas por debajo del corte bajo en 24 horas', 'Tendencia descendente nocturna en la AGP']
          : ['Tiempo sobre rango por encima de la meta del perfil', 'Picos después de la cena en siete de catorce días'],
        data_refs: [`window:14d`, `profile:${spec.profile.code}`],
      },
      model_version: 'baseline-rules-0.1',
      is_fallback: i === 2,
      fallback_reason: i === 2 ? 'AI_TIMEOUT' : null,
      expires_at: new Date(now.getTime() + 3 * DAY_MS).toISOString(),
      created_at: new Date(now.getTime() - 2 * HOUR_MS).toISOString(),
      simulated: true,
    };
  });

  const patientAdmin: PatientAdminDto[] = [
    ...SPECS.map((spec): PatientAdminDto => ({
      id: patientId(spec.n),
      full_name: spec.fullName,
      mrn: spec.mrn,
      document_last4: String(1000 + spec.n * 37).slice(-4),
      account_status: spec.n === 7 ? 'INVITED' : 'ACTIVE',
      primary_doctor_id: DOCTOR_ACCOUNT.id,
      assigned_doctor_count: 1,
      invitation_status: spec.n === 7 ? 'PENDING' : null,
      simulated: true,
    })),
    {
      id: patientId(9), full_name: 'Isabela Naranjo Cruz', mrn: 'MRN-10009', document_last4: '4412',
      account_status: 'IMPORTED', primary_doctor_id: null, assigned_doctor_count: 0, invitation_status: null, simulated: true,
    },
  ];

  const careAssignments: CareAssignmentDto[] = SPECS.map((spec) => ({
    id: uuid('ca', spec.n),
    patient_id: patientId(spec.n),
    doctor_id: DOCTOR_ACCOUNT.id,
    is_primary: true,
    started_at: new Date(now.getTime() - 90 * DAY_MS).toISOString(),
    ended_at: null,
    end_reason: null,
    patient_name: spec.fullName,
    doctor_name: DOCTOR_ACCOUNT.fullName,
  }));

  const world: FixtureWorld = {
    now,
    specs: SPECS,
    alerts,
    recommendations,
    imports: new Map(),
    invitations: new Map(),
    patientAdmin,
    careAssignments,
    metrics(id, window) {
      const spec = SPECS.find((s) => patientId(s.n) === id);
      return spec ? metricsFor(spec, window, now) : null;
    },
    readings(id) {
      const spec = SPECS.find((s) => patientId(s.n) === id);
      return spec ? readingsFor(spec, now) : null;
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
          open_alerts_count: world.alerts.filter((a) => a.patient_id === patientId(spec.n) && a.status === 'OPEN').length,
          pending_recommendations_count: world.recommendations.filter(
            (r) => r.patient_id === patientId(spec.n) && r.status === 'PROPOSED',
          ).length,
          metrics: metricsFor(spec, window, now),
          last_reading: {
            value_mg_dl: spec.lastValue,
            measured_at: new Date(now.getTime() - spec.lastMinutesAgo * MINUTE_MS).toISOString(),
          },
          reviewed_at: spec.reviewed ? new Date(now.getTime() - 5 * HOUR_MS).toISOString() : null,
          is_fallback: false,
          simulated: true,
        }));
    },
    overview(id, window) {
      const spec = SPECS.find((s) => patientId(s.n) === id);
      if (!spec) return null;
      return {
        patient: { id, full_name: spec.fullName },
        target_profile: spec.profile,
        latest_readings: readingsFor(spec, now).slice(0, 12),
        metrics: metricsFor(spec, window, now),
        active_plan: {
          id: uuid('d3', spec.n), name: 'Basal-bolo adulto', version: 4,
          summary: 'Insulina basal nocturna y bolos con las comidas principales.',
        },
        open_alerts: world.alerts.filter((a) => a.patient_id === id && a.status !== 'RESOLVED'),
        pending_recommendations: world.recommendations.filter((r) => r.patient_id === id && r.status === 'PROPOSED'),
        latest_forecast: {
          mode: 'SHORT_TERM', generated_at: now.toISOString(),
          trend: spec.lastValue < spec.profile.range_low_mg_dl ? 'FALLING' : 'STABLE',
          is_fallback: true, fallback_reason: 'AI_TIMEOUT',
        },
        simulated: true,
        data_source: 'SIMULATED',
      };
    },
    agp(id) {
      const spec = SPECS.find((s) => patientId(s.n) === id);
      if (!spec) return null;
      const sufficient = spec.sufficiency >= spec.profile.min_data_sufficiency_pct;
      return {
        bins: sufficient
          ? Array.from({ length: 24 }, (_, hour) => {
              const p50 = Math.round(spec.mean + Math.sin((hour - 6) / 3.8) * 28);
              return {
                time_of_day: `${String(hour).padStart(2, '0')}:00`,
                p5: p50 - 55, p25: p50 - 24, p50, p75: p50 + 30, p95: p50 + 72,
              };
            })
          : [],
        target_range: { low: spec.profile.range_low_mg_dl, high: spec.profile.range_high_mg_dl },
        data_sufficiency_pct: spec.sufficiency,
        is_sufficient: sufficient,
      };
    },
  };
  return world;
}
