import { useState } from 'react';
import { useNavigate } from 'react-router';
import { es } from '@/i18n/es';
import { apiErrorMessage } from '@/services/api/ApiError';
import { DemoLogin, DEMO_ROLES, mocksEnabled, type DemoRole } from '@/services/demo/DemoLogin';
import { useApi } from '@/state/useApi';
import { useSession } from '@/state/useSession';
import { Button } from '@/ui';
import { HOME_PATH } from '../navigation';
import './LandingPage.css';

/**
 * Placeholder landing with the working demo entry: pick a role, get an MSW session for it.
 * The landing phase replaces the page but keeps `DemoLogin` + `useSession().reload()`.
 */
export function LandingPage() {
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
    <div className="landing">
      <h1 className="landing__title">{es.app.name}</h1>
      <p className="landing__tagline">{es.app.tagline}</p>
      {mocksEnabled() ? (
        <fieldset className="landing__roles" disabled={pending !== null}>
          <legend>{es.auth.demoEnter}</legend>
          {DEMO_ROLES.map((role) => (
            <Button key={role} loading={pending === role} onClick={() => void enter(role)}>
              {`${es.auth.demoRoleLabel} ${es.roles[role].toLowerCase()}`}
            </Button>
          ))}
        </fieldset>
      ) : (
        <p>{es.auth.demoUnavailable}</p>
      )}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
