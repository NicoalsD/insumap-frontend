import { useId, useState, type SyntheticEvent } from 'react';
import type { AlertDto } from '@/services/dto/clinical';
import { AlertViewModelAdapter, type AlertViewModel } from '@/services/adapters/AlertViewModelAdapter';
import { apiErrorMessage } from '@/services/api/ApiError';
import { useFormSchemas } from '@/state/useFormSchemas';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { FieldShell } from '@/ui/FieldShell';
import { EmptyState } from '@/ui/States';
import { useToast } from '@/ui/useToast';
import { formatDateTime } from './format';
import { useAlertActions } from './queries';

export interface OpenAlertsPanelProps {
  /** Alerts of the patient that are not resolved, as the API sends them. */
  readonly alerts: readonly AlertDto[];
  readonly patientId: string;
  readonly canAcknowledge: boolean;
  readonly canResolve: boolean;
  readonly timeZone: string;
}

const adapter = new AlertViewModelAdapter();

/**
 * Open alerts of this patient. An open alert can be acknowledged; an acknowledged one can be
 * resolved, and resolving needs a note (the API rejects an empty one).
 *
 * Pattern: none (presentation over `useAlertActions`; the adapter is P06).
 */
export function OpenAlertsPanel({ alerts, patientId, canAcknowledge, canResolve, timeZone }: OpenAlertsPanelProps) {
  const views = alerts.map((dto) => adapter.adapt(dto)).filter((alert) => alert.needsAttention || alert.status === 'ACKNOWLEDGED');
  return (
    <section className="panel" aria-labelledby="alerts-title">
      <header className="panel__header">
        <h2 id="alerts-title">{es.detail.alerts.title}</h2>
        <Badge tone="neutral">{String(views.length)}</Badge>
      </header>
      <div className="panel__body">
        {views.length === 0 ? <EmptyState title={es.detail.alerts.empty} /> : null}
        {views.length > 0 ? (
          <ul className="open-alerts__list">
            {views.map((alert) => (
              <AlertRow
                key={alert.id}
                alert={alert}
                patientId={patientId}
                canAcknowledge={canAcknowledge}
                canResolve={canResolve}
                timeZone={timeZone}
              />
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

function AlertRow({
  alert,
  patientId,
  canAcknowledge,
  canResolve,
  timeZone,
}: {
  readonly alert: AlertViewModel;
  readonly patientId: string;
  readonly canAcknowledge: boolean;
  readonly canResolve: boolean;
  readonly timeZone: string;
}) {
  const toast = useToast();
  const { schemas } = useFormSchemas();
  const { acknowledge, resolve } = useAlertActions(patientId);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const noteId = useId();
  const priority = (es.doctor.priority as Readonly<Record<string, string | undefined>>)[alert.priority] ?? alert.priority;
  const showAcknowledge = canAcknowledge && (alert.status === 'OPEN' || alert.status === 'ESCALATED');
  const showResolve = canResolve && alert.status === 'ACKNOWLEDGED';

  const submitResolve = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = schemas.note.min(1, es.validation.required).safeParse(note);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? es.validation.invalid);
      return;
    }
    setError(undefined);
    resolve.mutate(
      { alertId: alert.id, note: parsed.data },
      {
        onSuccess: () => {
          toast.show(es.detail.alerts.resolved, 'success');
          setNoteOpen(false);
          setNote('');
        },
        onError: (failure) => {
          toast.show(apiErrorMessage(failure), 'critical');
        },
      },
    );
  };

  return (
    <li className="open-alerts__item">
      <div className="open-alerts__head">
        <strong>{es.doctor.alertType[alert.type]}</strong>
        <Badge tone={alert.priority === 'HIGH' ? 'critical' : 'neutral'}>{priority}</Badge>
        <Badge tone="neutral">{es.detail.alerts.status[alert.status]}</Badge>
      </div>
      <p className="open-alerts__time">{format(es.detail.alerts.openedAt, { time: formatDateTime(alert.openedAt, timeZone) })}</p>
      <div className="open-alerts__actions">
        {showAcknowledge ? (
          <Button
            size="sm"
            variant="secondary"
            loading={acknowledge.isPending}
            onClick={() => {
              acknowledge.mutate(alert.id, {
                onSuccess: () => {
                  toast.show(es.detail.alerts.acknowledged, 'success');
                },
                onError: (failure) => {
                  toast.show(apiErrorMessage(failure), 'critical');
                },
              });
            }}
          >
            {es.detail.alerts.acknowledge}
          </Button>
        ) : null}
        {showResolve ? (
          <Button
            size="sm"
            variant="secondary"
            aria-expanded={noteOpen}
            aria-controls={noteOpen ? noteId : undefined}
            onClick={() => {
              setNoteOpen((value) => !value);
            }}
          >
            {es.detail.alerts.resolve}
          </Button>
        ) : null}
      </div>
      {showResolve && noteOpen ? (
        <form id={noteId} className="open-alerts__form" noValidate onSubmit={submitResolve}>
          <FieldShell
            id={`${noteId}-field`}
            label={es.detail.alerts.noteLabel}
            hint={es.detail.alerts.noteHint}
            error={error}
            size="md"
            hintId={`${noteId}-hint`}
            errorId={`${noteId}-error`}
          >
            <textarea
              id={`${noteId}-field`}
              name="resolution-note"
              rows={3}
              value={note}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${noteId}-hint ${noteId}-error` : `${noteId}-hint`}
              onChange={(event) => {
                setNote(event.target.value);
              }}
            />
          </FieldShell>
          <div className="open-alerts__actions">
            <Button type="submit" size="sm" loading={resolve.isPending}>
              {es.detail.alerts.resolveSubmit}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setNoteOpen(false);
              }}
            >
              {es.detail.alerts.cancel}
            </Button>
          </div>
        </form>
      ) : null}
    </li>
  );
}
