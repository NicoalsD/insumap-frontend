import { useMemo, type ReactNode } from 'react';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/ui/States';
import { useSession } from '@/state/useSession';
import { OpenAlertsRail } from './triage/OpenAlertsRail';
import { PatientPreview } from './triage/PatientPreview';
import { formatClock } from './triage/formatting';
import { useTriageRows } from './triage/queries';
import { TriageMap } from './triage/map/TriageMap';
import { ClinicalAssistant } from './dashboard/ClinicalAssistant';
import { DoctorHero } from './dashboard/DoctorHero';
import { PriorityCarousel } from './dashboard/PriorityCarousel';
import { RiskCard } from './dashboard/RiskCard';
import './dashboard/dashboard.css';
import { TriageQueue } from './triage/TriageQueue';
import { TriageToolbar } from './triage/TriageToolbar';
import { buildTriageLayout, permissionSet, TRIAGE_WIDGET } from './triage/triageLayout';
import { WidgetTree } from './triage/WidgetTree';
import { countSegments, filterRows, sortRows, type TriageItem } from './triage/triageModel';
import { TRIAGE_WINDOWS, useTriageFilters } from './triage/useTriageFilters';
import './triage/TriagePage.css';
import { WindowSlider } from './WindowSlider';

/** Cards shown in the priority carousel: the queue's top rows by risk. */
const PRIORITY_CARDS = 8;

/**
 * The doctor's panel: greeting with the counts that filter, risk spread, priority patients, the
 * clinical assistant, the 3D map with the preview, the queue and the open alerts. Filters, sort and
 * window live in the URL.
 */
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
    [TRIAGE_WIDGET.map]: (
      <section className="panel" aria-labelledby="triage-map-title">
        <header className="panel__header">
          <div>
            <h2 id="triage-map-title">{es.doctor.triage.map.title}</h2>
            <p className="panel__lead">{es.doctor.triage.map.description}</p>
          </div>
        </header>
        <div className="panel__body">
          {rowsQuery.isSuccess && visible.length > 0 ? (
            <TriageMap rows={visible} selectedId={selected?.patientId ?? null} onSelect={filters.selectPatient} />
          ) : (
            <p className="panel__lead">{es.doctor.triage.map.waiting}</p>
          )}
        </div>
      </section>
    ),
    [TRIAGE_WIDGET.queue]: (
      <section className="panel triage-panel" aria-labelledby="triage-queue-title">
        <header className="panel__header">
          <h2 id="triage-queue-title">{es.doctor.triage.queueTitle}</h2>
          {rowsQuery.isSuccess ? <Badge tone="neutral">{String(rows.length)}</Badge> : null}
        </header>
        {rowsQuery.isSuccess && rows.length > 0 ? (
          <TriageToolbar
            search={filters.search}
            segments={filters.segments}
            counts={counts}
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

  const priority = sortRows(rows, 'risk', 'descending').slice(0, PRIORITY_CARDS);
  const pendingSuggestions = rows.reduce((total, row) => total + row.pendingRecommendationsCount, 0);
  const windowDays = Number.parseInt(filters.window, 10);

  return (
    <div className="page doctor-dashboard">
      <div className="dashboard-top">
        <p className="dashboard-top__meta">{description}</p>
        <WindowSlider
          className="dashboard-top__window"
          label={es.doctor.triage.windowLabel}
          value={filters.window}
          options={TRIAGE_WINDOWS}
          onChange={filters.setWindow}
        />
      </div>
      <div className="grid-12 doctor-dashboard__row">
        <div style={{ '--span': 8, '--span-md': 8 } as React.CSSProperties}>
          <DoctorHero
            name={session.fullName}
            now={now}
            windowDays={windowDays}
            counts={counts}
            active={filters.segments}
            onToggle={filters.toggleSegment}
          />
        </div>
        <div style={{ '--span': 4, '--span-md': 8 } as React.CSSProperties}>
          <RiskCard rows={rows} />
        </div>
      </div>
      {rows.length > 0 ? (
        <div className="grid-12 doctor-dashboard__row doctor-dashboard__row--start">
          <div style={{ '--span': 7, '--span-md': 8 } as React.CSSProperties}>
            <PriorityCarousel rows={priority} selectedId={selected?.patientId ?? null} onSelect={filters.selectPatient} />
          </div>
          <div style={{ '--span': 5, '--span-md': 8 } as React.CSSProperties}>
            <ClinicalAssistant rows={priority} pendingSuggestions={pendingSuggestions} />
          </div>
        </div>
      ) : null}
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
