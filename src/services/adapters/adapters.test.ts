import { describe, expect, it } from 'vitest';
import { ACCOUNTS, DOCTOR_ACCOUNT, PATIENT_ACCOUNT } from '@/mocks/fixtures/people';
import { ADULT_STANDARD } from '@/mocks/fixtures/profiles';
import { createWorld, patientId } from '@/mocks/fixtures/world';
import type { CurrentUserDto } from '../dto/auth';
import { AlertViewModelAdapter } from './AlertViewModelAdapter';
import { adaptAll } from './ViewModelAdapter';
import { ImportBatchViewModelAdapter, ImportRowViewModelAdapter } from './ImportViewModelAdapters';
import { MetricsViewModelAdapter, windowToDays } from './MetricsViewModelAdapter';
import { ReadingViewModelAdapter } from './ReadingViewModelAdapter';
import { RecommendationViewModelAdapter } from './RecommendationViewModelAdapter';
import { SessionViewModelAdapter } from './SessionViewModelAdapter';
import { TargetProfileViewModelAdapter } from './TargetProfileViewModelAdapter';
import { TriageViewModelAdapter } from './TriageViewModelAdapter';

const NOW = new Date('2026-11-15T14:30:00Z');
const world = createWorld(NOW);

describe('TargetProfileViewModelAdapter (P06 Adapter)', () => {
  it('maps the API cut points to thresholds and goals', () => {
    const vm = new TargetProfileViewModelAdapter().adapt(ADULT_STANDARD);
    expect(vm.thresholds).toEqual({
      veryLowMgDl: ADULT_STANDARD.very_low_mg_dl,
      rangeLowMgDl: ADULT_STANDARD.range_low_mg_dl,
      rangeHighMgDl: ADULT_STANDARD.range_high_mg_dl,
      veryHighMgDl: ADULT_STANDARD.very_high_mg_dl,
    });
    expect(vm.goals.tirMinPct).toBe(ADULT_STANDARD.tir_min_pct);
    expect(vm.code).toBe('ADULT_STANDARD');
  });

  it('refuses a profile whose cut points are not ascending', () => {
    expect(() =>
      new TargetProfileViewModelAdapter().adapt({ ...ADULT_STANDARD, very_low_mg_dl: 999 }),
    ).toThrow(/ascending/);
  });
});

describe('MetricsViewModelAdapter (P06 Adapter)', () => {
  const dto = world.metrics(patientId(1), '14d');

  it('maps tbr_l2 to very low, tbr_l1 to low, tar_l1 to high and tar_l2 to very high', () => {
    if (!dto) throw new Error('missing fixture');
    const vm = new MetricsViewModelAdapter().adapt({
      ...dto,
      metrics: { ...dto.metrics, tbr_l2_pct: 1, tbr_l1_pct: 2, tir_pct: 60, tar_l1_pct: 30, tar_l2_pct: 7 },
    });
    expect(vm.timeInRanges.percentByState).toEqual({
      VERY_LOW: 1, LOW: 2, IN_RANGE: 60, HIGH: 30, VERY_HIGH: 7,
    });
    expect(vm.timeInRanges.windowDays).toBe(14);
    expect(vm.periodTo).toEqual(NOW);
  });

  it('carries sufficiency, confidence and the optional delta', () => {
    if (!dto) throw new Error('missing fixture');
    const vm = new MetricsViewModelAdapter().adapt({ ...dto, is_sufficient: false, confidence: 'LOW_CONFIDENCE' });
    expect(vm.timeInRanges.isSufficient).toBe(false);
    expect(vm.timeInRanges.confidence).toBe('LOW_CONFIDENCE');
    expect(vm.tirDeltaPct).toBe(dto.tir_delta_pct);
  });

  it('converts windows to days', () => {
    expect(windowToDays('30d')).toBe(30);
    expect(windowToDays('24h')).toBe(1);
    expect(windowToDays('bad')).toBeNull();
  });
});

describe('TriageViewModelAdapter (P06 Adapter)', () => {
  it('classifies the last reading with the patient own thresholds', () => {
    const rows = adaptAll(new TriageViewModelAdapter(), world.triage('14d'));
    expect(rows[0]?.fullName).toBe('Camila Restrepo Ossa');
    expect(rows[0]?.lastReading?.state).toBe('LOW');
    const hyper = rows.find((r) => r.patientId === patientId(2));
    expect(hyper?.lastReading?.state).toBe('VERY_HIGH');
    expect(hyper?.reasons.length).toBeGreaterThan(0);
  });
});

