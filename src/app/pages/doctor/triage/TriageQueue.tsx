import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { Badge } from '@/ui/Badge';
import { RangeRuler } from '@/ui/glucose/RangeRuler';
import { formatClock, formatElapsed } from './formatting';
import { riskBadgeTone, type SortDirection, type TriageItem, type TriageSortColumn } from './triageModel';
import { TirBar } from './TirBar';
import './TriageQueue.css';

/** Rows shown before "Mostrar más". Above this, the list pages instead of rendering every row. */
export const QUEUE_PAGE_SIZE = 50;

export interface TriageQueueProps {
  readonly rows: readonly TriageItem[];
  readonly selectedId: string | null;
  readonly sort: { readonly column: TriageSortColumn; readonly direction: SortDirection };
  readonly now: Date;
  readonly onSort: (column: TriageSortColumn, direction: SortDirection) => void;
  readonly onSelect: (patientId: string) => void;
  /** Identifies the current filter set; the page size resets when it changes. */
  readonly filterKey: string;
}

const HEADERS: readonly { readonly column: TriageSortColumn; readonly label: string }[] = [
  { column: 'patient', label: es.doctor.triage.columns.patient },
  { column: 'risk', label: es.doctor.triage.columns.risk },
  { column: 'tir', label: es.doctor.triage.columns.tir },
  { column: 'last', label: es.doctor.triage.columns.last },
  { column: 'alerts', label: es.doctor.triage.columns.alerts },
  { column: 'ai', label: es.doctor.triage.columns.ai },
  { column: 'review', label: es.doctor.triage.columns.review },
];

/** Keyboard moves between the patient links of the rows. */
const KEY_STEP: Readonly<Record<string, 'next' | 'prev' | 'first' | 'last'>> = {
  ArrowDown: 'next',
  ArrowUp: 'prev',
  Home: 'first',
  End: 'last',
};

/**
 * Dense patient queue, full width: one row per patient (44 to 48 px), sortable headers with
 * `aria-sort`, a real `<table>` with a caption. The patient name is a link (Enter opens the record)
 * and arrows move between those links; focus or click selects the patient for the preview.
 */
