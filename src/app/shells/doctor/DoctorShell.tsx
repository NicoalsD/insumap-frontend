import { HeartPulse, LogOut } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { es } from '@/i18n/es';
import { useSession } from '@/state/useSession';
import { Button, MedicalDisclaimer } from '@/ui';
import type { NavItem } from '../../navigation';
import { PatientSearch } from './PatientSearch';
import './DoctorShell.css';

const INITIALS = 2;

/** Two initials of a name for the avatar ("Marta Quintero" → "MQ"). */
export function initialsOf(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, INITIALS)
    .map((part) => part.charAt(0).toLocaleUpperCase('es-CO'))
    .join('');
}

/**
 * Shell of the doctor: a fixed side rail (brand, who is signed in and the navigation) and, on the
 * right, a top bar with the breadcrumb and the patient search, then the screen. The whole screen is
 * used; under 64rem the rail turns into a top strip.
 */
export function DoctorShell({ items }: { items: readonly NavItem[] }) {
  const { state, signOut } = useSession();
  const location = useLocation();
  if (state.status !== 'authenticated') return null;
  const { session } = state;
  const visible = items.filter((item) => item.permission === undefined || session.can(item.permission));
  const current = visible.find((item) => location.pathname.startsWith(item.path));
  const home = visible[0]?.path ?? '/';

  return (
    <div className="doctor-shell">
      <aside className="doctor-rail" aria-label={es.doctor.shell.rail}>
        <Link to={home} className="doctor-rail__brand" aria-label={es.app.name}>
          <span className="doctor-rail__mark" aria-hidden="true">
            <HeartPulse size={20} strokeWidth={2.5} />
          </span>
          <span translate="no">{es.app.name}</span>
        </Link>
        <div className="doctor-rail__profile">
          <span className="doctor-rail__avatar" aria-hidden="true">
            {initialsOf(session.fullName)}
          </span>
          <div>
            <p className="doctor-rail__name">{session.fullName}</p>
            <p className="doctor-rail__role">
              {es.roles[session.role]}
              {session.clinic ? ` · ${session.clinic.name}` : ''}
            </p>
          </div>
        </div>
        <nav className="doctor-rail__nav" aria-label={es.nav.main}>
          <ul>
            {visible.map(({ path, label, icon: Icon }) => (
              <li key={path}>
                <NavLink to={path}>
                  <Icon size="1.125rem" aria-hidden="true" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="doctor-rail__footer">
          <Button
            variant="ghost"
            icon={<LogOut size="1em" aria-hidden="true" />}
            onClick={() => {
              void signOut();
            }}
          >
            {es.nav.logout}
          </Button>
        </div>
      </aside>

      <div className="doctor-shell__body">
        <header className="doctor-topbar">
          <nav className="doctor-topbar__crumbs" aria-label={es.doctor.shell.breadcrumb}>
            <ol>
              <li>
                <Link to={home}>{es.doctor.shell.home}</Link>
              </li>
              {current ? (
                <li>
                  <span aria-current="page">{current.label}</span>
                </li>
              ) : null}
            </ol>
          </nav>
          <PatientSearch />
        </header>
        <main id="main-content" className="doctor-shell__main" tabIndex={-1}>
          <Outlet />
        </main>
        <MedicalDisclaimer />
      </div>
    </div>
  );
}
