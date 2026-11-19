import { Outlet } from 'react-router';
import { useSession } from '@/state/useSession';
import { MedicalDisclaimer } from '@/ui';
import type { NavItem } from '../navigation';
import { AppHeader } from './AppHeader';
import './Shell.css';

/** Shell of the doctor and the clinic admin: landing-style top bar, the screen in `<main>`, regulatory notice in the footer. */
export function StaffShell({ items }: { items: readonly NavItem[] }) {
  const { state } = useSession();
  if (state.status !== 'authenticated') return null;
  const { session } = state;
  return (
    <div className="staff-shell">
      <AppHeader items={items} session={session} home={items[0]?.path ?? '/'} />
      <main id="main-content" className="shell-main" tabIndex={-1}>
        <Outlet />
      </main>
      <MedicalDisclaimer />
    </div>
  );
}
