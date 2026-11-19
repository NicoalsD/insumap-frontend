import { useState } from 'react';
import { Link } from 'react-router';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { Badge } from '@/ui/Badge';
import { EmptyState, ErrorState, LoadingState } from '@/ui/States';
import type { AlertViewModel } from '@/services/adapters/AlertViewModelAdapter';
import { AlertActions } from './AlertActions';
import { formatElapsed, priorityLabel } from './formatting';
import { useOpenAlerts } from './queries';
import { compareAlertsForRail } from './triageModel';
import './OpenAlertsRail.css';

/** Alerts shown in the strip before "Mostrar más". */
export const ALERTS_PAGE_SIZE = 6;

export interface OpenAlertsRailProps {
  /** Patient names from the queue, for alerts that do not carry `patient_name`. */
  readonly patientNames: ReadonlyMap<string, string>;
  readonly now: Date;
}

/**
 * Open alerts across the doctor's patients, as a compact strip above the queue: most urgent first
 * (priority, then the longest open). Each card has the patient, the type and level, how long it has
 * been open, and the next action.
 */
export function OpenAlertsRail({ patientNames, now }: OpenAlertsRailProps) {
  const query = useOpenAlerts();
  const [shown, setShown] = useState(ALERTS_PAGE_SIZE);

  if (query.isPending) return <LoadingState label={es.doctor.triage.updating} />;
  if (query.isError) {
    return <ErrorState error={query.error} title={es.doctor.rail.title} onRetry={() => void query.refetch()} />;
  }

  const alerts = [...query.data].sort(compareAlertsForRail);
  const visible = alerts.slice(0, shown);
  const remaining = alerts.length - visible.length;

  return (
    <section className="alerts-strip panel" aria-labelledby="open-alerts-title">
      <header className="panel__header">
        <h2 id="open-alerts-title">{es.doctor.rail.title}</h2>
        <Badge tone="neutral">{String(alerts.length)}</Badge>
      </header>
      {alerts.length === 0 ? (
        <EmptyState title={es.doctor.rail.empty} body={es.doctor.rail.emptyBody} />
      ) : (
        <>
          <ul className="alerts-strip__list">
            {visible.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                patientName={alert.patientName ?? patientNames.get(alert.patientId) ?? es.doctor.rail.unknownPatient}
                now={now}
              />
            ))}
          </ul>
          {remaining > 0 ? (
            <div className="alerts-strip__footer">
              <button
                type="button"
                className="alerts-strip__more"
                onClick={() => {
                  setShown(shown + ALERTS_PAGE_SIZE);
                }}
              >
                {format(es.doctor.rail.showMore, { count: Math.min(remaining, ALERTS_PAGE_SIZE) })}
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

interface AlertCardProps {
  readonly alert: AlertViewModel;
  readonly patientName: string;
  readonly now: Date;
}

/** One alert: name, type and level, time open, and the action. Each fact is stated once. */
export function AlertCard({ alert, patientName, now }: AlertCardProps) {
  const level = alert.level === null ? null : format(es.doctor.alerts.level, { level: alert.level });
  const meta = [es.doctor.alertType[alert.type], level, formatElapsed(alert.openedAt, now)].filter(Boolean).join(' · ');
  return (
    <li className="alert-card" data-status={alert.status}>
      <div className="alert-card__head">
        <Link to={`/doctor/patients/${alert.patientId}`} className="alert-card__patient" title={patientName}>
          {patientName}
        </Link>
        <Badge tone={alert.priority === 'HIGH' ? 'critical' : 'warning'}>{priorityLabel(alert.priority)}</Badge>
      </div>
      <p className="alert-card__meta">{meta}</p>
      {alert.status === 'ACKNOWLEDGED' ? <p className="alert-card__status">{es.doctor.alertStatus.ACKNOWLEDGED}</p> : null}
      <AlertActions alert={alert} />
    </li>
  );
}
