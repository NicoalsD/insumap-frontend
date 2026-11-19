import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import './TextField.css';

export interface FieldShellProps {
  id: string;
  label: string;
  hint?: string | undefined;
  /** Message already in Spanish, from a Zod schema or from `ApiError.fieldErrors`. */
  error?: string | undefined;
  size?: 'md' | 'lg' | undefined;
  hintId: string;
  errorId: string;
  children: ReactNode;
}

/** Label, hint and error around a native control: shared by TextField and Select. */
export function FieldShell({ id, label, hint, error, size = 'md', hintId, errorId, children }: FieldShellProps) {
  return (
    <div className="ui-field" data-size={size}>
      <label className="ui-field__label" htmlFor={id}>
        {label}
      </label>
      {hint ? (
        <p className="ui-field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p className="ui-field__error" id={errorId} aria-live="polite">
          <CircleAlert size="1em" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
