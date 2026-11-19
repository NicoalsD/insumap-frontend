import { describe, expect, it } from 'vitest';
import type { ActivePlan } from '../types';
import { planInsulinItems } from './planItems';

const plan: ActivePlan = { id: 'p1', name: 'Basal-bolo', version: 4, summary: 'Resumen' };

describe('planInsulinItems', () => {
  it('is empty without a plan', () => {
    expect(planInsulinItems(null)).toEqual([]);
  });

  it('is empty while the overview plan carries no schedule', () => {
    expect(planInsulinItems(plan)).toEqual([]);
  });

  it('keeps only the insulin items of the schedule, in order', () => {
    const withItems = {
      ...plan,
      schedule: [
        { time_of_day: '06:30', label: 'Glucosa', dose_units: null, insulin_kind: null, injection_sites: null },
        { time_of_day: '07:30', label: 'Rápida', dose_units: null, insulin_kind: 'BOLUS' as const, injection_sites: null },
        { time_of_day: '22:00', label: 'Basal', dose_units: 18, insulin_kind: 'BASAL' as const, injection_sites: ['THIGH_LEFT' as const] },
      ],
    } as ActivePlan & object;
    expect(planInsulinItems(withItems).map((item) => item.label)).toEqual(['Rápida', 'Basal']);
  });
});
