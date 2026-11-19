import { es } from '@/i18n/es';
import { EmptyState } from '@/ui';

/** Stand-in for a screen a later phase builds: keeps the route, the guard and the shell testable. */
export function ScreenPlaceholder({ title }: { title: string }) {
  return <EmptyState title={title} body={es.states.pendingScreen} />;
}
