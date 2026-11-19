import { useMemo, useState, type SyntheticEvent } from 'react';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { classifyGlucose, type GlucoseThresholds } from '@/core/glucose/thresholds';
import type { GlucoseReadingDto } from '@/services/dto/clinical';
import { Button, EmptyState, ErrorState, LoadingState } from '@/ui';
import { clockTime } from '../patientFormat';
import { dayRange, groupByDay } from './readingsModel';
import { useOwnReadings, type ReadingFilter } from '../patientQueries';

export interface ReadingsListProps {
  readonly thresholds: GlucoseThresholds;
  readonly timeZone: string;
  readonly now: Date;
}

/** Full history of own readings, grouped by day, with a date-range filter and "load more". */
export function ReadingsList({ thresholds, timeZone, now }: ReadingsListProps) {
  const [draftFrom, setDraftFrom] = useState('');
  const [draftTo, setDraftTo] = useState('');
  const [filter, setFilter] = useState<ReadingFilter>({});
  const query = useOwnReadings(filter);

  const readings = useMemo(() => (query.data?.pages ?? []).flatMap((page) => page.items), [query.data]);
  const groups = useMemo(() => groupByDay(readings, timeZone, now), [readings, timeZone, now]);

  const onApply = (event: SyntheticEvent) => {
    event.preventDefault();
    setFilter(dayRange(draftFrom, draftTo));
  };

  const onClear = () => {
    setDraftFrom('');
    setDraftTo('');
    setFilter({});
  };

  return (
    <section className="patient-page__section" aria-labelledby="readings-filter-title">
      <h2 id="readings-filter-title" className="visually-hidden">{es.patient.readings.applyFilter}</h2>
      <form className="patient-page__filters" onSubmit={onApply}>
        <label>
          {es.patient.readings.filterFrom}
          <input type="date" name="from" value={draftFrom} onChange={(event) => { setDraftFrom(event.target.value); }} />
        </label>
        <label>
          {es.patient.readings.filterTo}
          <input type="date" name="to" value={draftTo} onChange={(event) => { setDraftTo(event.target.value); }} />
        </label>
        <div className="patient-page__actions">
          <Button type="submit" variant="secondary" size="lg">{es.patient.readings.applyFilter}</Button>
          <Button variant="ghost" size="lg" onClick={onClear}>{es.patient.readings.clearFilter}</Button>
        </div>
      </form>

      {query.isPending ? <LoadingState /> : null}
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => { void query.refetch(); }} />
      ) : null}
      {query.isSuccess && groups.length === 0 ? <EmptyState title={es.patient.readings.empty} /> : null}

      {groups.length > 0 ? (
        <ul className="patient-list">
          {groups.map((group) => (
            <li key={group.key} className="patient-list__day">
              <h2>{format(es.patient.readings.dayHeading, { date: group.label })}</h2>
              <ul className="patient-list__items">
                {group.items.map((reading) => (
                  <ReadingItem key={reading.id} reading={reading} thresholds={thresholds} timeZone={timeZone} />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : null}

      {query.hasNextPage ? (
        <div className="patient-page__more">
          <Button size="lg" variant="secondary" loading={query.isFetchingNextPage} onClick={() => { void query.fetchNextPage(); }}>
            {es.patient.readings.loadMore}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function ReadingItem({
  reading,
  thresholds,
  timeZone,
}: {
  readonly reading: GlucoseReadingDto;
  readonly thresholds: GlucoseThresholds;
  readonly timeZone: string;
}) {
  const state = classifyGlucose(reading.value_mg_dl, thresholds);
  const measured = new Date(reading.measured_at);
  const time = clockTime(measured, timeZone);
  const source = es.patient.readings.source[reading.source];
  const context = reading.context !== null && reading.context in es.patient.readings.context
    ? es.patient.readings.context[reading.context as keyof typeof es.patient.readings.context]
    : null;
  const status = es.patient.readings.status[reading.status];
  return (
    <li className="patient-list__item">
      <span className="patient-list__value">
        {reading.value_mg_dl} <span className="patient-list__meta">{es.glucose.unit}</span>
      </span>
      <span className="patient-list__state" data-state={state}>
        {es.glucose.ranges[state]}
      </span>
      <span className="patient-list__meta">
        {format(es.patient.readings.item, { time, source })}
        {context ? ` · ${context}` : ''}
        {' · '}
        {status}
      </span>
    </li>
  );
}
