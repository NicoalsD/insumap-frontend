import type { TimeWindow } from '@/core/dashboard/DashboardFiltersMediator';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { Button } from '@/ui/Button';
import { Select } from '@/ui/Select';
import { TextField } from '@/ui/TextField';
import { SEGMENT_IDS, type SegmentId } from './triageModel';
import { TRIAGE_WINDOWS } from './useTriageFilters';
import './TriageToolbar.css';

export interface TriageToolbarProps {
  readonly window: TimeWindow;
  readonly search: string;
  readonly segments: readonly SegmentId[];
  /** Counts over the whole list, so each segment number matches what the filter will show. */
  readonly counts: Readonly<Record<SegmentId, number>>;
  readonly onWindow: (value: (typeof TRIAGE_WINDOWS)[number]) => void;
  readonly onSearch: (value: string) => void;
  readonly onToggleSegment: (segment: SegmentId) => void;
  readonly onClear: () => void;
}

/**
 * Filter bar of the queue, on one row: window, name search, then the five segments to the right of
 * the search. The segments carry their own names and counts (`aria-pressed`), so they need no label
 * above them; the group is named through `aria-label`.
 */
export function TriageToolbar({ window, search, segments, counts, onWindow, onSearch, onToggleSegment, onClear }: TriageToolbarProps) {
  const filtersActive = search.trim() !== '' || segments.length > 0;
  return (
    <div className="triage-toolbar">
      <div className="triage-toolbar__window">
        <Select
          label={es.doctor.triage.windowLabel}
          value={window}
          onChange={(event) => {
            const next = TRIAGE_WINDOWS.find((item) => item === event.target.value);
            if (next) onWindow(next);
          }}
          options={TRIAGE_WINDOWS.map((item) => ({
            value: item,
            label: format(es.doctor.triage.windowOption, { days: Number.parseInt(item, 10) }),
          }))}
        />
      </div>
      <div className="triage-toolbar__search">
        <TextField
          label={es.doctor.triage.searchLabel}
          type="search"
          name="patient-search"
          autoComplete="off"
          placeholder={es.doctor.triage.searchPlaceholder}
          value={search}
          onChange={(event) => {
            onSearch(event.target.value);
          }}
        />
      </div>
      <div className="triage-segments" role="group" aria-label={es.doctor.triage.segmentsLabel}>
        {SEGMENT_IDS.map((segment) => (
          <button
            key={segment}
            type="button"
            className="triage-segments__item"
            aria-pressed={segments.includes(segment)}
            onClick={() => {
              onToggleSegment(segment);
            }}
          >
            <span>{es.doctor.triage.segments[segment]}</span>
            <span className="triage-segments__count measure">{counts[segment]}</span>
          </button>
        ))}
      </div>
      {filtersActive ? (
        <Button variant="ghost" size="sm" onClick={onClear}>
          {es.doctor.triage.clearFilters}
        </Button>
      ) : null}
    </div>
  );
}
