import { describe, expect, it } from 'vitest';
import type { TriageRowViewModel } from '@/services/adapters/TriageViewModelAdapter';
import { TargetProfileViewModelAdapter } from '@/services/adapters/TargetProfileViewModelAdapter';
import {
  compareAlertsForRail,
  countSegments,
  filterRows,
  normalizeText,
  priorityRank,
  riskBadgeTone,
  sortRows,
  type TriageItem,
} from './triageModel';
import { formatElapsed } from './formatting';

const PROFILE = {
  id: 'p1',
  code: 'ADULT',
  label: 'Adulto',
  version: 1,
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
};

/** Builds a view model from a compact spec; the metrics come from the real adapter. */
function item(overrides: {
  name: string;
  tier?: TriageRowViewModel['riskTier'];
  score?: number;
  tir?: number;
  sufficient?: boolean;
  alerts?: number;
  ai?: number;
  reviewed?: string | null;
  last?: { value: number; at: string } | null;
}): TriageItem {
  const thresholds = new TargetProfileViewModelAdapter().adapt(PROFILE).thresholds;
  return {
    patientId: overrides.name.toLowerCase().replaceAll(' ', '-'),
    fullName: overrides.name,
    riskTier: overrides.tier ?? 'LOW',
    riskScore: overrides.score ?? 10,
    reasons: [],
    openAlertsCount: overrides.alerts ?? 0,
    pendingRecommendationsCount: overrides.ai ?? 0,
    tirPct: overrides.sufficient === false ? null : (overrides.tir ?? 60),
    thresholds,
    lastReading:
      overrides.last === null || overrides.last === undefined
        ? null
        : { valueMgDl: overrides.last.value, measuredAt: new Date(overrides.last.at), state: 'IN_RANGE' },
    reviewedAt: overrides.reviewed ? new Date(overrides.reviewed) : null,
    isFallback: false,
    simulated: false,
    timezone: 'America/Bogota',
  };
}

const rows = [
  item({ name: 'Camila Restrepo', tier: 'CRITICAL', score: 92, tir: 58, alerts: 2, ai: 1, last: { value: 58, at: '2026-11-19T10:00:00Z' } }),
  item({ name: 'Andrés Cardona', tier: 'HIGH', score: 78, tir: 49, alerts: 1, ai: 1, reviewed: '2026-11-18T10:00:00Z' }),
  item({ name: 'Bruno Gil', tier: 'MEDIUM', score: 54, tir: 0, sufficient: false, reviewed: null }),
  item({ name: 'Diana Peña', tier: 'LOW', score: 20, tir: 85, last: null }),
  item({ name: 'Eva Ortiz', tier: 'CRITICAL', score: 95, tir: 40, alerts: 0, ai: 0, reviewed: null }),
];

describe('triage ordering', () => {
  it('ranks by risk tier first and by score inside a tier, highest risk first by default', () => {
    const sorted = sortRows(rows, 'risk', 'descending').map((row) => row.fullName);
    expect(sorted).toEqual(['Eva Ortiz', 'Camila Restrepo', 'Andrés Cardona', 'Bruno Gil', 'Diana Peña']);
  });

  it('keeps missing values last in either direction', () => {
    const ascending = sortRows(rows, 'tir', 'ascending').map((row) => row.fullName);
    const descending = sortRows(rows, 'tir', 'descending').map((row) => row.fullName);
    expect(ascending.at(-1)).toBe('Bruno Gil');
    expect(descending.at(-1)).toBe('Bruno Gil');
  });

  it('sorts the last reading by time and the review column with unreviewed last', () => {
    const byLast = sortRows(rows, 'last', 'descending').map((row) => row.fullName);
    expect(byLast[0]).toBe('Camila Restrepo');
    // Missing readings sort last; among them the name decides (Bruno, Diana, Eva).
    expect(byLast.at(-1)).toBe('Eva Ortiz');
    const byReview = sortRows(rows, 'review', 'descending').map((row) => row.fullName);
    expect(byReview[0]).toBe('Andrés Cardona');
  });

  it('sorts names with Spanish collation', () => {
    expect(sortRows(rows, 'patient', 'ascending').map((row) => row.fullName)[0]).toBe('Andrés Cardona');
  });
});

describe('triage segments and search', () => {
  it('counts each segment over the whole list', () => {
    expect(countSegments(rows)).toEqual({
      critical: 2,
      openAlerts: 2,
      aiPending: 2,
      unreviewed: 4,
      insufficient: 1,
    });
  });

  it('narrows with every active segment together', () => {
    expect(filterRows(rows, '', ['critical', 'unreviewed']).map((row) => row.fullName)).toEqual(['Camila Restrepo', 'Eva Ortiz']);
    expect(filterRows(rows, '', ['critical', 'openAlerts']).map((row) => row.fullName)).toEqual(['Camila Restrepo']);
    expect(filterRows(rows, '', ['aiPending']).map((row) => row.fullName)).toEqual(['Camila Restrepo', 'Andrés Cardona']);
    expect(filterRows(rows, '', ['insufficient']).map((row) => row.fullName)).toEqual(['Bruno Gil']);
  });

  it('matches names regardless of accents and case', () => {
    expect(filterRows(rows, 'ANDRES', []).map((row) => row.fullName)).toEqual(['Andrés Cardona']);
    expect(normalizeText('  Peña ')).toBe('pena');
    expect(filterRows(rows, 'xyz', [])).toEqual([]);
  });
});

describe('alert ordering for the rail', () => {
  it('puts the highest priority first, then the oldest open alert', () => {
    const alerts = [
      { priority: 'MEDIUM', openedAt: new Date('2026-11-19T08:00:00Z') },
      { priority: 'HIGH', openedAt: new Date('2026-11-19T09:00:00Z') },
      { priority: 'HIGH', openedAt: new Date('2026-11-19T07:00:00Z') },
      { priority: 'UNKNOWN', openedAt: new Date('2026-11-18T07:00:00Z') },
    ];
    const ordered = [...alerts].sort(compareAlertsForRail).map((alert) => alert.priority);
    expect(ordered).toEqual(['HIGH', 'HIGH', 'MEDIUM', 'UNKNOWN']);
    expect(alerts[2]?.openedAt.toISOString()).toBe('2026-11-19T07:00:00.000Z');
    expect(priorityRank('UNKNOWN')).toBeGreaterThan(priorityRank('LOW'));
  });

  it('names the risk tone without relying on color alone', () => {
    expect(riskBadgeTone('CRITICAL')).toBe('critical');
    expect(riskBadgeTone('LOW')).toBe('success');
  });
});

describe('relative time', () => {
  const now = new Date('2026-11-19T12:00:00Z');
  it('says how long ago in Spanish, with a floor for the last minute', () => {
    expect(formatElapsed(new Date('2026-11-19T11:50:00Z'), now)).toBe('hace 10 minutos');
    expect(formatElapsed(new Date('2026-11-19T09:00:00Z'), now)).toBe('hace 3 horas');
    expect(formatElapsed(new Date('2026-11-17T12:00:00Z'), now)).toBe('hace 2 días');
    expect(formatElapsed(now, now)).toBe('hace un momento');
  });
});
