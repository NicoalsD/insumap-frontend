import type { PatientOverviewDto, TriageRowDto } from '@/services/dto/clinical';

/** Risk tier as the triage list sends it. The detail screen shows it; it never computes it. */
export type RiskTier = TriageRowDto['risk_tier'];

/** The active plan of the overview (`active_plan`), when the patient has one. */
export type ActivePlan = NonNullable<PatientOverviewDto['active_plan']>;
