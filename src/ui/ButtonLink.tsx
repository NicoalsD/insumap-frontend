import type { ComponentProps, ReactNode } from 'react';
import { Link } from 'react-router';
import type { ButtonSize, ButtonVariant } from './Button';
import './Button.css';

export interface ButtonLinkProps extends Omit<ComponentProps<typeof Link>, 'className'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
}

/** A router link styled as a button: navigation is a link, never a button inside a link. */
export function ButtonLink({ variant = 'primary', size = 'md', icon, children, ...rest }: ButtonLinkProps) {
  return (
    <Link {...rest} className="ui-button" data-variant={variant} data-size={size}>
      {icon}
      {children}
    </Link>
  );
}
