import { HeartPulse } from 'lucide-react';
import type { ReactNode } from 'react';
import { BodyCanvas } from '@/app/pages/landing/BodyCanvas';
import { canRender3D } from '@/ui/body/webglSupport';
import { TooltipProvider } from '@/ui/shadcn/tooltip';
import { es } from '@/i18n/es';
import './access.css';

export interface AccessLayoutProps {
  title: string;
  description?: string | undefined;
  children: ReactNode;
}

/**
 * Full-screen split, as the landing's hero: the form on the left, the same 3D body of the landing
 * on the right (it rotates with the pointer and pauses on request). Without WebGL the form keeps
 * the whole screen. The regulatory notice comes from `PublicLayout`, below.
 */
export function AccessLayout({ title, description, children }: AccessLayoutProps) {
  const show3D = canRender3D();
  return (
    <div className="access" data-stage={show3D || undefined}>
      <div className="access__column">
        <p className="access__brand">
          <span className="access__mark" aria-hidden="true">
            <HeartPulse size={20} strokeWidth={2.5} />
          </span>
          <span translate="no">{es.app.name}</span>
        </p>
        <div className="access__card">
          <header className="access__header">
            <h1>{title}</h1>
            {description ? <p className="access__description">{description}</p> : null}
          </header>
          {children}
        </div>
      </div>
      {show3D ? (
        <TooltipProvider>
          <div className="access__stage">
            <BodyCanvas mode="hero" label={es.landing.scene.label} className="access__canvas" />
          </div>
        </TooltipProvider>
      ) : null}
    </div>
  );
}
