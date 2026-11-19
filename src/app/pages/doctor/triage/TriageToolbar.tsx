import { es } from '@/i18n/es';
import { Button } from '@/ui/Button';
import { TextField } from '@/ui/TextField';
import { SEGMENT_IDS, type SegmentId } from './triageModel';
import './TriageToolbar.css';

export interface TriageToolbarProps {
  readonly search: string;
  readonly segments: readonly SegmentId[];
  /** Counts over the whole list, so each segment number matches what the filter will show. */
  readonly counts: Readonly<Record<SegmentId, number>>;
  readonly onSearch: (value: string) => void;
  readonly onToggleSegment: (segment: SegmentId) => void;
  readonly onClear: () => void;
}

/**
 * Filter bar of the queue, on one row: name search, then the five segments to the right of the
 * search (the window lives in the slider at the top of the panel, one control for the whole page). The segments carry their own names and counts (`aria-pressed`), so they need no label
 * above them; the group is named through `aria-label`.
 */
export function TriageToolbar({ search, segments, counts, onSearch, onToggleSegment, onClear }: TriageToolbarProps) {
  const filtersActive = search.trim() !== '' || segments.length > 0;
  return (
    <div className="triage-toolbar">
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
