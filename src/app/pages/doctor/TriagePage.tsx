import { useMemo, type ReactNode } from 'react';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/ui/States';
import { PageHeader } from '@/ui/PageHeader';
import { useSession } from '@/state/useSession';
import { OpenAlertsRail } from './triage/OpenAlertsRail';
import { PatientPreview } from './triage/PatientPreview';
import { formatClock } from './triage/formatting';
import { useTriageRows } from './triage/queries';
import { TriageQueue } from './triage/TriageQueue';
import { TriageToolbar } from './triage/TriageToolbar';
import { buildTriageLayout, permissionSet, TRIAGE_WIDGET } from './triage/triageLayout';
import { WidgetTree } from './triage/WidgetTree';
import { countSegments, filterRows, sortRows, type TriageItem } from './triage/triageModel';
import { useTriageFilters } from './triage/useTriageFilters';
import './triage/TriagePage.css';

/** Queue of the doctor's assigned patients, by risk. Filters, sort and window live in the URL. */
export function TriagePage() {
  const { state } = useSession();
  const session = state.status === 'authenticated' ? state.session : null;
  const filters = useTriageFilters();
  const rowsQuery = useTriageRows(filters.window);
  const rowsData = rowsQuery.data;
  const rows = useMemo<readonly TriageItem[]>(() => rowsData ?? [], [rowsData]);

  const counts = useMemo(() => countSegments(rows), [rows]);
  const visible = useMemo(
    () => sortRows(filterRows(rows, filters.search, filters.segments), filters.sort.column, filters.sort.direction),
    [rows, filters.search, filters.segments, filters.sort.column, filters.sort.direction],
  );
  const names = useMemo(() => new Map(rows.map((row) => [row.patientId, row.fullName])), [rows]);
  const selected = visible.find((row) => row.patientId === filters.selectedPatientId) ?? visible[0] ?? null;
  const updatedAt = rowsQuery.dataUpdatedAt;
  const now = useMemo(() => new Date(updatedAt), [updatedAt]);
  const layout = useMemo(
    () => (session ? buildTriageLayout().visibleFor(permissionSet((permission) => session.can(permission))) : null),
    [session],
  );
  const filterKey = [filters.window, filters.search, filters.segments.join(','), filters.sort.column, filters.sort.direction].join('|');

  if (!session || !layout) return null;

  const updateTime = rowsQuery.isSuccess
    ? formatClock(now, rows[0]?.timezone)
    : es.doctor.triage.updating;
  const description = session.clinic
    ? format(es.doctor.triage.clinicAndUpdate, { clinic: session.clinic.name, time: updateTime })
    : format(es.doctor.triage.updatedAt, { time: updateTime });

  const queueBody = rowsQuery.isPending ? (
    <LoadingState label={es.doctor.triage.updating} />
  ) : rowsQuery.isError ? (
    <ErrorState error={rowsQuery.error} title={es.doctor.triage.errorTitle} onRetry={() => void rowsQuery.refetch()} />
  ) : rows.length === 0 ? (
    <EmptyState title={es.doctor.triage.emptyTitle} body={es.doctor.triage.emptyBody} />
  ) : visible.length === 0 ? (
    <EmptyState
      title={es.doctor.triage.noMatchTitle}
      body={es.doctor.triage.noMatchBody}
      action={
        <Button variant="secondary" onClick={filters.clearFilters}>
          {es.doctor.triage.clearFilters}
        </Button>
      }
    />
  ) : (
    <TriageQueue
      rows={visible}
      selectedId={selected?.patientId ?? null}
      sort={filters.sort}
      now={now}
      filterKey={filterKey}
      onSort={(column, direction) => {
        filters.setSort(column, direction);
      }}
      onSelect={filters.selectPatient}
    />
  );

  const painters: Record<string, ReactNode> = {
    [TRIAGE_WIDGET.queue]: (
      <section className="panel triage-panel" aria-labelledby="triage-queue-title">
        <header className="panel__header">
          <h2 id="triage-queue-title">{es.doctor.triage.queueTitle}</h2>
          {rowsQuery.isSuccess ? <Badge tone="neutral">{String(rows.length)}</Badge> : null}
        </header>
        {rowsQuery.isSuccess && rows.length > 0 ? (
          <TriageToolbar
            window={filters.window}
            search={filters.search}
            segments={filters.segments}
            counts={counts}
            onWindow={filters.setWindow}
            onSearch={filters.setSearch}
            onToggleSegment={filters.toggleSegment}
            onClear={filters.clearFilters}
          />
        ) : null}
        <div className="triage-panel__body">{queueBody}</div>
      </section>
    ),
    [TRIAGE_WIDGET.openAlerts]: <OpenAlertsRail patientNames={names} now={now} />,
    [TRIAGE_WIDGET.preview]: (
      <section className="panel" aria-labelledby="triage-preview-heading">
        <header className="panel__header">
          <h2 id="triage-preview-heading">{es.doctor.triage.previewTitle}</h2>
        </header>
        <div className="panel__body">
          <PatientPreview item={selected} window={filters.window} now={now} />
        </div>
      </section>
    ),
  };

  return (
    <div className="page">
      <PageHeader title={es.nav.triage} description={description} />
      {rows.some((row) => row.isFallback) ? (
        <p className="triage-notice">
          <Badge tone="neutral">{es.notices.aiFallback}</Badge>
          <span>{es.doctor.triage.fallbackNotice}</span>
        </p>
      ) : null}
      <WidgetTree node={layout} painters={painters} />
    </div>
  );
}
