import { HeartPulse } from 'lucide-react';
import { Link } from 'react-router';
import { es } from '@/i18n/es';
import type { SessionViewModel } from '@/services/adapters/SessionViewModelAdapter';
import type { NavItem } from '../navigation';
import { ShellNav } from './ShellNav';
import { UserPanel } from './UserPanel';

/** Top bar of the app, same anatomy as the landing: brand left, navigation centre, account right. */
export function AppHeader({ items, session, home }: { items: readonly NavItem[]; session: SessionViewModel; home: string }) {
  return (
    <header className="app-header">
      <div className="app-header__inner">
        <Link to={home} className="app-brand" aria-label={es.app.name}>
          <span className="app-brand__mark" aria-hidden="true">
            <HeartPulse size={20} strokeWidth={2.5} />
          </span>
          <span translate="no">{es.app.name}</span>
        </Link>
        <ShellNav items={items} session={session} />
        <UserPanel session={session} inline />
      </div>
    </header>
  );
}
