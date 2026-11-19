import { useId, useState, type SyntheticEvent } from 'react';
import { es } from '@/i18n/es';
import { Button } from '@/ui/Button';
import { FieldShell } from '@/ui/FieldShell';
import { useToast } from '@/ui/useToast';
import { apiErrorMessage } from '@/services/api/ApiError';
import { useFormSchemas } from '@/state/useFormSchemas';
import type { AlertViewModel } from '@/services/adapters/AlertViewModelAdapter';
import { useAlertActions } from './queries';
import './AlertActions.css';

export interface AlertActionsProps {
  readonly alert: Pick<AlertViewModel, 'id' | 'status'>;
  /** Called after a successful resolve, when the alert leaves the list (focus can move to the list). */
  readonly onResolved?: () => void;
}

/**
 * Acknowledge (open alerts) and resolve (acknowledged alerts only, as the API requires). Resolving
 * needs a note; it opens as an inline disclosure under the row, not a modal. The note is validated
 * with the limits the API publishes.
 */
export function AlertActions({ alert, onResolved }: AlertActionsProps) {
  const toast = useToast();
  const { acknowledge, resolve } = useAlertActions();
  const { schemas } = useFormSchemas();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const ids = { panel: useId(), field: useId(), hint: useId(), error: useId() };

  const canAcknowledge = alert.status === 'OPEN' || alert.status === 'ESCALATED';
  const canResolve = alert.status === 'ACKNOWLEDGED';

  const acknowledgeAlert = () => {
    acknowledge.mutate(alert.id, {
      onSuccess: () => {
        toast.show(es.doctor.rail.acknowledged, 'success');
      },
      onError: (failure) => {
        toast.show(apiErrorMessage(failure), 'critical');
      },
    });
  };

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
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
          toast.show(es.doctor.rail.resolved, 'success');
          onResolved?.();
        },
        onError: (failure) => {
          toast.show(apiErrorMessage(failure), 'critical');
        },
      },
    );
  };

  return (
    <div className="alert-actions">
      <div className="alert-actions__buttons">
        {canAcknowledge ? (
          <Button size="sm" variant="secondary" loading={acknowledge.isPending} onClick={acknowledgeAlert}>
            {es.doctor.rail.acknowledge}
          </Button>
        ) : null}
        {canResolve ? (
          <Button
            size="sm"
            variant="secondary"
            aria-expanded={open}
            aria-controls={ids.panel}
            onClick={() => {
              setOpen((value) => !value);
            }}
          >
            {es.doctor.rail.resolve}
          </Button>
        ) : null}
      </div>
      {canResolve && open ? (
        <form id={ids.panel} className="alert-actions__form" noValidate onSubmit={submit}>
          <FieldShell
            id={ids.field}
            label={es.doctor.rail.noteLabel}
            hint={es.doctor.rail.noteHint}
            error={error}
            size="md"
            hintId={ids.hint}
            errorId={ids.error}
          >
            <textarea
              id={ids.field}
              name="resolution-note"
              className="alert-actions__note"
              rows={3}
              value={note}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${ids.hint} ${ids.error}` : ids.hint}
              onChange={(event) => {
                setNote(event.target.value);
              }}
            />
          </FieldShell>
          <div className="alert-actions__buttons">
            <Button type="submit" size="sm" loading={resolve.isPending}>
              {es.doctor.rail.resolveSubmit}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setError(undefined);
              }}
            >
              {es.doctor.rail.cancel}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
