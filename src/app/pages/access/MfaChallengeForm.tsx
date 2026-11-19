import { useRef, useState, type SubmitEvent } from 'react';
import { es } from '@/i18n/es';
import { ApiError, apiErrorMessage } from '@/services/api/ApiError';
import { useApi } from '@/state/useApi';
import { Button, TextField } from '@/ui';

/** Digits in a TOTP code (API.md 2.3: a 6-digit code). */
const TOTP_LENGTH = 6;
const DIGITS_ONLY = /\D/g;

type Mode = 'authenticator' | 'recovery';

export interface MfaChallengeFormProps {
  challengeToken: string;
  /** Called once the code is accepted; the parent reloads the session and navigates. */
  onVerified: () => Promise<void>;
  /** The challenge expired or ran out of attempts: back to the password step. */
  onExpired: () => void;
  onBack: () => void;
}

/**
 * Second step of staff sign-in. A 6-digit code from the authenticator app submits by itself when
 * complete; a recovery code is typed and submitted with the button, because it has no fixed length
 * on screen.
 */
export function MfaChallengeForm({ challengeToken, onVerified, onExpired, onBack }: MfaChallengeFormProps) {
  const { api } = useApi();
  const [mode, setMode] = useState<Mode>('authenticator');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const codeRef = useRef<HTMLInputElement>(null);

  async function verify(value: string) {
    if (busy.current) return;
    if (mode === 'authenticator' && value.length !== TOTP_LENGTH) {
      setError(es.access.mfa.codeLength);
      codeRef.current?.focus();
      return;
    }
    if (value === '') {
      setError(es.validation.required);
      codeRef.current?.focus();
      return;
    }
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      await api.verifyMfa(challengeToken, value);
      await onVerified();
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === 'UNAUTHENTICATED') {
        onExpired();
        return;
      }
      setError(apiErrorMessage(failure));
      setCode('');
      codeRef.current?.focus();
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    void verify(code);
  }

  return (
    <form className="access__form" onSubmit={handleSubmit} noValidate>
      <TextField
        ref={codeRef}
        name="code"
        label={mode === 'authenticator' ? es.access.mfa.code : es.access.mfa.recoveryCode}
        {...(mode === 'recovery' ? { hint: es.access.mfa.recoveryHint } : {})}
        autoComplete={mode === 'authenticator' ? 'one-time-code' : 'off'}
        inputMode={mode === 'authenticator' ? 'numeric' : 'text'}
        spellCheck={false}
        autoCapitalize="characters"
        autoFocus
        maxLength={mode === 'authenticator' ? TOTP_LENGTH : undefined}
        value={code}
        error={error ?? undefined}
        disabled={pending}
        onChange={(event) => {
          const raw = event.target.value;
          if (mode === 'recovery') {
            setCode(raw.toUpperCase());
            return;
          }
          const digits = raw.replace(DIGITS_ONLY, '').slice(0, TOTP_LENGTH);
          setCode(digits);
          if (digits.length === TOTP_LENGTH) void verify(digits);
        }}
      />
      <Button type="submit" size="lg" className="access__submit" loading={pending}>
        {es.access.mfa.verify}
      </Button>
      <div className="access__actions">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setMode(mode === 'authenticator' ? 'recovery' : 'authenticator');
            setCode('');
            setError(null);
          }}
        >
          {mode === 'authenticator' ? es.access.mfa.useRecovery : es.access.mfa.useAuthenticator}
        </Button>
        <Button type="button" variant="ghost" onClick={onBack}>
          {es.access.mfa.back}
        </Button>
      </div>
    </form>
  );
}
