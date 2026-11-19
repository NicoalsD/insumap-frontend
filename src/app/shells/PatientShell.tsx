import { Outlet } from 'react-router';
import { es } from '@/i18n/es';
import { useSession } from '@/state/useSession';
import { MedicalDisclaimer, SimulatedNotice } from '@/ui';
import type { NavItem } from '../navigation';
import { ShellNav } from './ShellNav';
import { UserPanel } from './UserPanel';
import './Shell.css';

/** Shell of the patient: petrol top bar, large touch targets, the same notices as the staff shell. */
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
      {session.isDemo ? <SimulatedNotice /> : null}
      <main id="main-content" className="shell-main" tabIndex={-1}>
        <Outlet />
      </main>
      <MedicalDisclaimer />
    </div>
  );
}
