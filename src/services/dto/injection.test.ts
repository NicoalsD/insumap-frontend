import { describe, expect, it } from 'vitest';
import {
  injectionPatientFieldsSchema,
  injectionSitesResponseSchema,
  insulinDoseCreateSchema,
  insulinDoseSchema,
} from './injection';
import { treatmentScheduleItemSchema } from './care';

describe('injection DTO', () => {
  it('gives the patient fields a default when the API omits them', () => {
    expect(injectionPatientFieldsSchema.parse({})).toEqual({
      sex: 'UNKNOWN',
      birth_date: null,
      bmi: null,
      pregnancy_status: 'UNKNOWN',
    });
  });

  it('defaults a plan item without insulin kind or sites to null', () => {
    expect(
      treatmentScheduleItemSchema.parse({ time_of_day: '06:30', label: 'Medir', dose_units: null }),
    ).toMatchObject({
      insulin_kind: null,
      injection_sites: null,
    });
  });

  it('refuses a spot without a site, and a site outside the catalogue', () => {
    expect(
      insulinDoseCreateSchema.safeParse({
        kind: 'BOLUS',
        units: 6,
        administered_at: '2026-11-19T15:00:00Z',
        injection_spot: 2,
      }).success,
    ).toBe(false);
    expect(
      insulinDoseCreateSchema.safeParse({
        kind: 'BOLUS',
        units: 6,
        administered_at: '2026-11-19T15:00:00Z',
        injection_site: 'ABDOMEN_RIGHT',
        injection_spot: 2,
      }).success,
    ).toBe(true);
    expect(
      injectionSitesResponseSchema.safeParse({
        kind: 'BASAL',
        suggestion: null,
        sites: [
          {
            site: 'LEG_LEFT',
            state: 'ALLOWED',
            reason_code: null,
            last_used_at: null,
            last_spot: null,
          },
        ],
        rules_version: 'x',
      }).success,
    ).toBe(false);
  });

  it('accepts MIXED as a dose kind and defaults the product and plan of a response to null', () => {
    expect(
      insulinDoseCreateSchema.safeParse({
        kind: 'MIXED',
        units: 12,
        administered_at: '2026-11-19T15:00:00Z',
      }).success,
    ).toBe(true);
    expect(
      insulinDoseSchema.parse({
        id: '1a000003-0000-4000-8000-000000000001',
        kind: 'BASAL',
        units: 18,
        administered_at: '2026-11-19T15:00:00Z',
        injection_site: null,
        injection_spot: null,
        simulated: false,
      }),
    ).toMatchObject({ insulin_product_id: null, treatment_plan_id: null });
  });
});
