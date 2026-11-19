import { Outlet } from 'react-router';
import { es } from '@/i18n/es';
import { mocksEnabled } from '@/services/demo/DemoLogin';
import { ErrorBoundary, MedicalDisclaimer, SimulatedNotice } from '@/ui';

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

/** Layout of the pages outside a shell (landing, login, design system): notices included. */
export function PublicLayout() {
  return (
    <>
      {mocksEnabled() ? <SimulatedNotice /> : null}
      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
      <MedicalDisclaimer />
    </>
  );
}
