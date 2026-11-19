import { useId, useRef, useState, type SyntheticEvent } from 'react';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import type { GlucoseThresholds } from '@/core/glucose/thresholds';
import { apiErrorMessage } from '@/services/api/ApiError';
import type { FieldLimitsDto } from '@/services/dto/meta';
import { Button } from '@/ui';
import { usePendingReadings } from '../offline/PendingReadingsContext';
import {
  PATIENT_CONTEXTS,
  buildReadingBody,
  checkValueText,
  checkWhen,
  needsUrgentNotice,
  stateOf,
  toLocalInputValue,
  type PatientContext,
  type WhenMode,
} from './recordingModel';
import './GlucoseRecorder.css';
import { RangeRuler } from '@/ui/glucose/RangeRuler';
import { GlucoseSlider } from './GlucoseSlider';

const FIRST_STEP = 1;
const WHEN_STEP = 2;
const CONTEXT_STEP = 3;
const STEPS = CONTEXT_STEP;

interface Outcome {
  readonly kind: 'saved' | 'pending' | 'failed';
  readonly valueMgDl: number;
  readonly message: string;
  readonly urgent: 'VERY_LOW' | 'VERY_HIGH' | null;
}

export interface GlucoseRecorderProps {
  readonly thresholds: GlucoseThresholds;
  readonly limits: FieldLimitsDto;
  /** Starts open (used by the readings page when the patient came to register). */
  readonly defaultOpen?: boolean;
}

/**
 * Three-step inline wizard to register a glucose value: the number, when it was measured, and the
 * moment of the day. The API checks the value again; this only gives feedback first. Pending
 * readings go to the offline queue and say so.
 *
 * Pattern: none (a plain stepped form; its rules live in `recordingModel.ts`).
 */
