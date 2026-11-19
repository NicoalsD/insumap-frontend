import { useId, useState, type SyntheticEvent } from 'react';
import type { RecommendationDto } from '@/services/dto/clinical';
import { RecommendationViewModelAdapter, type RecommendationViewModel } from '@/services/adapters/RecommendationViewModelAdapter';
import { apiErrorMessage } from '@/services/api/ApiError';
import { useFormSchemas } from '@/state/useFormSchemas';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { TextField } from '@/ui/TextField';
import { useToast } from '@/ui/useToast';
import { EmptyState } from '@/ui/States';
import { formatDateTime } from './format';
import { useRecommendationDecisions } from './queries';

export interface AiSuggestionPanelProps {
  readonly recommendations: readonly RecommendationDto[];
  readonly patientId: string;
  readonly canDecide: boolean;
  readonly timeZone: string;
}

type Mode = 'modify' | 'reject' | null;

const adapter = new RecommendationViewModelAdapter();
const DECIMAL_SEPARATOR = ',';
const DECIMAL_POINT = '.';

/** Doses the doctor types with a comma (es-CO) or a point; both mean the same number. */
function parseDose(text: string): number {
  return Number(text.trim().replace(DECIMAL_SEPARATOR, DECIMAL_POINT));
}

/**
 * AI suggestions for this patient, inline and never in a modal. Every card carries the label
 * "Sugerencia de la IA, pendiente de la decisión del médico". The doctor approves, modifies (new
 * dose and a required reason) or rejects (a required reason). Decided suggestions keep their status
 * and reason. A suggestion past its expiry cannot be decided.
 *
 * Pattern: none (presentation over `useRecommendationDecisions`; the adapter is P06).
 */
export function AiSuggestionPanel({ recommendations, patientId, canDecide, timeZone }: AiSuggestionPanelProps) {
  const views = recommendations.map((dto) => ({ view: adapter.adapt(dto), reason: dto.decision_reason ?? null }));
  return (
    <section className="panel" aria-labelledby="ai-title">
      <header className="panel__header">
        <h2 id="ai-title">{es.detail.ai.title}</h2>
      </header>
      <div className="panel__body ai-panel">
        {views.length === 0 ? <EmptyState title={es.detail.ai.empty} /> : null}
        {views.map(({ view, reason }) => (
          <RecommendationCard
            key={view.id}
            view={view}
            decisionReason={reason}
            patientId={patientId}
            canDecide={canDecide}
            timeZone={timeZone}
          />
        ))}
        <p className="ai-panel__note">{es.detail.ai.patientNever}</p>
      </div>
    </section>
  );
}

interface RecommendationCardProps {
  readonly view: RecommendationViewModel;
  readonly decisionReason: string | null;
  readonly patientId: string;
  readonly canDecide: boolean;
  readonly timeZone: string;
}

