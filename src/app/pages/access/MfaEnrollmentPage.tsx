import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { homePathFor } from '@/app/navigation';
import { es } from '@/i18n/es';
import { apiErrorMessage } from '@/services/api/ApiError';
import { useApi } from '@/state/useApi';
import { useSession } from '@/state/useSession';
import { Button, TextField } from '@/ui';
import { AccessLayout } from './AccessLayout';
import { copyText } from './clipboard';
import { QrCode } from './QrCode';

const TOTP_LENGTH = 6;
const DIGITS_ONLY = /\D/g;

interface Enrollment {
  readonly secret: string;
  readonly otpauth_uri: string;
}

/**
 * Staff without MFA enroll here: the QR (and the secret as text) to add to an authenticator app,
 * a confirmation code, then the recovery codes, shown once. Leaving needs the saved-codes checkbox.
 */
export function MfaEnrollmentPage() {
  const { api } = useApi();
  const { state, reload } = useSession();
  const navigate = useNavigate();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [codes, setCodes] = useState<readonly string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const started = useRef(false);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Once per mount: StrictMode runs effects twice and a second enrollment would replace the secret.
    if (started.current) return;
    started.current = true;
    api
      .startMfaEnrollment()
      .then(setEnrollment)
      .catch((error: unknown) => {
        setStartError(apiErrorMessage(error));
      });
  }, [api]);

  async function confirm(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (code.length !== TOTP_LENGTH) {
      setConfirmError(es.access.enroll.codeLength);
      codeRef.current?.focus();
      return;
    }
    setConfirmError(null);
    setPending(true);
    try {
      setCodes(await api.confirmMfaEnrollment(code));
      // The session is opened now, so "Continue" can read the role; the codes stay on screen.
      await reload();
    } catch (error) {
      setConfirmError(apiErrorMessage(error));
      setCode('');
      codeRef.current?.focus();
    } finally {
      setPending(false);
    }
  }

  async function copySecret() {
    if (enrollment === null) return;
    setNotice((await copyText(enrollment.secret)) ? es.access.enroll.secretCopied : es.access.enroll.copyFailed);
  }

  async function copyCodes() {
    if (codes === null) return;
    setNotice((await copyText(codes.join('\n'))) ? es.access.enroll.codesCopied : es.access.enroll.copyFailed);
  }

  function downloadCodes() {
    if (codes === null) return;
    const blob = new Blob([[es.access.enroll.downloadHeader, '', ...codes].join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = es.access.enroll.downloadFileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (codes !== null) {
    return (
      <AccessLayout title={es.access.enroll.codesTitle} description={es.access.enroll.codesDescription}>
        <ol className="access__codes" aria-label={es.access.enroll.codesTitle}>
          {codes.map((recovery) => (
            <li key={recovery}>{recovery}</li>
          ))}
        </ol>
        <div className="access__actions">
          <Button variant="secondary" onClick={() => void copyCodes()}>
            {es.access.enroll.copyCodes}
          </Button>
          <Button variant="secondary" onClick={downloadCodes}>
            {es.access.enroll.downloadCodes}
          </Button>
        </div>
        {notice ? (
          <p className="access__live" role="status">
            {notice}
          </p>
        ) : null}
        <label className="access__check">
          <input
            type="checkbox"
            checked={saved}
            onChange={(event) => {
              setSaved(event.target.checked);
            }}
          />
          <span>{es.access.enroll.savedCheck}</span>
        </label>
        {state.status === 'authenticated' ? (
          <Button
            size="lg"
            className="access__submit"
            disabled={!saved}
            onClick={() => {
              void navigate(homePathFor(state.session.role), { replace: true });
            }}
          >
            {es.access.enroll.continue}
          </Button>
        ) : (
          <>
            <p className="access__alert" role="alert">
              {es.access.enroll.sessionLost}
            </p>
            <Link to="/login">{es.access.enroll.backToLogin}</Link>
          </>
        )}
      </AccessLayout>
    );
  }

  return (
    <AccessLayout title={es.access.enroll.title} description={es.access.enroll.description}>
      {startError ? (
        <p className="access__alert" role="alert">
          {startError}{' '}
          <Link to="/login">{es.access.enroll.backToLogin}</Link>
        </p>
      ) : null}
      {enrollment === null && startError === null ? <p role="status">{es.access.enroll.preparing}</p> : null}
      {enrollment !== null ? (
        <div className="access__section" role="group" aria-label={es.access.enroll.qrLabel}>
          <QrCode value={enrollment.otpauth_uri} label={es.access.enroll.qrLabel} />
          <div className="access__section">
            <p className="access__subtitle">{es.access.enroll.secretLabel}</p>
            <div className="access__secret">
              <code>{enrollment.secret}</code>
              <Button variant="secondary" onClick={() => void copySecret()}>
                {es.access.enroll.copySecret}
              </Button>
            </div>
            <p className="access__live">{es.access.enroll.secretHint}</p>
            {notice ? (
              <p className="access__live" role="status">
                {notice}
              </p>
            ) : null}
          </div>
          <form className="access__form" onSubmit={(event) => void confirm(event)} noValidate>
            <h2 className="access__subtitle">{es.access.enroll.confirmTitle}</h2>
            <TextField
              ref={codeRef}
              name="code"
              label={es.access.enroll.code}
              autoComplete="one-time-code"
              inputMode="numeric"
              autoFocus
              maxLength={TOTP_LENGTH}
              value={code}
              error={confirmError ?? undefined}
              disabled={pending}
              onChange={(event) => {
                setCode(event.target.value.replace(DIGITS_ONLY, '').slice(0, TOTP_LENGTH));
              }}
            />
            <Button type="submit" size="lg" className="access__submit" loading={pending}>
              {es.access.enroll.confirm}
            </Button>
          </form>
        </div>
      ) : null}
    </AccessLayout>
  );
}
