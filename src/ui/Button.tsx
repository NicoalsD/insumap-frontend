import { LoaderCircle } from 'lucide-react';
import type { ComponentPropsWithRef, ReactNode } from 'react';
import { es } from '@/i18n/es';
import './Button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'shell';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and ignores clicks, keeping focus on the button. */
  loading?: boolean;
  /** Lucide icon (decorative; the label carries the meaning). */
  icon?: ReactNode;
}

/** Action button. Use `loading` for pending requests; the label text stays for screen readers. */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  type = 'button',
  children,
  onClick,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={['ui-button', rest.className].filter(Boolean).join(' ')}
      data-variant={variant}
      data-size={size}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      onClick={loading ? (event) => { event.preventDefault(); } : onClick}
    >
      {loading ? <LoaderCircle className="ui-button__spinner" size="1.125em" aria-hidden="true" /> : icon}
      {children}
      {loading ? <span className="visually-hidden">{es.states.loading}</span> : null}
    </button>
  );
}
