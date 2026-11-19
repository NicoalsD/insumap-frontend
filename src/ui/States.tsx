import { CircleAlert, Inbox, LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { es } from '@/i18n/es';
import { apiErrorMessage } from '@/services/api/ApiError';
import { Button } from './Button';
import './States.css';

/** Loading placeholder announced politely to screen readers. */
export function LoadingState({ label = es.states.loading }: { label?: string }) {
  return (
    <div className="ui-state" role="status" aria-live="polite">
      <LoaderCircle className="ui-state__icon ui-button__spinner" size="1.5rem" aria-hidden="true" />
      <p className="ui-state__body">{label}</p>
    </div>
  );
}

export interface EmptyStateProps {
  title?: string;
  body?: string;
  /** An action that fills the emptiness, such as importing patients. */
  action?: ReactNode;
}

/** Nothing to show yet: say why and what happens next. */
export function EmptyState({ title = es.states.emptyTitle, body, action }: EmptyStateProps) {
  return (
    <div className="ui-state">
      <Inbox className="ui-state__icon" size="1.5rem" aria-hidden="true" />
      <h2 className="ui-state__title">{title}</h2>
      {body ? <p className="ui-state__body">{body}</p> : null}
      {action}
    </div>
  );
}

export interface ErrorStateProps {
  /** Any thrown value; `ApiError` maps to its Spanish message by code. */
  error?: unknown;
  title?: string;
  onRetry?: () => void;
}

/** Failed to load: name the problem in Spanish and offer a retry. */
export function ErrorState({ error, title = es.states.errorTitle, onRetry }: ErrorStateProps) {
  return (
    <div className="ui-state" data-tone="error" role="alert">
      <CircleAlert className="ui-state__icon" size="1.5rem" aria-hidden="true" />
      <h2 className="ui-state__title">{title}</h2>
      <p className="ui-state__body">{apiErrorMessage(error)}</p>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          {es.states.retry}
        </Button>
      ) : null}
    </div>
  );
}
