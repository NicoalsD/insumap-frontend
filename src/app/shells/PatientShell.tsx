import { Outlet } from 'react-router';
import { es } from '@/i18n/es';
import { useSession } from '@/state/useSession';
import { MedicalDisclaimer } from '@/ui';
import type { NavItem } from '../navigation';
import { PendingReadingsProvider } from '../pages/patient/app/offline/PendingReadingsProvider';
import { ShellNav } from './ShellNav';
import { UserPanel } from './UserPanel';
import './Shell.css';

/**
 * Shell of the patient. Desktop: one top bar with the four sections. Phone: the same navigation
 * becomes a bottom tab bar (CSS). The offline queue lives here, so it drops with the session.
 */
export function PatientShell({ items }: { items: readonly NavItem[] }) {
  const { state } = useSession();
  if (state.status !== 'authenticated') return null;
  const { session } = state;
  return (
    <div className="patient-shell">
      <header className="patient-shell__bar">
        <p className="shell-brand">{es.app.name}</p>
        <ShellNav items={items} session={session} />
        <UserPanel session={session} inline />
      </header>
      <PendingReadingsProvider>
        <main id="main-content" className="shell-main" tabIndex={-1}>
          <Outlet />
        </main>
      </PendingReadingsProvider>
      <MedicalDisclaimer />
    </div>
  );
}
