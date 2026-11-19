import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { MetricsWindow } from '@/services/dto/common';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { ALERT_STATUSES, ALERT_TYPES } from '@/services/dto/clinical';
import type { AlertViewModel } from '@/services/adapters/AlertViewModelAdapter';
import { Badge } from '@/ui/Badge';
import { EmptyState, ErrorState, LoadingState } from '@/ui/States';
import { PageHeader } from '@/ui/PageHeader';
import { Select } from '@/ui/Select';
import { useTriageRows, useAlertList } from './triage/queries';
import { AlertActions } from './triage/AlertActions';
import { formatDateTime, formatElapsed, priorityLabel } from './triage/formatting';
import { compareAlertsForRail, priorityRank } from './triage/triageModel';
import { QUEUE_PAGE_SIZE } from './triage/TriageQueue';
import './triage/AlertsPage.css';

const ANY = '';
/** Window used only to read patient names for the alert rows; names do not depend on the window. */
const NAMES_WINDOW: MetricsWindow = '14d';

/**
 * Every alert of the doctor's patients, with filters by status, type and priority. The status and
 * type go to the API; priority has no API parameter, so it filters the loaded list. Each row has
 * the actions of the rail and a link to the patient.
 */
export function AlertsPage() {
  const [status, setStatus] = useState<string>(ANY);
  const [type, setType] = useState<string>(ANY);
  const [priority, setPriority] = useState<string>(ANY);
  const [shownCount, setShownCount] = useState({ key: '', count: QUEUE_PAGE_SIZE });

  const statusFilter = ALERT_STATUSES.find((item) => item === status);
  const typeFilter = ALERT_TYPES.find((item) => item === type);
  const alertsQuery = useAlertList({ status: statusFilter, type: typeFilter });
  const namesQuery = useTriageRows(NAMES_WINDOW);
  const timezone = namesQuery.data?.[0]?.timezone;
  const names = useMemo(
    () => new Map((namesQuery.data ?? []).map((row) => [row.patientId, row.fullName])),
    [namesQuery.data],
  );

  const all = useMemo(() => alertsQuery.data ?? [], [alertsQuery.data]);
  const priorities = useMemo(() => [...new Set(all.map((alert) => alert.priority))].sort(
    (a, b) => priorityRank(a) - priorityRank(b),
  ), [all]);
  const filtered = useMemo(
    () =>
      all
        .filter((alert) => priority === ANY || alert.priority === priority)
        .sort(compareAlertsForRail),
    [all, priority],
  );

  const filterKey = [status, type, priority].join('|');
  const count = shownCount.key === filterKey ? shownCount.count : QUEUE_PAGE_SIZE;
  const shown = filtered.slice(0, count);
  const now = useMemo(() => new Date(alertsQuery.dataUpdatedAt), [alertsQuery.dataUpdatedAt]);

  const statusOptions = [{ value: ANY, label: es.doctor.alerts.anyOption }, ...ALERT_STATUSES.map((item) => ({ value: item, label: es.doctor.alertStatus[item] }))];
  const typeOptions = [{ value: ANY, label: es.doctor.alerts.anyOption }, ...ALERT_TYPES.map((item) => ({ value: item, label: es.doctor.alertType[item] }))];
  const priorityOptions = [
    { value: ANY, label: es.doctor.alerts.anyOption },
    ...priorities.map((code) => ({ value: code, label: priorityLabel(code) })),
  ];

  return (
    <div className="page">
      <PageHeader title={es.nav.alerts} description={es.doctor.alerts.description} />
      <section className="panel" aria-labelledby="alerts-list-title">
        <header className="panel__header">
          <h2 id="alerts-list-title">{es.nav.alerts}</h2>
        </header>
        <div className="alerts-filters">
          <Select label={es.doctor.alerts.filterStatus} value={status} options={statusOptions} onChange={(event) => { setStatus(event.target.value); }} />
          <Select label={es.doctor.alerts.filterType} value={type} options={typeOptions} onChange={(event) => { setType(event.target.value); }} />
          <Select label={es.doctor.alerts.filterPriority} value={priority} options={priorityOptions} onChange={(event) => { setPriority(event.target.value); }} />
        </div>
        {alertsQuery.isPending ? (
          <LoadingState />
        ) : alertsQuery.isError ? (
          <ErrorState error={alertsQuery.error} title={es.doctor.alerts.errorTitle} onRetry={() => void alertsQuery.refetch()} />
        ) : filtered.length === 0 ? (
          <EmptyState title={es.doctor.alerts.empty} body={es.doctor.alerts.emptyBody} />
        ) : (
          <div className="alerts-table__scroll" role="region" aria-labelledby="alerts-caption" tabIndex={0}>
            <table className="alerts-table">
              <caption id="alerts-caption" className="visually-hidden">
                {es.doctor.alerts.caption}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{es.doctor.alerts.columns.patient}</th>
                  <th scope="col">{es.doctor.alerts.columns.type}</th>
                  <th scope="col">{es.doctor.alerts.columns.priority}</th>
                  <th scope="col">{es.doctor.alerts.columns.status}</th>
                  <th scope="col">{es.doctor.alerts.columns.opened}</th>
                  <th scope="col">{es.doctor.alerts.columns.actions}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((alert) => (
                  <AlertRowFull key={alert.id} alert={alert} name={alert.patientName ?? names.get(alert.patientId) ?? es.doctor.rail.unknownPatient} now={now} timezone={timezone} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > 0 ? (
          <div className="alerts-footer">
            <p className="alerts-footer__count" role="status">
              {format(es.doctor.alerts.showing, { shown: shown.length, total: filtered.length })}
            </p>
            {filtered.length > shown.length ? (
              <button
                type="button"
                className="alerts-footer__more"
                onClick={() => {
                  setShownCount({ key: filterKey, count: count + QUEUE_PAGE_SIZE });
                }}
              >
                {format(es.doctor.alerts.showMore, { count: Math.min(QUEUE_PAGE_SIZE, filtered.length - shown.length) })}
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function AlertRowFull({ alert, name, now, timezone }: { readonly alert: AlertViewModel; readonly name: string; readonly now: Date; readonly timezone: string | undefined }) {
  const priority = priorityLabel(alert.priority);
  return (
    <tr>
      <td>
        <Link to={`/doctor/patients/${alert.patientId}`} className="alerts-table__patient">
          {name}
        </Link>
      </td>
      <td>
        {es.doctor.alertType[alert.type]}
        {alert.level === null ? null : <span className="alerts-table__level"> · {format(es.doctor.alerts.level, { level: alert.level })}</span>}
        {alert.isFallback ? <Badge tone="neutral">{es.notices.aiFallback}</Badge> : null}
      </td>
      <td>{priority}</td>
      <td>{es.doctor.alertStatus[alert.status]}</td>
      <td>
        <span className="alerts-table__time">{formatDateTime(alert.openedAt, timezone)}</span>
        <span className="alerts-table__time"> · {formatElapsed(alert.openedAt, now)}</span>
      </td>
      <td>
        <AlertActions alert={alert} />
      </td>
    </tr>
  );
}
