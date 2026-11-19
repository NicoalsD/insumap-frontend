import { useMemo, useState, type SyntheticEvent } from 'react';
import { TriangleAlert } from 'lucide-react';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { apiErrorMessage } from '@/services/api/ApiError';
import type { MessageDto } from '@/services/dto/care';
import type { FieldLimitsDto } from '@/services/dto/meta';
import { Button, EmptyState, ErrorState, LoadingState } from '@/ui';
import { clockTime } from '../patientFormat';
import './Messages.css';
import { useMessageThread, useSendMessage } from '../patientQueries';

/** Message limit the API publishes; no literal in the client. */
const MESSAGE_MAX_KEY = 'message_max_length';

/**
 * Thread with the care team, oldest first on screen (the API sends newest first). Messages are
 * plain text: React escapes them, nothing is rendered as HTML.
 *
 * Pattern: none.
 */
export function MessageThread({ limits, timeZone }: { readonly limits: FieldLimitsDto; readonly timeZone: string }) {
  const thread = useMessageThread();
  const send = useSendMessage();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const max = limits[MESSAGE_MAX_KEY];

  const messages = useMemo<MessageDto[]>(
    () => (thread.data?.pages ?? []).flatMap((page) => page.items).reverse(),
    [thread.data],
  );

  const onSubmit = (event: SyntheticEvent) => {
    event.preventDefault();
    setSent(false);
    const text = draft.trim();
    if (text === '') {
      setError(es.patient.messages.required);
      return;
    }
    if (max !== undefined && text.length > max) {
      setError(format(es.patient.messages.tooLong, { max }));
      return;
    }
    setError(null);
    send.mutate(
      { body: text },
      {
        onSuccess: () => {
          setDraft('');
          setSent(true);
        },
        onError: (failure) => {
          setError(apiErrorMessage(failure));
        },
      },
    );
  };

  return (
    <div className="messages-layout">
      <aside className="messages-aside" aria-labelledby="messages-aside-title">
        <div className="messages-notice">
          <TriangleAlert className="messages-notice__icon" aria-hidden="true" size="1.25rem" />
          <h2 id="messages-aside-title" className="messages-notice__title">{es.patient.messages.asideTitle}</h2>
          <p className="messages-notice__text">{es.patient.messages.emergency}</p>
        </div>
      </aside>

      <section className="messages-main" aria-labelledby="thread-title">
      <h2 id="thread-title" className="visually-hidden">{es.patient.messages.title}</h2>
      {thread.isPending ? <LoadingState /> : null}
      {thread.isError ? (
        <ErrorState error={thread.error} onRetry={() => { void thread.refetch(); }} />
      ) : null}
      {thread.isSuccess && messages.length === 0 ? (
        <div className="messages-empty"><EmptyState title={es.patient.messages.empty} /></div>
      ) : null}

      {messages.length > 0 ? (
        <ul className="thread" aria-live="polite">
          {thread.hasNextPage ? (
            <li className="patient-page__more">
              <Button variant="secondary" size="lg" loading={thread.isFetchingNextPage} onClick={() => { void thread.fetchNextPage(); }}>
                {es.patient.messages.loadMore}
              </Button>
            </li>
          ) : null}
          {messages.map((message) => (
            <li key={message.id} className="thread__bubble" data-sender={message.sender_role}>
              <span className="thread__meta">
                {message.sender_role === 'PATIENT' ? es.patient.messages.fromYou : es.patient.messages.fromTeam}
                {' · '}
                {format(es.patient.messages.sentAt, { time: clockTime(new Date(message.sent_at), timeZone) })}
              </span>
              <span>{message.body}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <form className="compose messages-compose" noValidate onSubmit={onSubmit}>
        <label htmlFor="compose-body" className="patient-layer__title">{es.patient.messages.label}</label>
        <textarea
          id="compose-body"
          name="body"
          value={draft}
          aria-invalid={error ? true : undefined}
          aria-describedby="compose-counter compose-error"
          onChange={(event) => { setDraft(event.target.value); }}
        />
        <div className="messages-compose__bar">
          <div className="messages-compose__status">
            <p id="compose-counter" className="compose__counter">
              {max === undefined ? null : format(es.patient.messages.counter, { count: draft.trim().length, max })}
            </p>
            {error ? <p id="compose-error" role="alert" className="compose__error">{error}</p> : null}
            {sent ? <p role="status">{es.patient.messages.sent}</p> : null}
          </div>
          <Button type="submit" size="lg" className="messages-compose__send" loading={send.isPending}>
            {send.isPending ? es.patient.messages.sending : es.patient.messages.send}
          </Button>
        </div>
      </form>
      </section>
    </div>
  );
}
