import { z } from 'zod';

/**
 * Target profile with every clinical threshold, named as in API.md 8.7 (`POST /target-profiles`).
 * All numbers the UI draws (ranges, goals) come from here; none lives in the client.
 *
 * Contract gap: API.md 8.8 returns only `{id, code, version}` in metrics and `target_range` in AGP,
 * and the triage returns no thresholds. The frontend expects the full profile in those payloads.
 */
export const targetProfileSchema = z.object({
  id: z.string(),
  code: z.string(),
  label: z.string(),
  version: z.number().int(),
  population: z.string().nullish(),
  is_default: z.boolean().nullish(),
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
  hba1c_goal_pct: z.number().nullish(),
  fasting_low_mg_dl: z.number().nullish(),
  fasting_high_mg_dl: z.number().nullish(),
  postprandial_max_mg_dl: z.number().nullish(),
  night_start: z.string().nullish(),
  night_end: z.string().nullish(),
});
export type TargetProfileDto = z.infer<typeof targetProfileSchema>;