export function TriageQueue({ rows, selectedId, sort, now, onSort, onSelect, filterKey }: TriageQueueProps) {
  const body = useRef<HTMLTableSectionElement>(null);
  const [paged, setPaged] = useState({ key: filterKey, count: QUEUE_PAGE_SIZE });
  const count = paged.key === filterKey ? paged.count : QUEUE_PAGE_SIZE;
  const shown = rows.slice(0, count);
  const remaining = rows.length - shown.length;

  const onKeyDown = (event: KeyboardEvent<HTMLTableSectionElement>) => {
    const step = KEY_STEP[event.key];
    const links = Array.from(body.current?.querySelectorAll<HTMLAnchorElement>('a[data-triage-name]') ?? []);
    if (!step || links.length === 0) return;
    const current = links.indexOf(event.target as HTMLAnchorElement);
    const target = {
      next: Math.min(links.length - 1, current + 1),
      prev: Math.max(0, current - 1),
      first: 0,
      last: links.length - 1,
    }[step];
    event.preventDefault();
    links[target]?.focus();
  };

  return (
    <div className="triage-queue">
      <div className="triage-queue__scroll" role="region" aria-labelledby="triage-queue-caption" tabIndex={0}>
        <table className="triage-table">
          <caption id="triage-queue-caption" className="visually-hidden">
            {es.doctor.triage.queueCaption}
          </caption>
          <thead>
            <tr>
              {HEADERS.map((header) => {
                const active =
                  sort.column === header.column
                    ? sort.direction
                    : undefined;
                const Icon = active === 'ascending' ? ArrowUp : active === 'descending' ? ArrowDown : ArrowUpDown;
                return (
                  <th key={header.column} scope="col" aria-sort={active}>
                    <button
                      type="button"
                      className="triage-table__sort"
                      onClick={() => {
                        const direction: SortDirection =
                          sort.column === header.column && sort.direction === 'descending' ? 'ascending' : 'descending';
                        onSort(header.column, direction);
                      }}
                    >
                      {header.label}
                      <Icon className="triage-table__sort-icon" size="1em" aria-hidden="true" />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody ref={body} onKeyDown={onKeyDown}>
            {shown.map((row) => (
              <TriageRow key={row.patientId} row={row} selected={row.patientId === selectedId} now={now} onSelect={onSelect} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="triage-queue__footer">
        <p className="triage-queue__count" role="status">
          {format(es.doctor.triage.showing, { shown: shown.length, total: rows.length })}
        </p>
        <p className="triage-queue__hint">{es.doctor.triage.keyboardHint}</p>
        {remaining > 0 ? (
          <button
            type="button"
            className="triage-queue__more"
            onClick={() => {
              setPaged({ key: filterKey, count: count + QUEUE_PAGE_SIZE });
            }}
          >
            {format(es.doctor.triage.showMore, { count: Math.min(remaining, QUEUE_PAGE_SIZE) })}
          </button>
        ) : null}
      </div>
    </div>
  );
}

interface TriageRowProps {
  readonly row: TriageItem;
  readonly selected: boolean;
  readonly now: Date;
  readonly onSelect: (patientId: string) => void;
}

function TriageRow({ row, selected, now, onSelect }: TriageRowProps) {
  const reasons = row.reasons;
  const firstReason = reasons[0]?.text ?? es.doctor.triage.noReason;
  const extraReasons = reasons.length - 1;
  const reason = extraReasons > 0 ? `${firstReason} · ${format(es.doctor.triage.reasonMore, { count: extraReasons })}` : firstReason;

  return (
    <tr
      className="triage-table__row"
      data-selected={selected ? '' : undefined}
      onFocus={() => {
        onSelect(row.patientId);
      }}
      onClick={() => {
        onSelect(row.patientId);
      }}
    >
      <td className="triage-table__patient">
        <div className="triage-table__patient-line">
          <Link to={`/doctor/patients/${row.patientId}`} className="triage-name" data-triage-name="" title={row.fullName}>
            {row.fullName}
          </Link>
          <span className="triage-reason" title={reason}>
            {reason}
          </span>
          {row.isFallback ? <Badge tone="neutral">{es.doctor.triage.fallbackBadge}</Badge> : null}
        </div>
      </td>
      <td>
        <Badge tone={riskBadgeTone(row.riskTier)}>{es.risk[row.riskTier]}</Badge>
      </td>
      <td className="triage-table__tir">
        <TirBar timeInRanges={row.metrics.timeInRanges} />
      </td>
      <td className="triage-table__last">
        {row.lastReading ? (
          <div className="triage-last">
            <div className="triage-last__ruler">
              <RangeRuler valueMgDl={row.lastReading.valueMgDl} thresholds={row.metrics.profile.thresholds} size="compact" showTarget={false} />
            </div>
            <span className="triage-table__time">
              {formatClock(row.lastReading.measuredAt, row.timezone)} · {formatElapsed(row.lastReading.measuredAt, now)}
            </span>
          </div>
        ) : (
          <span className="triage-table__time">{es.doctor.triage.noReading}</span>
        )}
      </td>
      <td className="triage-table__num measure">
        {row.openAlertsCount > 0 ? <Badge tone="critical">{String(row.openAlertsCount)}</Badge> : '0'}
      </td>
      <td>
        {row.pendingRecommendationsCount > 0 ? (
          <span className="triage-table__ai">{format(es.doctor.triage.aiCount, { count: row.pendingRecommendationsCount })}</span>
        ) : (
          <span className="triage-table__time">{es.doctor.triage.aiNone}</span>
        )}
      </td>
      <td>
        {row.reviewedAt ? (
          <span className="triage-table__time">{format(es.doctor.triage.reviewedAt, { time: formatElapsed(row.reviewedAt, now) })}</span>
        ) : (
          <Badge tone="warning">{es.doctor.triage.unreviewed}</Badge>
        )}
      </td>
    </tr>
  );
}
