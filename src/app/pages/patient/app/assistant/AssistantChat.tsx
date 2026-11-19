import { Bot, ShieldCheck } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { Conversation, Message, PromptInput, Suggestion, Suggestions } from '@/ui/shadcn/ai-chat';
import type { FieldLimitsDto } from '@/services/dto/meta';
import { useApi } from '@/state/useApi';
import { checkQuestion, endsTalk, failureText, questionMax, replyTurn, type ChatTurn } from './assistantModel';
import './AssistantChat.css';

let turnCounter = 0;
const nextTurnId = (prefix: string) => {
  turnCounter += 1;
  return `${prefix}-${String(turnCounter)}`;
};

/**
 * Educational assistant of the patient (HU-42). Plain-text replies with citations, an escalation
 * banner for doctor and emergency signs (an emergency ends the talk), the fallback label, and a clear
 * message for a 429. Nothing is stored: leaving the page clears the conversation.
 *
 * Pattern: none (a chat over the AI Elements-equivalent components in `src/ui/shadcn`).
 */
export function AssistantChat({ limits }: { readonly limits: FieldLimitsDto }) {
  const { api } = useApi();
  const idBase = useId();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const cancelled = useRef(new Set<string>());
  const max = questionMax(limits);
  const count = draft.trim().length;

  const send = async (text: string) => {
    const problem = checkQuestion(text, limits);
    setError(problem);
    if (problem !== null || pendingId !== null || ended) return;
    const question = text.trim();
    const userId = nextTurnId('user');
    const requestId = nextTurnId('reply');
    setTurns((current) => [...current, { id: userId, from: 'user', text: question }]);
    setDraft('');
    setPendingId(requestId);
    try {
      const reply = await api.sendAssistantMessage({ message: question });
      if (cancelled.current.has(requestId)) return;
      setTurns((current) => [...current, replyTurn(requestId, reply)]);
      if (endsTalk(reply.escalation)) setEnded(true);
    } catch (failure) {
      if (!cancelled.current.has(requestId)) setError(failureText(failure));
    } finally {
      setPendingId(null);
    }
  };

  const stop = () => {
    if (pendingId !== null) cancelled.current.add(pendingId);
    setPendingId(null);
    setError(es.patient.assistant.stopped);
  };

  const emergency = turns.find((turn) => turn.escalation === 'EMERGENCY');
  const doctor = turns.some((turn) => turn.escalation === 'CONTACT_DOCTOR');
  const inputId = `${idBase}-question`;
  const errorId = `${idBase}-error`;

  return (
    <div className="assistant-chat">
      <p className="ai-notice-band">
        <ShieldCheck aria-hidden="true" size="1.25rem" />
        {es.patient.assistant.notice}
      </p>

      {emergency ? (
        <p role="alert" className="assistant-chat__emergency">{es.patient.assistant.escalationEmergency}</p>
      ) : null}
      {doctor && !emergency ? (
        <p role="status" className="assistant-chat__doctor">
          {es.patient.assistant.escalationDoctor}{' '}
          <Link to="/patient/messages" className="assistant-chat__link">{es.patient.assistant.openMessages}</Link>
        </p>
      ) : null}
      {ended ? <p className="assistant-chat__ended">{es.patient.assistant.ended}</p> : null}

      <Conversation label={es.patient.assistant.title} scrollLabel={es.patient.assistant.scrollEnd}>
        {turns.length === 0 ? (
          <div className="ai-empty">
            <span className="ai-empty__icon" aria-hidden="true">
              <Bot size="1.75rem" />
            </span>
            <h2 className="ai-empty__title">{es.patient.assistant.emptyTitle}</h2>
            <p className="ai-empty__text">{es.patient.assistant.empty}</p>
            <Suggestions label={es.patient.assistant.suggestionsLabel}>
              {es.patient.assistant.suggestions.map((suggestion) => (
                <Suggestion key={suggestion} suggestion={suggestion} disabled={ended} onSelect={(value) => { void send(value); }} />
              ))}
            </Suggestions>
          </div>
        ) : null}
        {turns.map((turn) => (
          <div key={turn.id} className="assistant-chat__turn">
            <Message from={turn.from} author={turn.from === 'user' ? es.patient.assistant.you : es.patient.assistant.assistant}>
              {turn.text}
            </Message>
            {turn.citations && turn.citations.length > 0 ? (
              <ul className="assistant-chat__citations">
                {turn.citations.map((citation) => (
                  <li key={citation.title}>{format(es.patient.assistant.citations, { title: citation.title })}</li>
                ))}
              </ul>
            ) : null}
            {turn.fallback ? <p className="assistant-chat__fallback">{es.patient.assistant.fallback}</p> : null}
          </div>
        ))}
        {pendingId !== null ? (
          <p role="status" aria-live="polite" className="assistant-chat__writing">{es.patient.assistant.writing}</p>
        ) : null}
      </Conversation>

      <PromptInput
        id={inputId}
        label={es.patient.assistant.label}
        placeholder={es.patient.assistant.placeholder}
        value={draft}
        onChange={(value) => {
          setDraft(value);
          if (error) setError(null);
        }}
        onSubmit={() => { void send(draft); }}
        pending={pendingId !== null}
        onStop={stop}
        disabled={ended}
        sendLabel={es.patient.assistant.send}
        sendAriaLabel={es.patient.assistant.sendAria}
        stopLabel={es.patient.assistant.stop}
        invalid={error !== null}
        describedBy={error ? errorId : undefined}
        footer={
          <>
            {max === undefined ? null : (
              <p className="assistant-chat__counter">{format(es.patient.assistant.counter, { count, max })}</p>
            )}
            {error ? <p id={errorId} role="alert" className="assistant-chat__error">{error}</p> : null}
          </>
        }
      />
    </div>
  );
}
