import { Navigate, type RouteObject } from 'react-router';
import { PERMISSIONS } from '@/core/auth/permissions';
import { es } from '@/i18n/es';
import { LandingLayout, PublicLayout, RootLayout } from './layouts';
import { NAV_ITEMS } from './navigation';
import { LandingPage } from './pages/LandingPage';
import { LazySystemDesignPage } from './pages/LazySystemDesignPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ScreenPlaceholder } from './pages/ScreenPlaceholder';
import { RequireAccess } from './RequireAccess';
import { PatientShell } from './shells/PatientShell';
import { StaffShell } from './shells/StaffShell';

/**
 * Route table. To add a screen: add a child under its zone here (replace the placeholder with the
 * feature's component) and, if it belongs in the rail or the top bar, an item in `navigation.ts`.
 * A zone's `RequireAccess` checks the role; a child can add its own `RequireAccess permission`.
 */
export const appRoutes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      {
        element: <LandingLayout />,
        children: [{ index: true, element: <LandingPage /> }],
      },
      {
        element: <PublicLayout />,
        children: [
          { path: 'login', element: <LoginPage /> },
          {
            path: 'dev/system',
            element: <LazySystemDesignPage />,
          },
        ],
      },
      {
        path: 'doctor',
        element: <RequireAccess roles={['DOCTOR']} />,
        children: [
          {
            element: <StaffShell items={NAV_ITEMS.DOCTOR} />,
            children: [
              { index: true, element: <Navigate to="triage" replace /> },
              {
                element: <RequireAccess permission={PERMISSIONS.triageRead} />,
                children: [{ path: 'triage', element: <ScreenPlaceholder title={es.nav.triage} /> }],
              },
              {
                element: <RequireAccess permission={PERMISSIONS.alertsRead} />,
                children: [{ path: 'alerts', element: <ScreenPlaceholder title={es.nav.alerts} /> }],
              },
              {
                element: <RequireAccess permission={PERMISSIONS.patientRead} />,
                children: [{ path: 'patients/:patientId', element: <ScreenPlaceholder title={es.nav.patients} /> }],
              },
            ],
          },
        ],
      },
      {
        path: 'admin',
        element: <RequireAccess roles={['CLINIC_ADMIN']} />,
        children: [
          {
            element: <StaffShell items={NAV_ITEMS.CLINIC_ADMIN} />,
            children: [
              { index: true, element: <Navigate to="patients" replace /> },
              { path: 'patients', element: <ScreenPlaceholder title={es.nav.patients} /> },
              { path: 'imports', element: <ScreenPlaceholder title={es.nav.imports} /> },
              { path: 'credentials', element: <ScreenPlaceholder title={es.nav.credentials} /> },
              { path: 'care-teams', element: <ScreenPlaceholder title={es.nav.careTeams} /> },
            ],
          },
        ],
      },
      {
        path: 'patient',
        element: <RequireAccess roles={['PATIENT']} />,
        children: [
          {
            element: <PatientShell items={NAV_ITEMS.PATIENT} />,
            children: [
              { index: true, element: <ScreenPlaceholder title={es.nav.home} /> },
              { path: 'readings', element: <ScreenPlaceholder title={es.nav.readings} /> },
            ],
          },
        ],
      },
      {
        element: <PublicLayout />,
        children: [{ path: '*', element: <NotFoundPage /> }],
      },
    ],
  },
];
