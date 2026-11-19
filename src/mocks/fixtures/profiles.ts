import type { TargetProfileDto } from '@/services/dto/targetProfile';

/**
 * Target profiles as the API would seed them (API.md 8.7). Every clinical threshold the mocks
 * use lives here and travels inside payloads; no handler or component repeats these numbers.
 */
export const ADULT_STANDARD: TargetProfileDto = {
  id: 'f1000000-0000-4000-8000-000000000001',
  code: 'ADULT_STANDARD',
  label: 'Adulto estándar',
  version: 3,
  population: 'ADULT',
  is_default: true,
  range_low_mg_dl: 70,
  range_high_mg_dl: 180,
  very_low_mg_dl: 54,
  very_high_mg_dl: 250,
  tir_min_pct: 70,
  tbr_l1_max_pct: 4,
  tbr_l2_max_pct: 1,
  tar_l1_max_pct: 25,
  tar_l2_max_pct: 5,
  cv_max_pct: 36,
  min_data_sufficiency_pct: 70,
  min_days: 14,
  hba1c_goal_pct: 7,
  fasting_low_mg_dl: 80,
  fasting_high_mg_dl: 130,
  postprandial_max_mg_dl: 180,
  night_start: '22:00',
  night_end: '06:00',
};

export const OLDER_OR_HIGH_RISK: TargetProfileDto = {
  ...ADULT_STANDARD,
  id: 'f1000000-0000-4000-8000-000000000002',
  code: 'OLDER_OR_HIGH_RISK',
  label: 'Adulto mayor o riesgo alto',
  version: 2,
  population: 'OLDER_OR_HIGH_RISK',
  is_default: false,
  range_low_mg_dl: 70,
  range_high_mg_dl: 180,
  tir_min_pct: 50,
  tbr_l1_max_pct: 1,
  tbr_l2_max_pct: 0,
  tar_l1_max_pct: 50,
  tar_l2_max_pct: 10,
  cv_max_pct: 36,
  hba1c_goal_pct: 8,
};

export const PREGNANCY_T1D: TargetProfileDto = {
  ...ADULT_STANDARD,
  id: 'f1000000-0000-4000-8000-000000000003',
  code: 'PREGNANCY_T1D',
  label: 'Embarazo con diabetes tipo 1',
  version: 1,
  population: 'PREGNANCY',
  is_default: false,
  range_low_mg_dl: 63,
  range_high_mg_dl: 140,
  very_low_mg_dl: 54,
  very_high_mg_dl: 250,
  tir_min_pct: 70,
  tbr_l1_max_pct: 4,
  tbr_l2_max_pct: 1,
  tar_l1_max_pct: 25,
  tar_l2_max_pct: 0,
  hba1c_goal_pct: 6,
};

export const TARGET_PROFILES = [ADULT_STANDARD, OLDER_OR_HIGH_RISK, PREGNANCY_T1D] as const;
