import { useRef, useState, type SubmitEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { homePathFor } from '@/app/navigation';
import { es } from '@/i18n/es';
import { apiErrorMessage } from '@/services/api/ApiError';
import { toFieldErrors } from '@/services/forms/formSchemas';
import { useApi } from '@/state/useApi';
import { useFormSchemas } from '@/state/useFormSchemas';
import { useSession } from '@/state/useSession';
import { Button, ButtonLink, TextField } from '@/ui';
import { AccessLayout } from './AccessLayout';
import { MfaChallengeForm } from './MfaChallengeForm';
import { PasswordField } from './PasswordField';
import { safeInternalPath } from './nextPath';

type FieldErrors = Readonly<Record<string, string>>;

/**
 * Sign-in for every role. Password first. Staff with MFA continue on this same page with the
 * challenge; staff without MFA go to enrollment; everyone else goes to the home of their role.
 *
 * The session is reloaded before any navigation, so the route guard never sees "anonymous".
 */
export function LoginPage() {
  const { api } = useApi();
  const { reload } = useSession();
  const { schemas } = useFormSchemas();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeInternalPath(params.get('next'));
  const sessionExpired = params.get('reason') === 'expired';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  /** Reloads the session, then goes to the requested internal path or to the role's home. */
  async function enter(): Promise<void> {
    const session = await reload();
    if (session === null) {
      setFormError(es.access.login.sessionNotOpened);
      return;
    }
    void navigate(next ?? homePathFor(session.role), { replace: true });
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setFormError(null);
    const parsed = schemas.login.safeParse({ email, password });
    if (!parsed.success) {
      const errors = toFieldErrors(parsed.error);
      setFieldErrors(errors);
      if (errors['email'] !== undefined) emailRef.current?.focus();
      else passwordRef.current?.focus();
      return;
    }
    setFieldErrors({});
    setPending(true);
    try {
      const result = await api.login(parsed.data.email, password);
      if (result.status === 'MFA_CHALLENGE') {
        setChallengeToken(result.challenge_token);
      } else if (result.status === 'MFA_ENROLLMENT_REQUIRED') {
        await reload();
        void navigate('/mfa/enrollment', { replace: true });
      } else {
        await enter();
      }
    } catch (error) {
      setFormError(apiErrorMessage(error));
      passwordRef.current?.focus();
    } finally {
      setPending(false);
    }
  }

  if (challengeToken !== null) {
    return (
      <AccessLayout title={es.access.mfa.title} description={es.access.mfa.description}>
        <MfaChallengeForm
          challengeToken={challengeToken}
          onVerified={enter}
          onBack={() => {
            setChallengeToken(null);
            setFormError(null);
          }}
          onExpired={() => {
            setChallengeToken(null);
            setFormError(es.auth.sessionExpired);
          }}
        />
      </AccessLayout>
    );
  }

  return (
    <AccessLayout title={es.access.login.title} description={es.access.login.description}>
      {sessionExpired ? (
        <p className="access__notice" role="status">
          {es.auth.sessionExpired}
        </p>
      ) : null}
      {formError ? (
        <p className="access__alert" role="alert">
          {formError}
        </p>
      ) : null}
      <form className="access__form" onSubmit={(event) => void handleSubmit(event)} noValidate>
        <TextField
          ref={emailRef}
          name="email"
          type="email"
          label={es.access.login.email}
          autoComplete="username"
          inputMode="email"
          spellCheck={false}
          autoCapitalize="none"
          required
          value={email}
          error={fieldErrors['email']}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
        />
        <PasswordField
          ref={passwordRef}
          name="password"
          autoComplete="current-password"
          label={es.access.login.password}
          required
          value={password}
          error={fieldErrors['password']}
          onChange={(event) => {
            setPassword(event.target.value);
          }}
        />
        <Button type="submit" size="lg" className="access__submit" loading={pending}>
          {es.access.login.submit}
        </Button>
      </form>
      <p>
        <ButtonLink to="/activate" variant="ghost">
          {es.access.login.activate}
        </ButtonLink>
      </p>
    </AccessLayout>
  );
}
