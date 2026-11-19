import { Navigate, Outlet, useLocation } from 'react-router';
import type { PermissionCode, Role } from '@/core/auth/permissions';
import { es } from '@/i18n/es';
import { useSession } from '@/state/useSession';
import { ButtonLink, EmptyState, LoadingState } from '@/ui';

export interface RequireAccessProps {
  /** Roles allowed in this zone. */
  roles?: readonly Role[];
  /** Permission needed (from `/auth/current-user`). */
  permission?: PermissionCode;
}

/**
 * Route guard from `/auth/current-user`: loading spinner, redirect to the landing when anonymous, and a
 * "no access" screen when the role or permission is missing. This is UX only; the server decides.
 */
export function RequireAccess({ roles, permission }: RequireAccessProps) {
  const { state } = useSession();
  const location = useLocation();
  if (state.status === 'loading') return <LoadingState label={es.app.loadingSession} />;
  if (state.status === 'anonymous') return <Navigate to="/" replace state={{ from: location.pathname }} />;
  const { session } = state;
  const allowed =
    (roles === undefined || roles.includes(session.role)) && (permission === undefined || session.can(permission));
  if (!allowed) {
    return (
      <EmptyState
        title={es.states.forbiddenTitle}
        body={es.states.forbiddenBody}
        action={<ButtonLink to="/" variant="secondary">{es.states.backHome}</ButtonLink>}
      />
    );
  }
  return <Outlet />;
}
