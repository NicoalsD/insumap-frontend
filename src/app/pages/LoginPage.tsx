import { useState } from 'react';
import { useNavigate } from 'react-router';
import { es } from '@/i18n/es';
import { apiErrorMessage } from '@/services/api/ApiError';
import { DemoLogin, DEMO_ROLES, mocksEnabled, type DemoRole } from '@/services/demo/DemoLogin';
import { useApi } from '@/state/useApi';
import { useSession } from '@/state/useSession';
import { Button, EmptyState } from '@/ui';
import { HOME_PATH } from '../navigation';
import './LoginPage.css';

/**
 * Placeholder: the access phase builds login, MFA challenge, enrollment and activation here.
 * While the API runs on Mock Service Worker, the example clinic can be entered by role.
 */
export function LoginPage() {
  return (
    <div className="login">
      <EmptyState title={es.auth.loginTitle} body={es.auth.loginPending} />
      {mocksEnabled() ? <DemoRolePicker /> : null}
    </div>
  );
}

function DemoRolePicker() {
  const { api } = useApi();
  const { reload } = useSession();
  const navigate = useNavigate();
  const [pending, setPending] = useState<DemoRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enter = async (role: DemoRole) => {
    setPending(role);
    setError(null);
    try {
      await new DemoLogin(api).signIn(role);
      await reload();
      await navigate(HOME_PATH[role]);
    } catch (failure) {
      setError(apiErrorMessage(failure));
    } finally {
      setPending(null);
    }
  };

  return (
    <fieldset className="login__roles" disabled={pending !== null}>
      <legend>{es.auth.demoEnter}</legend>
      <div className="login__role-list">
        {DEMO_ROLES.map((role) => (
          <Button key={role} variant="secondary" loading={pending === role} onClick={() => void enter(role)}>
            {`${es.auth.demoRoleLabel} ${es.roles[role].toLowerCase()}`}
          </Button>
        ))}
      </div>
      {error ? <p role="alert">{error}</p> : null}
    </fieldset>
  );
}
