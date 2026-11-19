import { useEffect, useState, useSyncExternalStore, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import {
  DashboardFiltersMediator,
  DEFAULT_TIME_WINDOW,
  type TimeWindow,
} from '@/core/dashboard/DashboardFiltersMediator';
import {
  DEFAULT_TRIAGE_SORT,
  SEGMENT_IDS,
  TRIAGE_SORT_COLUMNS,
  type SegmentId,
  type SortDirection,
  type TriageSortColumn,
} from './triageModel';

/** Windows the triage offers (the API also accepts 24h; the doctor's queue uses these three). */
export const TRIAGE_WINDOWS = ['7d', '14d', '30d'] as const satisfies readonly TimeWindow[];
const WINDOW_PARAM = 'window';
const SEGMENTS_PARAM = 'segments';
const SORT_PARAM = 'sort';
const DIRECTION_PARAM = 'dir';
const LIST_SEPARATOR = ',';

const directionOf = (value: string | null): SortDirection | null =>
  value === 'ascending' || value === 'descending' ? value : null;
const columnOf = (value: string | null): TriageSortColumn | null =>
  (TRIAGE_SORT_COLUMNS as readonly string[]).includes(value ?? '') ? (value as TriageSortColumn) : null;
const windowOf = (value: string | null): (typeof TRIAGE_WINDOWS)[number] =>
  (TRIAGE_WINDOWS as readonly string[]).includes(value ?? '')
    ? (value as (typeof TRIAGE_WINDOWS)[number])
    : (DEFAULT_TIME_WINDOW as (typeof TRIAGE_WINDOWS)[number]);
const segmentsOf = (value: string | null): SegmentId[] =>
  (value ?? '')
    .split(LIST_SEPARATOR)
    .filter((item): item is SegmentId => (SEGMENT_IDS as readonly string[]).includes(item));

/**
 * State of the triage queue. The URL keeps window, segments and sort (shareable, no personal
 * data); the name search and the selected patient stay in memory, so a patient name never lands
 * in an address. `DashboardFiltersMediator` coordinates window, search and selection: a change
 * clears the selected patient. Segments are kept in the URL and notify the mediator the same way.
 *
 * Pattern: P15 Mediator
 */
export function useTriageFilters() {
  const [params, setParams] = useSearchParams();
  const urlWindow = windowOf(params.get(WINDOW_PARAM));
  const [mediator] = useState(() => new DashboardFiltersMediator({ window: urlWindow }));
  const state = useSyncExternalStore(mediator.subscribe, mediator.getState);

  // URL to mediator: back and forward buttons, or a pasted link, move the window too.
  useEffect(() => {
    if (urlWindow !== mediator.getState().window) {
      mediator.notify(null, { type: 'window-changed', window: urlWindow });
    }
  }, [urlWindow, mediator]);

  const segments = segmentsOf(params.get(SEGMENTS_PARAM));
  const sort = {
    column: columnOf(params.get(SORT_PARAM)) ?? DEFAULT_TRIAGE_SORT.column,
    direction: directionOf(params.get(DIRECTION_PARAM)) ?? DEFAULT_TRIAGE_SORT.direction,
  };

  const writeParams = useCallback(
    (patch: Record<string, string | null>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(patch)) {
            if (value === null || value === '') next.delete(key);
            else next.set(key, value);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const setWindow = (value: (typeof TRIAGE_WINDOWS)[number]) => {
    mediator.notify(null, { type: 'window-changed', window: value });
    writeParams({ [WINDOW_PARAM]: value });
  };

  const toggleSegment = (segment: SegmentId) => {
    const next = segments.includes(segment)
      ? segments.filter((item) => item !== segment)
      : [...segments, segment];
    mediator.notify(null, { type: 'patient-selected', patientId: null });
    writeParams({ [SEGMENTS_PARAM]: next.length === 0 ? null : next.join(LIST_SEPARATOR) });
  };

  const setSearch = (search: string) => {
    mediator.notify(null, { type: 'search-changed', search });
  };

  const setSort = (column: TriageSortColumn, direction: SortDirection) => {
    writeParams({ [SORT_PARAM]: column, [DIRECTION_PARAM]: direction });
  };

  const clearFilters = () => {
    mediator.notify(null, { type: 'search-changed', search: '' });
    writeParams({ [SEGMENTS_PARAM]: null });
  };

  const selectPatient = (patientId: string | null) => {
    mediator.notify(null, { type: 'patient-selected', patientId });
  };

  return {
    window: state.window,
    search: state.search,
    selectedPatientId: state.selectedPatientId,
    segments,
    sort,
    setWindow,
    setSearch,
    toggleSegment,
    setSort,
    clearFilters,
    selectPatient,
  };
}
