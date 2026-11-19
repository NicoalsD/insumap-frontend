import { Outlet } from 'react-router';
import { es } from '@/i18n/es';
import { ErrorBoundary, MedicalDisclaimer } from '@/ui';

/** Root of every route: skip link and the error boundary. */
export function RootLayout() {
  return (
    <ErrorBoundary>
      <a className="skip-link" href="#main-content">
        {es.app.skipToContent}
      </a>
      <Outlet />
    </ErrorBoundary>
  );
}

/**
 * Layout of the public landing: production-facing, without the simulated or academic notices.
 * The page renders its own header, main and footer landmarks.
 */
export function LandingLayout() {
  return <Outlet />;
}

/** Layout of the pages outside a shell (login, design system): regulatory notice included. */
export function PublicLayout() {
  return (
    <>
      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
      <MedicalDisclaimer />
    </>
  );
}
