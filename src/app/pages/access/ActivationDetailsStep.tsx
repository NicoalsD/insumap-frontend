import { Check, Circle } from 'lucide-react';
import { useRef, useState, type SubmitEvent } from 'react';
import { homePathFor } from '@/app/navigation';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { ApiError, apiErrorMessage } from '@/services/api/ApiError';
import { LIMIT_KEYS } from '@/services/forms/formSchemas';
import { useApi } from '@/state/useApi';
import { useFieldLimits } from '@/state/useFieldLimits';
import { useFormSchemas } from '@/state/useFormSchemas';
import { useSession } from '@/state/useSession';
import { Button, TextField } from '@/ui';
import { PasswordField } from './PasswordField';

export interface VerifiedActivation {
  readonly activationToken: string;
  readonly clinicName: string;
  readonly privacyNoticeVersionId: string;
  readonly emailRequired: boolean;
}

export interface ActivationDetailsStepProps {
  verified: VerifiedActivation;
  /** The code is no longer usable (or the notice changed): back to step 1 with the reason. */
  onRestart: (message: string) => void;
  /** Where to go once the session is open. */
  onDone: (path: string) => void;
}

type Errors = Readonly<Record<'email' | 'password' | 'privacy', string | undefined>>;
const NO_ERRORS: Errors = { email: undefined, password: undefined, privacy: undefined };
/** Errors that send the patient back to the code: the token is spent or the notice changed. */
const RESTART_CODES = new Set(['INVITATION_INVALID', 'CONSENT_VERSION_OUTDATED']);

/**
 * Step 2 of activation: email (only when the clinic did not have one), the new password with its
 * limits checked live, and the consents. The AI consent is separate and starts unchecked.
 */
