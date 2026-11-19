import type { ReactNode } from 'react';
import { es } from '@/i18n/es';
import './access.css';

export interface AccessLayoutProps {
  title: string;
  description?: string | undefined;
  children: ReactNode;
}

/**
 * Centered panel over the lavender canvas, with the Insumap mark on top and the screen title in the
 * display face. The regulatory notice comes from `PublicLayout`, below the panel.
 */
export function AccessLayout({ title, description, children }: AccessLayoutProps) {
  return (
    <div className="access">
      <div className="access__card">
        <p className="access__brand">{es.app.name}</p>
        <header className="access__header">
          <h1>{title}</h1>
          {description ? <p className="access__description">{description}</p> : null}
        </header>
        {children}
      </div>
    </div>
  );
}
