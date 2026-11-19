import { es } from '@/i18n/es';
import { EmptyState } from '@/ui';

/** Placeholder: the access phase builds login, MFA challenge, enrollment and activation here. */
export function LoginPage() {
  return <EmptyState title={es.auth.loginTitle} body={es.auth.loginPending} />;
}
