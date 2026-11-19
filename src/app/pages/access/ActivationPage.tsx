import { useState, type SubmitEvent } from 'react';
import { useNavigate } from 'react-router';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { ApiError, apiErrorMessage } from '@/services/api/ApiError';
import { useApi } from '@/state/useApi';
import { Button, ButtonLink, TextField } from '@/ui';
import { AccessLayout } from './AccessLayout';
import { ActivationDetailsStep, type VerifiedActivation } from './ActivationDetailsStep';

/**
 * Patient activation. Step 1 checks the clinic's code and birth date (the API answers the same
 * error for any mismatch, so the screen says nothing more specific). Step 2 is the new password,
 * the email when the clinic did not have one, and the consents.
 */
export function ActivationPage() {
  const navigate = useNavigate();
  const [verified, setVerified] = useState<VerifiedActivation | null>(null);
  const [restartMessage, setRestartMessage] = useState<string | null>(null);

  if (verified !== null) {
    return (
      <AccessLayout
        title={es.access.activation.createTitle}
        description={format(es.access.activation.clinic, { clinic: verified.clinicName })}
      >
        <ActivationDetailsStep
          verified={verified}
          onRestart={(message) => {
            setVerified(null);
            setRestartMessage(message);
          }}
          onDone={(path) => {
            void navigate(path, { replace: true });
          }}
        />
      </AccessLayout>
    );
  }

  return (
    <AccessLayout title={es.access.activation.title} description={es.access.activation.description}>
      {restartMessage ? (
        <p className="access__alert" role="alert">
          {restartMessage}
        </p>
      ) : null}
      <ActivationCodeStep
        onVerified={(result) => {
          setRestartMessage(null);
          setVerified(result);
        }}
      />
      <p>
        <ButtonLink to="/login" variant="ghost">
          {es.access.mfa.back}
        </ButtonLink>
      </p>
    </AccessLayout>
  );
}

interface ActivationCodeStepProps {
  onVerified: (result: VerifiedActivation) => void;
}

function ActivationCodeStep({ onVerified }: ActivationCodeStepProps) {
  const { api } = useApi();
  const [code, setCode] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const next: Record<string, string> = {};
    if (code.trim() === '') next['code'] = es.validation.required;
    if (birthDate === '') next['birthDate'] = es.validation.required;
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setFormError(null);
    setPending(true);
    try {
      const dto = await api.verifyActivation(code.trim(), birthDate);
      onVerified({
        activationToken: dto.activation_token,
        clinicName: dto.clinic_name,
        privacyNoticeVersionId: dto.privacy_notice_version_id,
        emailRequired: dto.email_required,
      });
    } catch (error) {
      setFormError(apiErrorMessage(error));
      if (error instanceof ApiError && error.code === 'INVITATION_INVALID') setCode('');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="access__form" onSubmit={(event) => void handleSubmit(event)} noValidate>
      {formError ? (
        <p className="access__alert" role="alert">
          {formError}
        </p>
      ) : null}
      <TextField
        name="activation_code"
        label={es.access.activation.code}
        hint={es.access.activation.codeHint}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        required
        value={code}
        error={errors['code']}
        onChange={(event) => {
          setCode(event.target.value);
        }}
      />
      <TextField
        name="birth_date"
        type="date"
        label={es.access.activation.birthDate}
        autoComplete="bday"
        required
        value={birthDate}
        error={errors['birthDate']}
        onChange={(event) => {
          setBirthDate(event.target.value);
        }}
      />
      <Button type="submit" size="lg" className="access__submit" loading={pending}>
        {es.access.activation.verify}
      </Button>
    </form>
  );
}