describe('ReadingViewModelAdapter (P06 Adapter)', () => {
  it('classifies and flags readings', () => {
    const adapter = new ReadingViewModelAdapter(new TargetProfileViewModelAdapter().adapt(ADULT_STANDARD).thresholds);
    const [reading] = world.readings(patientId(3)) ?? [];
    if (!reading) throw new Error('missing fixture');
    const vm = adapter.adapt({ ...reading, value_mg_dl: ADULT_STANDARD.range_high_mg_dl + 1, status: 'FLAGGED' });
    expect(vm.state).toBe('HIGH');
    expect(vm.flagged).toBe(true);
    expect(vm.measuredAt).toBeInstanceOf(Date);
  });
});

describe('AlertViewModelAdapter and RecommendationViewModelAdapter (P06 Adapter)', () => {
  it('marks open and escalated alerts as needing attention', () => {
    const [alert] = world.alerts;
    if (!alert) throw new Error('missing fixture');
    const adapter = new AlertViewModelAdapter();
    expect(adapter.adapt(alert).needsAttention).toBe(true);
    expect(adapter.adapt({ ...alert, status: 'RESOLVED' }).needsAttention).toBe(false);
  });

  it('lets the doctor decide only a proposed, unexpired suggestion', () => {
    const [rec] = world.recommendations;
    if (!rec) throw new Error('missing fixture');
    const adapter = new RecommendationViewModelAdapter(() => NOW);
    expect(adapter.adapt(rec).canDecide).toBe(true);
    expect(adapter.adapt({ ...rec, status: 'APPROVED' }).canDecide).toBe(false);
    const late = new RecommendationViewModelAdapter(() => new Date(NOW.getTime() + 10 * 24 * 3_600_000));
    expect(late.adapt(rec).canDecide).toBe(false);
    expect(adapter.adapt(rec).proposal?.deltaUnits).toBe(rec.proposal?.delta_units);
  });
});

describe('SessionViewModelAdapter (P06 Adapter)', () => {
  const dto = (account: (typeof ACCOUNTS)[number], isDemo: boolean): CurrentUserDto => ({
    user: { id: account.id, email: account.email, full_name: account.fullName },
    role: account.role,
    clinic: { id: 'c', name: 'Clínica', is_demo: isDemo, simulated: isDemo },
    permissions: [...account.permissions],
    mfa_enabled: account.mfaEnabled,
    consent_required: false,
  });

  it('exposes permissions through can() and the demo flag', () => {
    const vm = new SessionViewModelAdapter().adapt(dto(DOCTOR_ACCOUNT, true));
    expect(vm.can('dashboard.read_assigned')).toBe(true);
    expect(vm.can('patients.import')).toBe(false);
    expect(vm.isDemo).toBe(true);
    expect(new SessionViewModelAdapter().adapt(dto(PATIENT_ACCOUNT, false)).isDemo).toBe(false);
  });
});

describe('ImportViewModelAdapters (P06 Adapter)', () => {
  it('sums the totals and allows confirming only with importable rows', () => {
    const adapter = new ImportBatchViewModelAdapter();
    const base = {
      batch_id: 'b', source: 'CSV' as const, status: 'PREVIEW', simulated: true,
      totals: { valid: 3, warning: 1, error: 2, skipped_duplicate: 1 },
    };
    expect(adapter.adapt(base).totals.all).toBe(7);
    expect(adapter.adapt(base).canConfirm).toBe(true);
    expect(adapter.adapt({ ...base, totals: { valid: 0, warning: 0, error: 2, skipped_duplicate: 0 } }).canConfirm).toBe(false);
  });

  it('maps a row', () => {
    const vm = new ImportRowViewModelAdapter().adapt({
      row_number: 4, status: 'ERROR', issue_codes: ['INVALID_BIRTH_DATE'], patient_id: null,
    });
    expect(vm).toEqual({ rowNumber: 4, status: 'ERROR', issueCodes: ['INVALID_BIRTH_DATE'], patientId: null });
  });
});
