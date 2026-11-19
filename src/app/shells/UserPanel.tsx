import { LogOut } from 'lucide-react';
import { es } from '@/i18n/es';
import type { SessionViewModel } from '@/services/adapters/SessionViewModelAdapter';
import { useSession } from '@/state/useSession';
import { Button } from '@/ui';

/** Name, role and sign-out button. */
export function UserPanel({ session, inline = false }: { session: SessionViewModel; inline?: boolean }) {
  const { signOut } = useSession();
  return (
    <div className="shell-user" data-inline={inline ? '' : undefined}>
      <div>
        <p className="shell-user__name">{session.fullName}</p>
        <p className="shell-user__role">{es.roles[session.role]}</p>
      </div>
      <Button variant="secondary" size="sm" icon={<LogOut size="1em" aria-hidden="true" />} onClick={() => { void signOut(); }}>
        {es.nav.logout}
      </Button>
    </div>
  );
}
