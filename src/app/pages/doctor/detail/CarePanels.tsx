import { useId, useState, type SyntheticEvent } from 'react';
import type { ActivePlan } from './types';
import { planInsulinItems } from './model/planItems';
import { describeAllowedSites } from './model/planSites';
import type { ClinicalNoteDto, MessageDto } from '@/services/dto/care';
import { apiErrorMessage } from '@/services/api/ApiError';
import { useFormSchemas } from '@/state/useFormSchemas';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { Button } from '@/ui/Button';
import { FieldShell } from '@/ui/FieldShell';
import { useToast } from '@/ui/useToast';
import { NOTE_FIELD_ID } from './constants';
import { formatDateTime } from './format';
import { useClinicalNoteWrite, useMessageWrite } from './queries';
import './CarePanels.css';

/**
 * Active plan of the patient, in plain language, and for each insulin item the sites the doctor
 * allows. The AI never adds a dose here. The note says the patient sees a site suggestion within
 * that restriction; when the plan carries no items the panel says so instead of inventing them.
 *
 * Pattern: none (presentation over `planInsulinItems` and `describeAllowedSites`).
 */
export function PlanPanel({ plan }: { readonly plan: ActivePlan | null }) {
  const items = planInsulinItems(plan);
  return (
    <section className="panel" aria-labelledby="plan-title">
      <header className="panel__header">
        <h2 id="plan-title">{es.detail.plan.title}</h2>
      </header>
      <div className="panel__body care-panel">
        {plan ? (
          <>
            {plan.name === '' ? null : <p className="care-panel__name">{plan.name}</p>}
            <p className="care-panel__meta">{format(es.detail.plan.version, { version: plan.version })}</p>
            <p>{plan.summary}</p>
            {items.length > 0 ? (
              <div>
                <h3 className="care-panel__subtitle">{es.detail.plan.insulinItems}</h3>
                <ul className="care-panel__items">
                  {items.map((item) => (
                    <li key={`${item.time_of_day}-${item.label}`}>
                      <span className="care-panel__meta">
                        {item.time_of_day} · {es.detail.injection.kind[item.insulin_kind ?? 'BASAL']}
                      </span>
                      <span className="care-panel__text">{item.label}</span>
                      <span className="care-panel__text">
                        <strong>{es.detail.plan.sitesLabel}: </strong>
                        {describeAllowedSites(item.injection_sites, {
                          noRestriction: es.detail.injection.noRestriction,
                          noneAllowed: es.detail.injection.noneAllowed,
                          region: es.detail.injection.region,
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="care-panel__meta">{es.detail.plan.sitesNote}</p>
              </div>
            ) : (
              <p className="care-panel__meta">{es.detail.plan.sitesMissing}</p>
            )}
          </>
        ) : (
          <p>{es.detail.plan.empty}</p>
        )}
      </div>
    </section>
  );
}

/** Clinical notes, newest first, and a form for a new one. Notes are append-only (API.md 8.11). */
export function NotesPanel({
  patientId,
  notes,
  canWrite,
  timeZone,
}: {
  readonly patientId: string;
  readonly notes: readonly ClinicalNoteDto[];
  readonly canWrite: boolean;
  readonly timeZone: string;
}) {
  const toast = useToast();
  const { schemas } = useFormSchemas();
  const write = useClinicalNoteWrite(patientId);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const ids = { hint: useId(), error: useId() };

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = schemas.note.min(1, es.validation.required).safeParse(body);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? es.validation.invalid);
      return;
    }
    setError(undefined);
    write.mutate(parsed.data, {
      onSuccess: () => {
        toast.show(es.detail.notes.saved, 'success');
        setBody('');
      },
      onError: (failure) => {
        toast.show(apiErrorMessage(failure), 'critical');
      },
    });
  };

  return (
    <section className="panel" aria-labelledby="notes-title">
      <header className="panel__header">
        <h2 id="notes-title">{es.detail.notes.title}</h2>
      </header>
      <div className="panel__body care-panel">
        {notes.length === 0 ? <p className="care-panel__empty">{es.detail.notes.empty}</p> : null}
        {notes.length > 0 ? (
          <ol className="care-panel__list" aria-label={es.detail.notes.title}>
            {notes.map((note) => (
              <li key={note.id}>
                <p className="care-panel__meta">
                  {format(es.detail.notes.byAuthor, {
                    author: note.author_name,
                    time: formatDateTime(new Date(note.created_at), timeZone),
                  })}
                </p>
                <p className="care-panel__text">{note.body}</p>
              </li>
            ))}
          </ol>
        ) : null}
        {canWrite ? (
          <form className="care-panel__form" noValidate onSubmit={submit}>
            <FieldShell
              id={NOTE_FIELD_ID}
              label={es.detail.notes.label}
              hint={es.detail.notes.hint}
              error={error}
              size="md"
              hintId={ids.hint}
              errorId={ids.error}
            >
              <textarea
                id={NOTE_FIELD_ID}
                name="clinical-note"
                rows={3}
                value={body}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? `${ids.hint} ${ids.error}` : ids.hint}
                onChange={(event) => {
                  setBody(event.target.value);
                }}
              />
            </FieldShell>
            <Button type="submit" size="sm" loading={write.isPending}>
              {es.detail.notes.submit}
            </Button>
          </form>
        ) : null}
      </div>
    </section>
  );
}

/** Patient-doctor thread, oldest first so the latest message sits next to the form. */
export function MessagesPanel({
  patientId,
  messages,
  emergencyNotice,
  timeZone,
}: {
  readonly patientId: string;
  readonly messages: readonly MessageDto[];
  readonly emergencyNotice: string | undefined;
  readonly timeZone: string;
}) {
  const toast = useToast();
  const { schemas } = useFormSchemas();
  const write = useMessageWrite(patientId);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const ids = { hint: useId(), error: useId(), field: useId() };
  const thread = [...messages].reverse();

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = schemas.note.min(1, es.validation.required).safeParse(body);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? es.validation.invalid);
      return;
    }
    setError(undefined);
    write.mutate(parsed.data, {
      onSuccess: () => {
        toast.show(es.detail.messages.sent, 'success');
        setBody('');
      },
      onError: (failure) => {
        toast.show(apiErrorMessage(failure), 'critical');
      },
    });
  };

  return (
    <section className="panel" aria-labelledby="messages-title">
      <header className="panel__header">
        <h2 id="messages-title">{es.detail.messages.title}</h2>
      </header>
      <div className="panel__body care-panel">
        {emergencyNotice ? <p className="care-panel__notice">{emergencyNotice}</p> : null}
        {thread.length === 0 ? <p className="care-panel__empty">{es.detail.messages.empty}</p> : null}
        {thread.length > 0 ? (
          <ol className="care-panel__list" aria-label={es.detail.messages.title}>
            {thread.map((message) => (
              <li key={message.id} data-sender={message.sender_role}>
                <p className="care-panel__meta">
                  {format(es.detail.messages.sentAt, {
                    sender:
                      message.sender_role === 'DOCTOR' ? es.detail.messages.senderDoctor : es.detail.messages.senderPatient,
                    time: formatDateTime(new Date(message.sent_at), timeZone),
                  })}
                </p>
                <p className="care-panel__text">{message.body}</p>
              </li>
            ))}
          </ol>
        ) : null}
        <form className="care-panel__form" noValidate onSubmit={submit}>
          <FieldShell
            id={ids.field}
            label={es.detail.messages.label}
            hint={es.detail.messages.hint}
            error={error}
            size="md"
            hintId={ids.hint}
            errorId={ids.error}
          >
            <textarea
              id={ids.field}
              name="message"
              rows={3}
              value={body}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${ids.hint} ${ids.error}` : ids.hint}
              onChange={(event) => {
                setBody(event.target.value);
              }}
            />
          </FieldShell>
          <Button type="submit" size="sm" loading={write.isPending}>
            {es.detail.messages.submit}
          </Button>
        </form>
      </div>
    </section>
  );
}
