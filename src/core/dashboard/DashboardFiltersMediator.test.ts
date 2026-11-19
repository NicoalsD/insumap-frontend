import { describe, expect, it, vi } from 'vitest';
import { DashboardFiltersMediator, type FiltersColleague } from './DashboardFiltersMediator';

const colleague = (name: string) => {
  const receive = vi.fn<FiltersColleague['receive']>();
  return { name, receive } satisfies FiltersColleague;
};

describe('DashboardFiltersMediator (P15)', () => {
  it('starts from the API default window with no filters', () => {
    const m = new DashboardFiltersMediator();
    expect(m.getState()).toEqual({
      window: '14d',
      riskTiers: [],
      reviewed: 'all',
      search: '',
      selectedPatientId: null,
    });
    expect(m.toTriageQuery()).toEqual({ window: '14d' });
  });

  it('broadcasts to every colleague except the sender', () => {
    const m = new DashboardFiltersMediator();
    const picker = colleague('window-picker');
    const list = colleague('triage-list');
    m.register(picker);
    m.register(list);
    m.notify(picker, { type: 'window-changed', window: '7d' });
    expect(picker.receive).not.toHaveBeenCalled();
    expect(list.receive).toHaveBeenCalledWith(expect.objectContaining({ window: '7d' }), {
      type: 'window-changed',
      window: '7d',
    });
  });

  it('clears the selected patient when a filter changes, but not on selection', () => {
    const m = new DashboardFiltersMediator();
    m.notify(null, { type: 'patient-selected', patientId: 'p-1' });
    expect(m.getState().selectedPatientId).toBe('p-1');
    m.notify(null, { type: 'reviewed-changed', reviewed: 'pending' });
    expect(m.getState().selectedPatientId).toBeNull();
    expect(m.toTriageQuery()).toEqual({ window: '14d', reviewed: false });
  });

  it('toggles risk tiers in canonical order', () => {
    const m = new DashboardFiltersMediator();
    m.notify(null, { type: 'risk-tier-toggled', tier: 'CRITICAL' });
    m.notify(null, { type: 'risk-tier-toggled', tier: 'HIGH' });
    expect(m.getState().riskTiers).toEqual(['HIGH', 'CRITICAL']);
    m.notify(null, { type: 'risk-tier-toggled', tier: 'HIGH' });
    expect(m.getState().riskTiers).toEqual(['CRITICAL']);
  });

  it('ignores no-op events and trims search', () => {
    const m = new DashboardFiltersMediator();
    const listener = vi.fn();
    m.subscribe(listener);
    m.notify(null, { type: 'window-changed', window: '14d' });
    m.notify(null, { type: 'search-changed', search: '   ' });
    expect(listener).not.toHaveBeenCalled();
    m.notify(null, { type: 'search-changed', search: '  Ruiz ' });
    expect(m.getState().search).toBe('Ruiz');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('resets to the initial filters and stops notifying removed colleagues', () => {
    const m = new DashboardFiltersMediator({ window: '30d' });
    const list = colleague('list');
    const unregister = m.register(list);
    m.notify(null, { type: 'window-changed', window: '24h' });
    m.notify(null, { type: 'reset' });
    expect(m.getState().window).toBe('30d');
    unregister();
    m.notify(null, { type: 'window-changed', window: '7d' });
    expect(list.receive).toHaveBeenCalledTimes(2);
  });

  it('maps the reviewed filter to the API boolean', () => {
    const m = new DashboardFiltersMediator();
    m.notify(null, { type: 'reviewed-changed', reviewed: 'reviewed' });
    expect(m.toTriageQuery()).toEqual({ window: '14d', reviewed: true });
  });
});
