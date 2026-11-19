import type { ReactNode } from 'react';
import './Badge.css';

export type BadgeTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'critical'
  | 'simulated'
  | 'range-very-low'
  | 'range-low'
  | 'range-in-range'
  | 'range-high'
  | 'range-very-high';

export interface BadgeProps {
  tone?: BadgeTone;
  /** Optional Lucide icon: a shape next to the text so meaning never rides on color alone. */
  icon?: ReactNode;
  children: ReactNode;
}

/** Compact status label. The text is always present: color only reinforces it. */
export function Badge({ tone = 'neutral', icon, children }: BadgeProps) {
  return (
    <span className="ui-badge" data-tone={tone}>
      {icon}
      {children}
    </span>
  );
}