export function GlucoseRecorder({ thresholds, limits, defaultOpen = false }: GlucoseRecorderProps) {
  const { saveReading } = usePendingReadings();
  const [open, setOpen] = useState(defaultOpen);
  const [step, setStep] = useState(FIRST_STEP);
  const [valueText, setValueText] = useState('');
  const [whenMode, setWhenMode] = useState<WhenMode>('now');
  const [pickedLocal, setPickedLocal] = useState('');
  const [context, setContext] = useState<PatientContext | null>(null);
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const idBase = useId();
  const fieldId = (name: string) => `${idBase}-${name}`;

  const reset = () => {
    setStep(FIRST_STEP);
    setValueText('');
    setWhenMode('now');
    setPickedLocal('');
    setContext(null);
    setErrors({});
    setOutcome(null);
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const goTo = (next: number) => {
    setStep(next);
    setErrors({});
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const checkStep = (current: number): Readonly<Record<string, string>> => {
    if (current === FIRST_STEP) {
      const value = checkValueText(valueText, limits);
      return value.ok ? {} : { value: value.error };
    }
    if (current === WHEN_STEP) {
      const when = checkWhen(whenMode, pickedLocal, new Date(), limits);
      return when.ok ? {} : { when: when.error };
    }
    return context === null ? { context: es.patient.record.context.required } : {};
  };

  const onNext = () => {
    const found = checkStep(step);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      requestAnimationFrame(() => document.getElementById(fieldId(Object.keys(found)[0] ?? 'value'))?.focus());
      return;
    }
    goTo(step + 1);
  };

  const onSave = async (event: SyntheticEvent) => {
    event.preventDefault();
    const found = checkStep(CONTEXT_STEP);
    setErrors(found);
    if (context === null || Object.keys(found).length > 0) return;
    const value = checkValueText(valueText, limits);
    const when = checkWhen(whenMode, pickedLocal, new Date(), limits);
    if (!value.ok || !when.ok) return;
    const body = buildReadingBody({
      clientReadingId: crypto.randomUUID(),
      valueMgDl: value.value,
      measuredAt: when.measuredAt,
      context,
      limits,
    });
    if (body === null) {
      setErrors({ context: es.patient.record.result.failed });
      return;
    }
    setBusy(true);
    const state = stateOf(value.value, thresholds);
    const stateLabel = es.glucose.ranges[state];
    try {
      const result = await saveReading(body);
      setOutcome({
        kind: result,
        valueMgDl: value.value,
        message:
          result === 'saved'
            ? format(es.patient.record.result.saved, { value: value.value, state: stateLabel.toLowerCase() })
            : format(es.patient.record.result.pending, { value: value.value }),
        urgent: needsUrgentNotice(state) ? (state as 'VERY_LOW' | 'VERY_HIGH') : null,
      });
    } catch (error) {
      setOutcome({
        kind: 'failed',
        valueMgDl: value.value,
        message: `${es.patient.record.result.failed} ${apiErrorMessage(error)}`,
        urgent: null,
      });
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button size="lg" className="glucose-recorder__open" onClick={() => { setOpen(true); }}>
        {es.patient.record.open}
      </Button>
    );
  }

  if (outcome !== null && outcome.kind !== 'failed') {
    return (
      <section className="glucose-recorder" aria-labelledby={fieldId('title')}>
        <h2 id={fieldId('title')} ref={headingRef} tabIndex={-1} className="glucose-recorder__title">
          {es.patient.record.title}
        </h2>
        {/* The end of the flow is its peak: a check draws itself and the value lands on its range. */}
        <div className="record-peak" data-kind={outcome.kind}>
          <svg className="record-peak__check" viewBox="0 0 52 52" aria-hidden="true" focusable="false">
            <circle className="record-peak__ring" cx="26" cy="26" r="23" />
            <path className="record-peak__tick" d="M15 27 l7.5 7.5 L37 19" />
          </svg>
          <p role="status" className="glucose-recorder__result" data-kind={outcome.kind}>
            {outcome.message}
          </p>
        </div>
        <div className="record-peak__ruler">
          <RangeRuler valueMgDl={outcome.valueMgDl} thresholds={thresholds} />
        </div>
        {outcome.urgent !== null ? (
          <p className="glucose-recorder__urgent" role="alert">
            {es.patient.record.urgent[outcome.urgent]}
          </p>
        ) : null}
        <div className="glucose-recorder__actions">
          <Button size="lg" variant="secondary" onClick={reset}>
            {es.patient.record.again}
          </Button>
          <Button size="lg" variant="ghost" onClick={close}>
            {es.patient.record.close}
          </Button>
        </div>
      </section>
    );
  }

  const stepLabel = format(es.patient.record.stepOf, { step, total: STEPS });

  return (
    <section className="glucose-recorder" aria-labelledby={fieldId('title')}>
      <div className="glucose-recorder__head">
        <h2 id={fieldId('title')} ref={headingRef} tabIndex={-1} className="glucose-recorder__title">
          {es.patient.record.title}
        </h2>
        <p className="glucose-recorder__step">{stepLabel}</p>
      </div>

      <form className="glucose-recorder__form" noValidate onSubmit={(event) => { void onSave(event); }}>
        {step === FIRST_STEP ? (
          <div className="glucose-recorder__field">
            <label htmlFor={fieldId('value')} className="glucose-recorder__label">
              {es.patient.record.value.label}
            </label>
            <p id={fieldId('value-hint')} className="glucose-recorder__hint">
              {es.patient.record.value.hint}
            </p>
            <input
              id={fieldId('value')}
              className="glucose-recorder__input"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              name="glucose-value"
              value={valueText}
              aria-describedby={`${fieldId('value-hint')}${errors['value'] ? ` ${fieldId('value-error')}` : ''}`}
              aria-invalid={errors['value'] ? true : undefined}
              autoFocus
              onChange={(event) => { setValueText(event.target.value); }}
            />
            <GlucoseSlider
              thresholds={thresholds}
              valueText={valueText}
              onPick={(value) => {
                setValueText(String(value));
              }}
            />
            {errors['value'] ? (
              <p id={fieldId('value-error')} className="glucose-recorder__error">{errors['value']}</p>
            ) : null}
          </div>
        ) : null}

        {step === WHEN_STEP ? (
          <fieldset className="glucose-recorder__field" aria-describedby={errors['when'] ? fieldId('when-error') : undefined}>
            <legend className="glucose-recorder__label">{es.patient.record.when.legend}</legend>
            <div className="glucose-recorder__choices">
              <label className="glucose-recorder__choice">
                <input type="radio" name="when" checked={whenMode === 'now'} onChange={() => { setWhenMode('now'); }} />
                {es.patient.record.when.now}
              </label>
              <label className="glucose-recorder__choice">
                <input type="radio" name="when" checked={whenMode === 'pick'} onChange={() => { setWhenMode('pick'); }} />
                {es.patient.record.when.pick}
              </label>
            </div>
            {whenMode === 'pick' ? (
              <>
                <label htmlFor={fieldId('picked')} className="glucose-recorder__label">
                  {es.patient.record.when.pickedLabel}
                </label>
                <input
                  id={fieldId('picked')}
                  className="glucose-recorder__input"
                  type="datetime-local"
                  value={pickedLocal}
                  max={toLocalInputValue(new Date())}
                  onChange={(event) => { setPickedLocal(event.target.value); }}
                />
              </>
            ) : null}
            {errors['when'] ? (
              <p id={fieldId('when-error')} className="glucose-recorder__error">{errors['when']}</p>
            ) : null}
          </fieldset>
        ) : null}

        {step === CONTEXT_STEP ? (
          <fieldset className="glucose-recorder__field" aria-describedby={errors['context'] ? fieldId('context-error') : undefined}>
            <legend className="glucose-recorder__label">{es.patient.record.context.legend}</legend>
            <div className="glucose-recorder__choices">
              {PATIENT_CONTEXTS.map((option) => (
                <label key={option} className="glucose-recorder__choice">
                  <input
                    type="radio"
                    name="context"
                    value={option}
                    checked={context === option}
                    onChange={() => { setContext(option); }}
                  />
                  {es.patient.record.context[option]}
                </label>
              ))}
            </div>
            {errors['context'] ? (
              <p id={fieldId('context-error')} className="glucose-recorder__error">{errors['context']}</p>
            ) : null}
          </fieldset>
        ) : null}

        {outcome?.kind === 'failed' ? (
          <p role="alert" className="glucose-recorder__error">{outcome.message}</p>
        ) : null}

        <div className="glucose-recorder__actions">
          {step > FIRST_STEP ? (
            <Button size="lg" variant="secondary" onClick={() => { goTo(step - 1); }}>
              {es.patient.record.back}
            </Button>
          ) : null}
          {step < STEPS ? (
            <Button size="lg" onClick={onNext}>
              {es.patient.record.next}
            </Button>
          ) : (
            <Button type="submit" size="lg" loading={busy}>
              {busy ? es.patient.record.saving : es.patient.record.save}
            </Button>
          )}
          <Button size="lg" variant="ghost" onClick={close}>
            {es.patient.record.close}
          </Button>
        </div>
      </form>
    </section>
  );
}