export function ActivationDetailsStep({ verified, onRestart, onDone }: ActivationDetailsStepProps) {
  const { api } = useApi();
  const { reload } = useSession();
  const { schemas } = useFormSchemas();
  const { data: limits } = useFieldLimits();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [aiAccepted, setAiAccepted] = useState(false);
  const [errors, setErrors] = useState<Errors>(NO_ERRORS);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const privacyRef = useRef<HTMLInputElement>(null);

  const minLength = limits?.[LIMIT_KEYS.passwordMin];
  const maxLength = limits?.[LIMIT_KEYS.passwordMax];
  const length = Array.from(password).length;
  const rules = [
    ...(minLength === undefined
      ? []
      : [{ key: 'min', text: format(es.access.activation.ruleMin, { min: minLength }), met: length >= minLength }]),
    ...(maxLength === undefined
      ? []
      : [{ key: 'max', text: format(es.access.activation.ruleMax, { max: maxLength }), met: length <= maxLength }]),
  ];

  function validate(): Errors {
    const next = { ...NO_ERRORS };
    if (verified.emailRequired) {
      const parsed = schemas.email.safeParse(email);
      if (!parsed.success) next.email = es.validation.invalidEmail;
    }
    if (password === '') next.password = es.validation.required;
    else if (minLength !== undefined && length < minLength) {
      next.password = format(es.validation.tooShort, { min: minLength });
    } else if (maxLength !== undefined && length > maxLength) {
      next.password = format(es.validation.tooLong, { max: maxLength });
    }
    if (!privacyAccepted) next.privacy = es.access.activation.privacyRequired;
    return next;
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const next = validate();
    setErrors(next);
    setFormError(null);
    if (next.email !== undefined) emailRef.current?.focus();
    else if (next.password !== undefined) passwordRef.current?.focus();
    else if (next.privacy !== undefined) privacyRef.current?.focus();
    if (next.email !== undefined || next.password !== undefined || next.privacy !== undefined) return;

    setPending(true);
    try {
      const status = await api.completeActivation({
        activation_token: verified.activationToken,
        // The password goes as typed: spaces are part of it, so nothing is trimmed here.
        new_password: password,
        ...(verified.emailRequired ? { email: email.trim() } : {}),
        consent: {
          privacy_notice_version_id: verified.privacyNoticeVersionId,
          accepted: privacyAccepted,
          ai_external_processing: aiAccepted,
        },
      });
      const session = await reload();
      if (session === null) {
        setFormError(es.access.login.sessionNotOpened);
        return;
      }
      if (status === 'MFA_ENROLLMENT_REQUIRED') onDone('/mfa/enrollment');
      else onDone(homePathFor(session.role));
    } catch (error) {
      handleFailure(error);
    } finally {
      setPending(false);
    }
  }

  function handleFailure(error: unknown) {
    if (!(error instanceof ApiError)) {
      setFormError(apiErrorMessage(error));
      return;
    }
    if (RESTART_CODES.has(error.code)) {
      onRestart(apiErrorMessage(error));
      return;
    }
    if (error.code === 'EMAIL_UNAVAILABLE') {
      setErrors({ ...NO_ERRORS, email: apiErrorMessage(error) });
      emailRef.current?.focus();
      return;
    }
    if (error.code === 'VALIDATION_ERROR' && 'new_password' in error.fieldErrors) {
      setErrors({ ...NO_ERRORS, password: es.access.activation.passwordRejected });
      passwordRef.current?.focus();
      return;
    }
    setFormError(apiErrorMessage(error));
  }

  return (
    <form className="access__form" onSubmit={(event) => void handleSubmit(event)} noValidate>
      {formError ? (
        <p className="access__alert" role="alert">
          {formError}
        </p>
      ) : null}
      {verified.emailRequired ? (
        <TextField
          ref={emailRef}
          name="email"
          type="email"
          label={es.access.activation.email}
          hint={es.access.activation.emailHint}
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
          autoCapitalize="none"
          required
          value={email}
          error={errors.email}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
        />
      ) : null}
      <div className="access__section" role="group" aria-labelledby="activation-password-title">
        <p id="activation-password-title" className="access__subtitle">
          {es.access.activation.createTitle}
        </p>
        {limits === undefined ? (
          <p className="access__live">{es.access.activation.rulesLoading}</p>
        ) : (
          <div>
            <p className="access__live">{es.access.activation.rulesTitle}</p>
            <ul className="access__rules">
              {rules.map((rule) => (
                <li key={rule.key} data-met={rule.met}>
                  {rule.met ? <Check size="1em" aria-hidden="true" /> : <Circle size="1em" aria-hidden="true" />}
                  <span>{rule.text}</span>
                  <span className="visually-hidden">
                    {rule.met ? es.access.activation.ruleMet : es.access.activation.rulePending}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <PasswordField
          ref={passwordRef}
          name="new_password"
          autoComplete="new-password"
          label={es.access.activation.password}
          maxLength={maxLength}
          required
          value={password}
          error={errors.password}
          onChange={(event) => {
            setPassword(event.target.value);
          }}
        />
      </div>
      <div className="access__section" role="group" aria-labelledby="activation-consent-title">
        <p id="activation-consent-title" className="access__subtitle">
          {es.access.activation.consentTitle}
        </p>
        <label className="access__check">
          <input
            ref={privacyRef}
            type="checkbox"
            name="privacy"
            checked={privacyAccepted}
            aria-invalid={errors.privacy !== undefined}
            aria-describedby="privacy-hint"
            onChange={(event) => {
              setPrivacyAccepted(event.target.checked);
            }}
          />
          <span>{es.access.activation.privacy}</span>
        </label>
        <p id="privacy-hint" className="access__live">
          {es.access.activation.privacyHint}
        </p>
        {errors.privacy !== undefined ? (
          <p className="access__alert" role="alert">
            {errors.privacy}
          </p>
        ) : null}
        <label className="access__check">
          <input
            type="checkbox"
            name="ai_external_processing"
            checked={aiAccepted}
            aria-describedby="ai-hint"
            onChange={(event) => {
              setAiAccepted(event.target.checked);
            }}
          />
          <span>{es.access.activation.ai}</span>
        </label>
        <p id="ai-hint" className="access__live">
          {es.access.activation.aiHint}
        </p>
      </div>
      <Button type="submit" size="lg" className="access__submit" loading={pending}>
        {es.access.activation.complete}
      </Button>
    </form>
  );
}
