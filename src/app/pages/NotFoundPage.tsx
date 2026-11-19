import { es } from '@/i18n/es';
import { ButtonLink, EmptyState } from '@/ui';

export function NotFoundPage() {
  return (
    <EmptyState
      title={es.states.notFoundTitle}
      body={es.states.notFoundBody}
      action={<ButtonLink to="/" variant="secondary">{es.states.backHome}</ButtonLink>}
    />
  );
}