function RecommendationCard({ view, decisionReason, patientId, canDecide, timeZone }: RecommendationCardProps) {
  const toast = useToast();
  const { schemas } = useFormSchemas();
  const { approve, modify, reject } = useRecommendationDecisions(patientId);
  const [mode, setMode] = useState<Mode>(null);
  const [doseText, setDoseText] = useState(String(view.proposal?.proposedDose ?? ''));
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const panelId = useId();
  const ids = { panel: panelId };

  const actionable = canDecide && view.canDecide;
  const pending = approve.isPending || modify.isPending || reject.isPending;
  const showDecided = view.status !== 'PROPOSED' || !view.canDecide;
  const statusLabel = es.detail.ai.status[view.status];

  const notify = (failure: unknown) => {
    toast.show(apiErrorMessage(failure), 'critical');
  };
  const done = () => {
    toast.show(es.detail.ai.decided, 'success');
    setMode(null);
    setReason('');
    setErrors({});
  };

  const validReason = (): string | null => {
    const parsed = schemas.reason.safeParse(reason);
    if (parsed.success) return parsed.data;
    setErrors((current) => ({ ...current, reason: parsed.error.issues[0]?.message ?? es.validation.invalid }));
    return null;
  };

  const submitModify = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const dose = parseDose(doseText);
    const currentDose = view.proposal?.currentDose ?? 0;
    const doseOk = Number.isFinite(dose) && dose > 0;
    const trimmed = validReason();
    if (!doseOk) {
      setErrors((current) => ({ ...current, dose: es.detail.ai.doseInvalid }));
      return;
    }
    if (trimmed === null) return;
    setErrors({});
    const action = dose >= currentDose ? 'INCREASE' : 'DECREASE';
    modify.mutate(
      {
        id: view.id,
        reason: trimmed,
        proposal: {
          action,
          current_dose: currentDose,
          proposed_dose: dose,
          delta_units: Math.abs(dose - currentDose),
        },
      },
      { onSuccess: done, onError: notify },
    );
  };

  const submitReject = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = validReason();
    if (trimmed === null) return;
    setErrors({});
    reject.mutate({ id: view.id, reason: trimmed }, { onSuccess: done, onError: notify });
  };

  const toggle = (next: Exclude<Mode, null>) => {
    setMode((current) => (current === next ? null : next));
    setErrors({});
  };

  return (
    <article className="ai-card" aria-label={`${es.notices.aiSuggestion}, ${statusLabel}`}>
      <div className="ai-card__badges">
        <Badge tone="info">{es.notices.aiSuggestion}</Badge>
        {view.isFallback ? <Badge tone="neutral">{es.notices.aiFallback}</Badge> : null}
        {showDecided ? <Badge tone={view.status === 'REJECTED' ? 'critical' : 'success'}>{statusLabel}</Badge> : null}
      </div>
      <p className="ai-card__summary">{view.summary}</p>
      {view.factors.length > 0 ? (
        <ul className="ai-card__factors">
          {view.factors.map((factor) => (
            <li key={factor}>{factor}</li>
          ))}
        </ul>
      ) : null}
      {view.proposal ? (
        <p className="ai-card__dose measure">
          {format(es.detail.ai.doseChange, {
            current: view.proposal.currentDose,
            proposed: view.proposal.proposedDose,
            action: view.proposal.action === 'INCREASE' ? es.detail.ai.actionIncrease : es.detail.ai.actionDecrease,
          })}
        </p>
      ) : (
        <p className="ai-card__dose">{es.detail.ai.noProposal}</p>
      )}
      {view.unavailableReason ? <p className="ai-card__unavailable">{es.detail.ai.unavailable}</p> : null}
      <p className="ai-card__expiry">
        {view.canDecide || view.status !== 'PROPOSED'
          ? format(es.detail.ai.expires, { time: formatDateTime(view.expiresAt, timeZone) })
          : es.detail.ai.expired}
      </p>
      {decisionReason && showDecided ? (
        <p className="ai-card__reason">{format(es.detail.ai.decisionReason, { reason: decisionReason })}</p>
      ) : null}

      {actionable ? (
        <div className="ai-card__actions">
          <Button
            size="sm"
            loading={approve.isPending}
            disabled={pending && !approve.isPending}
            onClick={() => {
              approve.mutate(view.id, { onSuccess: done, onError: notify });
            }}
          >
            {es.detail.ai.approve}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            aria-expanded={mode === 'modify'}
            aria-controls={mode === 'modify' ? ids.panel : undefined}
            disabled={!view.proposal}
            onClick={() => {
              toggle('modify');
            }}
          >
            {es.detail.ai.modify}
          </Button>
          <Button
            size="sm"
            variant="danger"
            aria-expanded={mode === 'reject'}
            aria-controls={mode === 'reject' ? ids.panel : undefined}
            onClick={() => {
              toggle('reject');
            }}
          >
            {es.detail.ai.reject}
          </Button>
        </div>
      ) : null}

      {actionable && mode === 'modify' ? (
        <form id={ids.panel} className="ai-card__form" noValidate onSubmit={submitModify}>
          <TextField
            name="dose"
            label={es.detail.ai.newDose}
            hint={es.detail.ai.newDoseHint}
            inputMode="decimal"
            autoComplete="off"
            value={doseText}
            error={errors['dose']}
            onChange={(event) => {
              setDoseText(event.target.value);
            }}
          />
          <ReasonField value={reason} error={errors['reason']} onChange={setReason} />
          <div className="ai-card__actions">
            <Button type="submit" size="sm" loading={modify.isPending}>
              {es.detail.ai.confirmModify}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setMode(null); }}>
              {es.detail.ai.cancel}
            </Button>
          </div>
        </form>
      ) : null}

      {actionable && mode === 'reject' ? (
        <form id={ids.panel} className="ai-card__form" noValidate onSubmit={submitReject}>
          <ReasonField value={reason} error={errors['reason']} onChange={setReason} />
          <div className="ai-card__actions">
            <Button type="submit" size="sm" variant="danger" loading={reject.isPending}>
              {es.detail.ai.confirmReject}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setMode(null); }}>
              {es.detail.ai.cancel}
            </Button>
          </div>
        </form>
      ) : null}
    </article>
  );
}

function ReasonField({
  value,
  error,
  onChange,
}: {
  readonly value: string;
  readonly error: string | undefined;
  readonly onChange: (value: string) => void;
}) {
  return (
    <TextField
      name="reason"
      label={es.detail.ai.reason}
      hint={es.detail.ai.reasonHint}
      autoComplete="off"
      value={value}
      error={error}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    />
  );
}
