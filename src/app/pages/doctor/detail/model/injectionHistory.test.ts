import { describe, expect, it } from 'vitest';
import type { InsulinDoseDto, SiteCode } from '@/services/dto/injection';
import { analyzeInjectionHistory, MIN_DOSES_FOR_CONCENTRATION, RECENT_DOSES_SHOWN } from './injectionHistory';

const END = new Date('2026-11-19T12:00:00Z');
const HOUR_MS = 3_600_000;

function dose(id: string, hoursBefore: number, site: SiteCode | null, spot: number | null = null): InsulinDoseDto {
  return {
    id,
    insulin_product_id: null,
    kind: 'BOLUS',
    units: 6,
    administered_at: new Date(END.getTime() - hoursBefore * HOUR_MS).toISOString(),
    treatment_plan_id: null,
    injection_site: site,
    injection_spot: spot,
    simulated: false,
  };
}

describe('analyzeInjectionHistory', () => {
  it('counts doses per site inside the last 14 days only', () => {
    const doses = [
      dose('a', 1, 'ABDOMEN_LEFT', 1),
      dose('b', 24 * 3, 'ABDOMEN_LEFT', 2),
      dose('old', 24 * 20, 'ABDOMEN_LEFT', 3),
      dose('c', 5, 'THIGH_RIGHT', 1),
    ];
    const history = analyzeInjectionHistory(doses, END);
    expect(history.sites.find((site) => site.site === 'ABDOMEN_LEFT')?.count).toBe(2);
    expect(history.sites.find((site) => site.site === 'THIGH_RIGHT')?.count).toBe(1);
    expect(history.withSite).toBe(3);
  });

  it('marks a site RECENT when it was used within 72 hours, and not beyond', () => {
    const history = analyzeInjectionHistory(
      [dose('a', 70, 'ARM_LEFT', 1), dose('b', 73, 'ARM_RIGHT', 1)],
      END,
    );
    expect(history.sites.find((site) => site.site === 'ARM_LEFT')?.recent).toBe(true);
    expect(history.sites.find((site) => site.site === 'ARM_RIGHT')?.recent).toBe(false);
  });

  it('keeps the last spot used at a site', () => {
    const history = analyzeInjectionHistory([dose('a', 10, 'BUTTOCK_LEFT', 2), dose('b', 30, 'BUTTOCK_LEFT', 1)], END);
    expect(history.sites.find((site) => site.site === 'BUTTOCK_LEFT')?.lastSpot).toBe(2);
  });

  it('flags a site that concentrates at least 40 % of the doses with a site, with enough doses', () => {
    const doses = [
      ...Array.from({ length: 6 }, (_, i) => dose(`r${String(i)}`, i + 1, 'ABDOMEN_LEFT', 1)),
      dose('o1', 40, 'THIGH_LEFT', 1),
      dose('o2', 44, 'THIGH_RIGHT', 1),
    ];
    expect(analyzeInjectionHistory(doses, END).concentrated?.site).toBe('ABDOMEN_LEFT');
  });

  it('does not flag a concentration below the share, or with too few doses', () => {
    const balanced = ['ABDOMEN_LEFT', 'ABDOMEN_RIGHT', 'THIGH_LEFT', 'THIGH_RIGHT', 'ARM_LEFT'].map((site, i) =>
      dose(`b${String(i)}`, i + 1, site as SiteCode, 1),
    );
    expect(analyzeInjectionHistory(balanced, END).concentrated).toBeNull();
    const few = Array.from({ length: MIN_DOSES_FOR_CONCENTRATION - 1 }, (_, i) => dose(`f${String(i)}`, i + 1, 'ABDOMEN_LEFT', 1));
    expect(analyzeInjectionHistory(few, END).concentrated).toBeNull();
  });

  it('lists the most recent doses first, up to the shown limit', () => {
    const doses = Array.from({ length: RECENT_DOSES_SHOWN + 3 }, (_, i) => dose(`d${String(i)}`, i + 1, 'ABDOMEN_LEFT', 1));
    const recent = analyzeInjectionHistory(doses, END).recentDoses;
    expect(recent).toHaveLength(RECENT_DOSES_SHOWN);
    expect(recent[0]?.id).toBe('d0');
  });

  it('counts doses without a site in the list but never in a site count', () => {
    const history = analyzeInjectionHistory([dose('n', 2, null)], END);
    expect(history.withSite).toBe(0);
    expect(history.recentDoses).toHaveLength(1);
  });
});
