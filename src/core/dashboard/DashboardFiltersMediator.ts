/** Time windows the API accepts for metrics and triage (API.md 8.8, 8.11). */
export const TIME_WINDOWS = ['24h', '7d', '14d', '30d'] as const;
export type TimeWindow = (typeof TIME_WINDOWS)[number];

/** The API default window when none is sent (API.md 8.11). */
export const DEFAULT_TIME_WINDOW: TimeWindow = '14d';

export const RISK_TIERS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type RiskTier = (typeof RISK_TIERS)[number];

export type ReviewedFilter = 'all' | 'pending' | 'reviewed';

export interface DashboardFilters {
  readonly window: TimeWindow;
  /** Empty means "all tiers". */
  readonly riskTiers: readonly RiskTier[];
  readonly reviewed: ReviewedFilter;
  readonly search: string;
  readonly selectedPatientId: string | null;
}

export type FiltersEvent =
  | { readonly type: 'window-changed'; readonly window: TimeWindow }
  | { readonly type: 'risk-tier-toggled'; readonly tier: RiskTier }
  | { readonly type: 'reviewed-changed'; readonly reviewed: ReviewedFilter }
  | { readonly type: 'search-changed'; readonly search: string }
  | { readonly type: 'patient-selected'; readonly patientId: string | null }
  | { readonly type: 'reset' };

/** A widget that takes part in the triage filters (window picker, risk chips, list, side panel). */
export interface FiltersColleague {
  readonly name: string;
  receive(state: DashboardFilters, event: FiltersEvent): void;
}

/** Query parameters for `GET /dashboard/triage` derived from the filters. */
export interface TriageQuery {
  readonly window: TimeWindow;
  readonly reviewed?: boolean;
}

const INITIAL: DashboardFilters = {
  window: DEFAULT_TIME_WINDOW,
  riskTiers: [],
  reviewed: 'all',
  search: '',
  selectedPatientId: null,
};

/**
 * Coordinates triage filters, time window and patient selection without coupling the widgets:
 * each widget only talks to the mediator, which applies the shared rules and tells the others.
 *
 * Rules: any filter change clears the selected patient (it may leave the list); `reset`
 * restores the initial filters; search text is trimmed; the sender is not notified back.
 *
 * Pattern: P15 Mediator
 */
export class DashboardFiltersMediator {
  private state: DashboardFilters;
  private readonly initial: DashboardFilters;
  private readonly colleagues = new Set<FiltersColleague>();
  private readonly listeners = new Set<() => void>();

  constructor(initial: Partial<DashboardFilters> = {}) {
    this.initial = { ...INITIAL, ...initial };
    this.state = this.initial;
  }

  getState = (): DashboardFilters => this.state;

  /** Adds a colleague; returns the function that removes it. */
  register(colleague: FiltersColleague): () => void {
    this.colleagues.add(colleague);
    return () => this.colleagues.delete(colleague);
  }

  /** Store-style subscription for `useSyncExternalStore`. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  notify(sender: FiltersColleague | null, event: FiltersEvent): void {
    const next = this.reduce(this.state, event);
    if (next === this.state) return;
    this.state = next;
    for (const colleague of this.colleagues) {
      if (colleague !== sender) colleague.receive(next, event);
    }
    for (const listener of this.listeners) listener();
  }

  toTriageQuery(): TriageQuery {
    const { window, reviewed } = this.state;
    return reviewed === 'all' ? { window } : { window, reviewed: reviewed === 'reviewed' };
  }

  private reduce(state: DashboardFilters, event: FiltersEvent): DashboardFilters {
    const filtered = (patch: Partial<DashboardFilters>): DashboardFilters => ({
      ...state,
      ...patch,
      selectedPatientId: null,
    });
    switch (event.type) {
      case 'window-changed':
        return event.window === state.window ? state : filtered({ window: event.window });
      case 'risk-tier-toggled': {
        const has = state.riskTiers.includes(event.tier);
        const riskTiers = has
          ? state.riskTiers.filter((tier) => tier !== event.tier)
          : RISK_TIERS.filter((tier) => tier === event.tier || state.riskTiers.includes(tier));
        return filtered({ riskTiers });
      }
      case 'reviewed-changed':
        return event.reviewed === state.reviewed ? state : filtered({ reviewed: event.reviewed });
      case 'search-changed': {
        const search = event.search.trim();
        return search === state.search ? state : filtered({ search });
      }
      case 'patient-selected':
        return event.patientId === state.selectedPatientId
          ? state
          : { ...state, selectedPatientId: event.patientId };
      case 'reset':
        return this.initial;
    }
  }
}
