import { NavLink } from 'react-router';
import { es } from '@/i18n/es';
import type { SessionViewModel } from '@/services/adapters/SessionViewModelAdapter';
import type { NavItem } from '../navigation';

/** Navigation list filtered by the permissions of `/auth/me` (UX only). */
export function ShellNav({ items, session }: { items: readonly NavItem[]; session: SessionViewModel }) {
  return (
    <nav className="shell-nav" aria-label={es.nav.main}>
      <ul>
        {items
          .filter((item) => item.permission === undefined || session.can(item.permission))
          .map(({ path, label, icon: Icon }) => (
            <li key={path}>
              <NavLink to={path} end>
                <Icon size="1.125rem" aria-hidden="true" />
                {label}
              </NavLink>
            </li>
          ))}
      </ul>
    </nav>
  );
}
