import { Outlet } from 'react-router';
import { es } from '@/i18n/es';
import { useSession } from '@/state/useSession';
import { MedicalDisclaimer } from '@/ui';
import type { NavItem } from '../navigation';
import { ShellNav } from './ShellNav';
import { UserPanel } from './UserPanel';
import './Shell.css';

/**
 * Shell of the doctor and the clinic admin: indigo rail on the left, the screen in `<main>` and the medical disclaimer in the footer.
 */
export function StaffShell({ items }: { items: readonly NavItem[] }) {
  const { state } = useSession();
  if (state.status !== 'authenticated') return null;
  const { session } = state;
  return (
    <div className="staff-shell">
      <div className="staff-shell__rail">
        <p className="shell-brand">{es.app.name}</p>
        <ShellNav items={items} session={session} />
        <UserPanel session={session} />
      </div>
      <div className="staff-shell__body">
        <main id="main-content" className="shell-main" tabIndex={-1}>
          <Outlet />
        </main>
        <MedicalDisclaimer />
      </div>
    </div>
  );
}
