import type { PatientOverviewDto, MetricsResponseDto } from '@/services/dto/clinical';
import type { FixtureTriageRow } from './fixtures/world';
import type { TreatmentPlanDto } from '@/services/dto/care';
import type { StaffUserDto } from '@/services/dto/admin';
import type { TargetProfileDto } from '@/services/dto/targetProfile';

/**
 * The mock fixtures keep the rich shape the screens use; these functions put it in the shape the
 * real API sends (see `services/dto/wire.ts`) so MSW answers exactly like the backend does.
 */

const thresholdsOf = (profile: TargetProfileDto) => ({
  ...(profile.population === undefined ? {} : { population: profile.population }),
  range_low_mg_dl: profile.range_low_mg_dl,
  range_high_mg_dl: profile.range_high_mg_dl,
  very_low_mg_dl: profile.very_low_mg_dl,
  very_high_mg_dl: profile.very_high_mg_dl,
  tir_min_pct: profile.tir_min_pct,
  tbr_l1_max_pct: profile.tbr_l1_max_pct,
  tbr_l2_max_pct: profile.tbr_l2_max_pct,
  tar_l1_max_pct: profile.tar_l1_max_pct,
  tar_l2_max_pct: profile.tar_l2_max_pct,
  cv_max_pct: profile.cv_max_pct,
  min_data_sufficiency_pct: profile.min_data_sufficiency_pct,
  min_days: profile.min_days,
  ...(profile.night_start === undefined ? {} : { night_start: profile.night_start }),
  ...(profile.night_end === undefined ? {} : { night_end: profile.night_end }),
});

export function wireMetrics(metrics: MetricsResponseDto) {
  const { target_profile: profile, ...rest } = metrics;
  return {
    ...rest,
    target_profile: { id: profile.id, code: profile.code, version: profile.version, ...thresholdsOf(profile) },
  };
}

export function wireOverview(
  overview: Omit<PatientOverviewDto, 'pending_recommendations' | 'latest_forecast'>,
  timeZone: string,
) {
  const profile = overview.target_profile;
  return {
    patient_id: overview.patient.id,
    timezone: timeZone,
    target: {
      profile_id: profile.id,
      profile_code: profile.code,
      profile_version: profile.version,
      ...thresholdsOf(profile),
    },
    recent_readings: overview.latest_readings.map((reading) => ({
      id: reading.id,
      value_mg_dl: reading.value_mg_dl,
      measured_at: reading.measured_at,
      source: reading.source,
      context: reading.context,
    })),
    active_plan: overview.active_plan
      ? { id: overview.active_plan.id, version: overview.active_plan.version, status: 'ACTIVE' }
      : null,
    open_alerts: overview.open_alerts.map((alert) => ({
      id: alert.id,
      alert_type: alert.type,
      priority: alert.priority,
      status: alert.status,
      opened_at: alert.opened_at,
    })),
    simulated: overview.simulated,
    sex: overview.patient.sex,
    bmi: overview.patient.bmi,
    pregnancy_status: overview.patient.pregnancy_status,
  };
}

export function wireTriageRow(row: FixtureTriageRow) {
  // The fixtures keep the full metrics and the pending count; the triage list sends neither.
  return {
    patient_id: row.patient_id,
    full_name: row.full_name,
    risk_tier: row.risk_tier,
    risk_score: row.risk_score,
    flags: row.flags,
    open_alerts_count: row.open_alerts_count,
    tir_pct: row.metrics.metrics.tir_pct,
    last_reading: row.last_reading,
    reviewed_at: row.reviewed_at,
    is_fallback: row.is_fallback,
    simulated: row.simulated,
  };
}

export function wireAgp(agp: { bins: readonly { time_of_day: string; p5: number; p25: number; p50: number; p75: number; p95: number }[] } & Record<string, unknown>) {
  return {
    ...agp,
    bins: agp.bins.map(({ time_of_day: time, ...percentiles }) => {
      const [hour = '0', minute = '0'] = time.split(':');
      return { minute_of_day: Number(hour) * 60 + Number(minute), ...percentiles };
    }),
  };
}

export function wireUser(user: StaffUserDto) {
  return { id: user.id, email: user.email, full_name: user.full_name, role: user.role, is_active: user.status === 'ACTIVE' };
}

export function wirePlan(plan: TreatmentPlanDto) {
  return {
    id: plan.id,
    version: plan.version,
    notes: plan.summary === '' ? null : plan.summary,
    updated_at: plan.updated_at ?? new Date(0).toISOString(),
    items: plan.schedule.map((item) => ({
      name: item.label,
      insulin_kind: item.insulin_kind,
      dose_units: item.dose_units === null ? null : String(item.dose_units),
      time_of_day: item.time_of_day === '' ? null : `${item.time_of_day}:00`,
      injection_sites: item.injection_sites,
    })),
  };
}

interface TimelineDoseSource {
  readonly id: string;
  readonly kind: string;
  readonly units: number;
  readonly administered_at: string;
  readonly injection_site: string | null;
  readonly injection_spot: number | null;
}

export function wireTimelineDose(dose: TimelineDoseSource) {
  return {
    id: dose.id,
    event_type: 'INSULIN',
    occurred_at: dose.administered_at,
    status: 'ACCEPTED',
    entry_type: 'ORIGINAL',
    data: {
      insulin_kind: dose.kind,
      product_name: null,
      units: dose.units,
      injection_site: dose.injection_site,
      injection_spot: dose.injection_spot,
    },
  };
}
