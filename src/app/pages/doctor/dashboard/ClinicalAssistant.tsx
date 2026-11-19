import { Sparkles } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { ApiError } from '@/services/api/ApiError';
import { HTTP_STATUS } from '@/services/http/httpStatus';
import { useApi } from '@/state/useApi';
import { Conversation, Message, PromptInput, Suggestion, Suggestions } from '@/ui/shadcn/ai-chat';
import { normalizeText, type TriageItem } from '../triage/triageModel';

/** Days the summaries cover (the API's default window of the summary). */
const SUMMARY_DAYS = 14;
const SUGGESTED_PATIENTS = 3;

interface Turn {
  readonly id: number;
  readonly from: 'user' | 'assistant';
  readonly text: string;
  readonly sections?: readonly { readonly title: string; readonly text: string }[];
  readonly label?: string;
  readonly patient?: { readonly id: string; readonly name: string };
}

/**
 * Clinical assistant of the doctor's panel, built with the AI chat components: it asks the API for
 * the summary of a patient's last 14 days (`POST /patients/{id}/clinical-summaries`) and shows it as
 * a reply with its sections and the label the API sends. It never proposes doses here: pending dose
 * suggestions are only counted, and decided in each record.
 */
export function ClinicalAssistant({
  rows,
  pendingSuggestions,
}: {
  readonly rows: readonly TriageItem[];
  readonly pendingSuggestions: number;
}) {
  const { api } = useApi();
  const inputId = useId();
  const next = useRef(1);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [turns, setTurns] = useState<readonly Turn[]>(() => [
    { id: 0, from: 'assistant', text: es.doctor.dashboard.assistant.intro },
  ]);
  const add = (turn: Omit<Turn, 'id'>) => {
    const id = next.current;
    next.current += 1;
    setTurns((current) => [...current, { ...turn, id }]);
  };

  const summarize = async (patient: TriageItem) => {
    add({ from: 'user', text: format(es.doctor.dashboard.assistant.ask, { name: patient.fullName }) });
    setPending(true);
    try {
      const summary = await api.createClinicalSummary(patient.patientId, SUMMARY_DAYS);
      add({
        from: 'assistant',
        text: summary.summary_text,
        sections: summary.sections,
        label: summary.label,
        patient: { id: patient.patientId, name: patient.fullName },
      });
    } catch (error) {
      const limited = error instanceof ApiError && error.status === HTTP_STATUS.TOO_MANY_REQUESTS;
      add({ from: 'assistant', text: limited ? es.doctor.dashboard.assistant.rateLimited : es.doctor.dashboard.assistant.failed });
    } finally {
      setPending(false);
    }
  };

  const onSubmit = () => {
    const query = draft.trim();
    if (query === '') return;
    setDraft('');
    const needle = normalizeText(query);
    const matches = rows.filter((row) => normalizeText(row.fullName).includes(needle));
    const [only] = matches;
    if (matches.length === 1 && only) {
      void summarize(only);
      return;
    }
    add({ from: 'user', text: query });
    add({
      from: 'assistant',
      text:
        matches.length === 0
          ? format(es.doctor.dashboard.assistant.notFound, { query })
          : format(es.doctor.dashboard.assistant.ambiguous, { query, names: matches.map((row) => row.fullName).join(', ') }),
    });
  };

  const suggested = rows.slice(0, SUGGESTED_PATIENTS);
  return (
    <section className="panel clinical-assistant" aria-labelledby="clinical-assistant-title">
      <header className="panel__header">
        <h2 id="clinical-assistant-title">
          <Sparkles size="1.125rem" aria-hidden="true" className="clinical-assistant__icon" />
          {es.doctor.dashboard.assistant.title}
        </h2>
      </header>
      <div className="clinical-assistant__body">
        <p className="clinical-assistant__pending">
          {pendingSuggestions > 0
            ? format(es.doctor.dashboard.assistant.pending, { count: pendingSuggestions })
            : es.doctor.dashboard.assistant.noPending}
        </p>
        <Conversation label={es.doctor.dashboard.assistant.label} scrollLabel={es.doctor.dashboard.assistant.scrollEnd} className="clinical-assistant__log">
          {turns.map((turn) => (
            <Message
              key={turn.id}
              from={turn.from}
              author={turn.from === 'user' ? es.doctor.dashboard.assistant.you : es.doctor.dashboard.assistant.author}
            >
              {turn.sections && turn.sections.length > 0 ? (
                <span className="clinical-assistant__sections">
                  {turn.sections.map((section) => (
                    <span key={section.title} className="clinical-assistant__section">
                      <strong>{section.title}</strong>
                      <span>{section.text}</span>
                    </span>
                  ))}
                </span>
              ) : (
                turn.text
              )}
              {turn.label ? <span className="clinical-assistant__label">{turn.label}</span> : null}
              {turn.patient ? (
                <Link to={`/doctor/patients/${turn.patient.id}`} className="clinical-assistant__link">
                  {format(es.doctor.dashboard.assistant.openRecord, { name: turn.patient.name })}
                </Link>
              ) : null}
            </Message>
          ))}
          {pending ? (
            <p role="status" aria-live="polite" className="clinical-assistant__writing">
              {es.doctor.dashboard.assistant.writing}
            </p>
          ) : null}
        </Conversation>
        <Suggestions label={es.doctor.dashboard.assistant.suggestionsLabel}>
          {suggested.map((row) => (
            <Suggestion
              key={row.patientId}
              suggestion={row.fullName}
              disabled={pending}
              onSelect={() => {
                void summarize(row);
              }}
            />
          ))}
        </Suggestions>
        <PromptInput
          id={inputId}
          label={es.doctor.dashboard.assistant.inputLabel}
          value={draft}
          onChange={setDraft}
          onSubmit={onSubmit}
          pending={pending}
          sendLabel={es.doctor.dashboard.assistant.send}
          sendAriaLabel={es.doctor.dashboard.assistant.sendAria}
          stopLabel={es.doctor.dashboard.assistant.stop}
          placeholder={es.doctor.dashboard.assistant.placeholder}
          footer={<span className="clinical-assistant__notice">{es.doctor.dashboard.assistant.notice}</span>}
        />
      </div>
    </section>
  );
}
